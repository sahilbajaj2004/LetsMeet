import http from "node:http";
import process from "node:process";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import "dotenv/config";

import { connectToDatabase } from "./lib/db.js";
import {
  validateRoom,
  ensureRoom,
  getRoom,
  roleFor,
  isDeclined,
  markDeclined,
  isFull,
  addAttendee,
  getAttendee,
  setState,
  removeAttendee,
  listInCall,
  dropRoomIfEmpty,
} from "./lib/rooms.js";

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));

// Health / liveness — also what Render/Railway hit to confirm the service is up.
app.get("/", (_req, res) => {
  res.json({
    service: "letsmeet-signaling",
    status: "ok",
    time: new Date().toISOString(),
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

// Normalize whatever the client sends into a trusted identity shape. Host status
// is decided server-side (roleFor against the DB host id), never from this blob.
function cleanIdentity(raw) {
  const name = String(raw?.name ?? "").trim().slice(0, 60) || "Guest";
  return {
    userId: raw?.userId ? String(raw.userId) : null,
    name,
    image: raw?.image ? String(raw.image) : null,
    isGuest: !raw?.userId,
  };
}

// A host-only action is valid only if this socket is the room's current host.
function hostRoomFor(socket) {
  const room = getRoom(socket.data?.code);
  if (!room) return null;
  if (socket.data?.role !== "host" || room.hostSocketId !== socket.id) return null;
  return room;
}

// Tear a socket out of its room (voluntary leave or disconnect) and tell the
// right people. Shared by `room:leave` and `disconnect`.
function cleanup(socket) {
  const code = socket.data?.code;
  if (!code) return;
  const room = getRoom(code);
  if (!room) return;

  const attendee = removeAttendee(room, socket.id);
  socket.leave(code);
  if (!attendee) return;

  if (attendee.role === "host") {
    // Phase 6 turns this into a full end-for-all teardown. For now, just notify.
    io.to(code).emit("host:left", { socketId: socket.id });
  } else if (attendee.state === "pending") {
    // Waiter bailed before the host decided — clear them from the host's queue.
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit("waiting:cancelled", { socketId: socket.id });
    }
  } else if (attendee.state === "in_call") {
    io.to(code).emit("peer:left", { socketId: socket.id });
  }

  dropRoomIfEmpty(code);
}

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // Knock on a room. Host is auto-admitted; everyone else enters the waiting room.
  socket.on("room:join", async ({ code, identity: rawIdentity } = {}) => {
    try {
      const identity = cleanIdentity(rawIdentity);

      const check = await validateRoom(code);
      if (check.status !== "ok") {
        socket.emit("room:rejected", { reason: check.status }); // not_found | expired
        return;
      }

      const room = ensureRoom(code, check.host, check.hostName);
      const role = roleFor(room, identity);
      socket.data = { code, identity, role };

      // --- Host: skip the waiting room entirely ---
      if (role === "host") {
        socket.join(code);
        addAttendee(room, socket.id, identity, "host", "in_call");
        const peers = listInCall(room, socket.id);
        socket.emit("room:admitted", { selfId: socket.id, role: "host", peers });
        io.to(code).except(socket.id).emit("peer:joined", {
          socketId: socket.id,
          identity,
          role: "host",
        });
        // Replay anyone who knocked before the host connected.
        for (const a of room.attendees.values()) {
          if (a.state === "pending") {
            socket.emit("waiting:request", { socketId: a.socketId, identity: a.identity });
          }
        }
        return;
      }

      // --- Member: blocked if previously declined ---
      if (isDeclined(room, identity)) {
        socket.emit("room:declined");
        return;
      }

      // --- Member: rejected outright if the call is already full ---
      if (isFull(room)) {
        socket.emit("room:full");
        return;
      }

      // --- Member: enter the waiting room (not yet in the call broadcast group) ---
      addAttendee(room, socket.id, identity, "member", "pending");
      socket.emit("waiting:pending");
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit("waiting:request", {
          socketId: socket.id,
          identity,
        });
      }
    } catch (err) {
      console.error(`[socket] room:join error (${socket.id}):`, err.message);
      socket.emit("room:rejected", { reason: "error" });
    }
  });

  // Host admits a waiter.
  socket.on("waiting:accept", ({ socketId } = {}) => {
    const room = hostRoomFor(socket);
    if (!room) return;

    const target = getAttendee(room, socketId);
    if (!target || target.state !== "pending") return;

    // Capacity is also enforced here — host can't accept past the mesh cap.
    if (isFull(room)) {
      socket.emit("waiting:error", { socketId, reason: "full" });
      return;
    }

    setState(room, socketId, "in_call");

    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket) targetSocket.join(room.code);

    const peers = listInCall(room, socketId);
    io.to(socketId).emit("room:admitted", {
      selfId: socketId,
      role: "member",
      peers,
    });
    io.to(room.code).except(socketId).emit("peer:joined", {
      socketId,
      identity: target.identity,
      role: "member",
    });
  });

  // Host declines a waiter — blocked from re-knocking this session.
  socket.on("waiting:decline", ({ socketId } = {}) => {
    const room = hostRoomFor(socket);
    if (!room) return;

    const target = getAttendee(room, socketId);
    if (!target || target.state !== "pending") return;

    markDeclined(room, target.identity);
    removeAttendee(room, socketId);
    io.to(socketId).emit("room:declined");
  });

  // --- WebRTC handshake relay (Phase 4) ---
  // The server forwards opaque SDP/ICE between two in-call peers; it never parses
  // the payloads. Both ends must be `in_call` in the same room, so pending or
  // outside sockets can't inject signaling.
  function relay(event, { to, ...rest } = {}) {
    const room = getRoom(socket.data?.code);
    if (!room || !to) return;
    const self = getAttendee(room, socket.id);
    const target = getAttendee(room, to);
    if (self?.state !== "in_call" || target?.state !== "in_call") return;
    io.to(to).emit(event, { from: socket.id, ...rest });
  }

  socket.on("webrtc:offer", ({ to, sdp } = {}) => relay("webrtc:offer", { to, sdp }));
  socket.on("webrtc:answer", ({ to, sdp } = {}) => relay("webrtc:answer", { to, sdp }));
  socket.on("webrtc:ice", ({ to, candidate } = {}) =>
    relay("webrtc:ice", { to, candidate }),
  );

  // Voluntary leave (Leave button). Same teardown as a disconnect.
  socket.on("room:leave", () => {
    cleanup(socket);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    cleanup(socket);
  });
});

// Connect to Mongo before accepting traffic so the first join doesn't eat the
// cold-connect latency, and we fail fast if the URI is wrong.
try {
  await connectToDatabase();
  console.log("[db] connected");
} catch (err) {
  console.error("[db] connection failed:", err.message);
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(
    `[signaling] listening on http://localhost:${PORT}  (CORS origin: ${CLIENT_ORIGIN})`,
  );
});
