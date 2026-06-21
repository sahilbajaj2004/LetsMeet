import http from "node:http";
import process from "node:process";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import "dotenv/config";

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

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // Phase 0 handshake: greet the client so it can confirm a live link.
  socket.emit("server:hello", {
    id: socket.id,
    message: "connected to letsmeet signaling",
  });

  // Phase 0 round-trip test. Real event logic (join/waiting-room/WebRTC relay)
  // lands in Phase 3.
  socket.on("client:ping", (payload) => {
    console.log(`[socket] ping from ${socket.id}:`, payload);
    socket.emit("server:pong", { ok: true, echo: payload, at: Date.now() });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(
    `[signaling] listening on http://localhost:${PORT}  (CORS origin: ${CLIENT_ORIGIN})`,
  );
});
