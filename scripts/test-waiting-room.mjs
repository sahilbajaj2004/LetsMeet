// Throwaway Phase 3 check: exercise the signaling waiting-room state machine.
// Start the signaling server first (cd signaling && npm start), then run:
//   node --env-file=.env.local scripts/test-waiting-room.mjs
// Remove the seeded room afterwards with:
//   node --env-file=.env.local scripts/test-waiting-room.mjs clean
//
// Self-contained (inline Room schema, like scripts/seed-user.mjs) so it runs
// under plain Node without ESM interop against the app's models.
import mongoose from "mongoose";
import { io } from "socket.io-client";

const URL = process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000";
const MONGODB_URI = process.env.MONGODB_URI;
const CODE = "tst-waiting-room"; // fixed test code, cleaned up at the end

if (!MONGODB_URI) {
  console.error("✗ MONGODB_URI not set (use --env-file=.env.local)");
  process.exit(1);
}

const RoomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    host: { type: mongoose.Schema.Types.ObjectId, required: true },
    hostName: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: "rooms", strict: false }
);
const Room = mongoose.models.Room || mongoose.model("Room", RoomSchema);

// --- clean mode -------------------------------------------------------------
if (process.argv[2] === "clean") {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const r = await Room.deleteOne({ code: CODE });
  console.log(`✓ removed test room (${r.deletedCount} doc)`);
  await mongoose.disconnect();
  process.exit(0);
}

// --- helpers ----------------------------------------------------------------
const sockets = [];
function connect() {
  // forceNew: socket.io-client multiplexes connections to the same URL by
  // default — without this every io(URL) would return the SAME socket.
  const s = io(URL, { forceNew: true, transports: ["websocket"], timeout: 8000 });
  sockets.push(s);
  return s;
}

function waitFor(socket, event, { ms = 6000, where = "" } = {}) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting "${event}" ${where}`));
    }, ms);
    function handler(payload) {
      clearTimeout(t);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

// Asserting that an event does NOT arrive within a short window.
function expectNot(socket, event, ms = 800) {
  return new Promise((resolve, reject) => {
    function handler(p) {
      clearTimeout(t);
      socket.off(event, handler);
      reject(new Error(`unexpected "${event}": ${JSON.stringify(p)}`));
    }
    const t = setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
    socket.on(event, handler);
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const log = (m) => console.log("✓", m);

function shutdown(code) {
  for (const s of sockets) s.close();
  mongoose.disconnect().catch(() => {});
  process.exit(code);
}

// --- test -------------------------------------------------------------------
let host;
try {
  // Seed a real room. The host id is what the host socket must present as
  // identity.userId for the server to grant the host role.
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const hostId = new mongoose.Types.ObjectId();
  await Room.findOneAndUpdate(
    { code: CODE },
    {
      $set: {
        code: CODE,
        host: hostId,
        hostName: "Ada (host)",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  log(`seeded room ${CODE} (host ${hostId})`);

  // 1) Host joins → auto-admitted, bypasses the waiting room.
  host = connect();
  await waitFor(host, "connect", { where: "(host connect)" });
  const pHostAdmit = waitFor(host, "room:admitted", { where: "(host)" });
  host.emit("room:join", {
    code: CODE,
    identity: { userId: hostId.toString(), name: "Ada (host)" },
  });
  const hostAdmit = await pHostAdmit;
  assert(hostAdmit.role === "host", "host should be admitted with role=host");
  assert(Array.isArray(hostAdmit.peers) && hostAdmit.peers.length === 0, "host peers should start empty");
  log("host auto-admitted (role=host, bypassed waiting room)");

  // helper: a member knocks; returns its server-side socketId from the host's request
  async function knock(name) {
    const s = connect();
    await waitFor(s, "connect", { where: `(${name} connect)` });
    const pPending = waitFor(s, "waiting:pending", { where: `(${name})` });
    const pReq = waitFor(host, "waiting:request", { where: `(host sees ${name})` });
    s.emit("room:join", { code: CODE, identity: { name } });
    await pPending;
    const req = await pReq;
    assert(req.identity.name === name, `host request should carry name ${name}`);
    assert(req.identity.isGuest === true, `${name} should be a guest`);
    return { socket: s, id: req.socketId, name };
  }

  async function accept(member) {
    const pAdmit = waitFor(member.socket, "room:admitted", { where: `(${member.name} admit)` });
    const pPeer = waitFor(host, "peer:joined", {
      where: `(host sees ${member.name} join)`,
    });
    host.emit("waiting:accept", { socketId: member.id });
    const admit = await pAdmit;
    assert(admit.role === "member", `${member.name} admitted as member`);
    const peer = await pPeer;
    assert(peer.socketId === member.id, "peer:joined socketId matches");
  }

  // 2) Member knocks → pending + host request; host accepts → admitted.
  const j1 = await knock("Guest One");
  log("Guest One pending; host received waiting:request");
  await accept(j1);
  log("Guest One accepted → room:admitted + host peer:joined");

  // 3) Decline path + re-knock is blocked.
  const j2 = await knock("Guest Two");
  const pDeclined = waitFor(j2.socket, "room:declined", { where: "(Guest Two decline)" });
  host.emit("waiting:decline", { socketId: j2.id });
  await pDeclined;
  log("Guest Two declined → room:declined");

  const pBlocked = waitFor(j2.socket, "room:declined", { where: "(Guest Two re-knock)" });
  const pNoPending = expectNot(j2.socket, "waiting:pending");
  j2.socket.emit("room:join", { code: CODE, identity: { name: "Guest Two" } });
  await Promise.all([pBlocked, pNoPending]);
  log("Guest Two re-knock blocked (declined again, no waiting:pending)");

  // 4) Capacity: fill to 4 in-call (host + J1 + J3 + J4), 5th is rejected.
  const j3 = await knock("Guest Three");
  await accept(j3);
  const j4 = await knock("Guest Four");
  await accept(j4);
  log("call now at 4 in-call (host + 3 members)");

  const j5 = connect();
  await waitFor(j5, "connect", { where: "(Guest Five connect)" });
  const pFull = waitFor(j5, "room:full", { where: "(Guest Five)" });
  const pNoPending5 = expectNot(j5, "waiting:pending");
  j5.emit("room:join", { code: CODE, identity: { name: "Guest Five" } });
  await Promise.all([pFull, pNoPending5]);
  log("Guest Five rejected → room:full (no waiting entry)");

  // 5) Leave: J1 disconnects → remaining members get peer:left.
  const pLeft = waitFor(host, "peer:left", {
    where: "(host sees Guest One leave)",
  });
  j1.socket.close();
  const left = await pLeft;
  assert(left.socketId === j1.id, "peer:left socketId matches Guest One");
  log("Guest One left → host received peer:left");

  // 6) Bonus: a freed slot lets Guest Five back in (capacity recovers).
  const pFiveAdmit = waitFor(j5, "room:admitted", { where: "(Guest Five retry)" });
  const pFivePending = waitFor(j5, "waiting:pending", { where: "(Guest Five retry)" });
  const pHostReqFive = waitFor(host, "waiting:request", { where: "(host sees Guest Five)" });
  j5.emit("room:join", { code: CODE, identity: { name: "Guest Five" } });
  await pFivePending;
  const reqFive = await pHostReqFive;
  host.emit("waiting:accept", { socketId: reqFive.socketId });
  await pFiveAdmit;
  log("slot freed → Guest Five admitted on retry");

  console.log("\n✓ ALL waiting-room assertions passed");
  shutdown(0);
} catch (err) {
  console.error("\n✗ FAILED:", err.message);
  shutdown(1);
}
