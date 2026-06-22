// Throwaway Phase 4 check: the signaling server relays WebRTC offer/answer/ICE
// between two in-call peers and drops relays from non-members. This tests the
// relay layer only (opaque payloads) — real getUserMedia/RTCPeerConnection is
// browser-only and verified manually with two tabs.
//
// Start the signaling server first (cd signaling && npm start), then run:
//   node --env-file=.env.local scripts/test-webrtc-relay.mjs
//   node --env-file=.env.local scripts/test-webrtc-relay.mjs clean
import mongoose from "mongoose";
import { io } from "socket.io-client";

const URL = process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000";
const MONGODB_URI = process.env.MONGODB_URI;
const CODE = "tst-webrtc-relay";

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

if (process.argv[2] === "clean") {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const r = await Room.deleteOne({ code: CODE });
  console.log(`✓ removed test room (${r.deletedCount} doc)`);
  await mongoose.disconnect();
  process.exit(0);
}

const sockets = [];
function connect() {
  const s = io(URL, { forceNew: true, transports: ["websocket"], timeout: 8000 });
  sockets.push(s);
  return s;
}
function waitFor(socket, event, { ms = 6000, where = "", predicate } = {}) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, h);
      reject(new Error(`timeout waiting "${event}" ${where}`));
    }, ms);
    function h(p) {
      if (predicate && !predicate(p)) return;
      clearTimeout(t);
      socket.off(event, h);
      resolve(p);
    }
    socket.on(event, h);
  });
}
function expectNot(socket, event, ms = 800) {
  return new Promise((resolve, reject) => {
    function h(p) {
      clearTimeout(t);
      socket.off(event, h);
      reject(new Error(`unexpected "${event}": ${JSON.stringify(p)}`));
    }
    const t = setTimeout(() => {
      socket.off(event, h);
      resolve();
    }, ms);
    socket.on(event, h);
  });
}
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const log = (m) => console.log("✓", m);
function shutdown(code) {
  for (const s of sockets) s.close();
  mongoose.disconnect().catch(() => {});
  process.exit(code);
}

try {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const hostId = new mongoose.Types.ObjectId();
  await Room.findOneAndUpdate(
    { code: CODE },
    {
      $set: {
        code: CODE,
        host: hostId,
        hostName: "Relay Host",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  log(`seeded room ${CODE}`);

  // Host joins (auto-admitted) and learns its own socketId.
  const host = connect();
  await waitFor(host, "connect", { where: "(host)" });
  const pHostAdmit = waitFor(host, "room:admitted", { where: "(host)" });
  host.emit("room:join", {
    code: CODE,
    identity: { userId: hostId.toString(), name: "Relay Host" },
  });
  const hostSelfId = (await pHostAdmit).selfId;

  // Member knocks, host accepts → both now in_call and know each other's ids.
  const member = connect();
  await waitFor(member, "connect", { where: "(member)" });
  const pPending = waitFor(member, "waiting:pending");
  const pReq = waitFor(host, "waiting:request");
  member.emit("room:join", { code: CODE, identity: { name: "Relay Member" } });
  await pPending;
  const memberId = (await pReq).socketId;

  const pMemberAdmit = waitFor(member, "room:admitted", { where: "(member)" });
  host.emit("waiting:accept", { socketId: memberId });
  const admit = await pMemberAdmit;
  assert(admit.peers?.[0]?.socketId === hostSelfId, "member should see host as peer");
  log("host + member both in_call");

  // offer: member → host
  const pOffer = waitFor(host, "webrtc:offer", { where: "(host)" });
  member.emit("webrtc:offer", { to: hostSelfId, sdp: "SDP_OFFER" });
  const offer = await pOffer;
  assert(offer.from === memberId && offer.sdp === "SDP_OFFER", "offer relayed with from+sdp");
  log("webrtc:offer relayed member → host (carries from + sdp)");

  // answer: host → member
  const pAnswer = waitFor(member, "webrtc:answer", { where: "(member)" });
  host.emit("webrtc:answer", { to: memberId, sdp: "SDP_ANSWER" });
  const answer = await pAnswer;
  assert(answer.from === hostSelfId && answer.sdp === "SDP_ANSWER", "answer relayed");
  log("webrtc:answer relayed host → member");

  // ice: member → host
  const pIce = waitFor(host, "webrtc:ice", { where: "(host)" });
  member.emit("webrtc:ice", { to: hostSelfId, candidate: { candidate: "x" } });
  const ice = await pIce;
  assert(ice.from === memberId && ice.candidate?.candidate === "x", "ice relayed");
  log("webrtc:ice relayed member → host");

  // negative: a pending (not in_call) socket can't relay
  const intruder = connect();
  await waitFor(intruder, "connect", { where: "(intruder)" });
  const pIntruderPending = waitFor(intruder, "waiting:pending");
  intruder.emit("room:join", { code: CODE, identity: { name: "Intruder" } });
  await pIntruderPending; // pending, never admitted
  const pNoLeak = expectNot(host, "webrtc:offer");
  intruder.emit("webrtc:offer", { to: hostSelfId, sdp: "EVIL" });
  await pNoLeak;
  log("relay from non-in_call socket dropped (host received nothing)");

  console.log("\n✓ ALL relay assertions passed");
  shutdown(0);
} catch (err) {
  console.error("\n✗ FAILED:", err.message);
  shutdown(1);
}
