import { connectToDatabase } from "./db.js";
import Room from "../models/Room.js";

// In-memory presence + waiting-room state machine. This is the live source of
// truth for "who is in / waiting for a room"; Mongo only stores room metadata.
// Everything here is ephemeral — if the signaling process restarts, calls drop
// and clients re-knock (v1 reconnection = basic, per AGENTS.md).
//
// Attendee state machine:
//   join → "pending"            (member knocks, waits for host)
//   join → "in_call"            (host bypasses the waiting room)
//   "pending" → "in_call"       (host accepts)
//   "pending" → "declined"      (host declines — terminal)
//   "in_call" → "left"          (disconnect / voluntary leave)
//   "in_call" → "kicked"        (Phase 6 — reserved, not wired yet)

export const MAX_PARTICIPANTS = 4; // mesh cap (AGENTS.md)

// code -> {
//   code, hostId, hostName, hostSocketId,
//   declined: Set<string>,                 // keys blocked from re-knocking
//   attendees: Map<socketId, attendee>,    // attendee = { socketId, identity, role, state }
// }
const registry = new Map();

// --- Mongo validation -------------------------------------------------------

// Reads the room from Mongo. The explicit expiry check mirrors lib/rooms.js in
// the app — TTL sweep lag means a past-expiry room can still exist briefly.
export async function validateRoom(code) {
  if (!code || typeof code !== "string") return { status: "not_found" };

  await connectToDatabase();
  const room = await Room.findOne({ code }).lean();

  if (!room) return { status: "not_found" };
  if (new Date(room.expiresAt) <= new Date()) return { status: "expired" };

  return {
    status: "ok",
    host: room.host ? String(room.host) : null,
    hostName: room.hostName ?? "Host",
  };
}

// --- registry lifecycle -----------------------------------------------------

export function getRoom(code) {
  return registry.get(code) ?? null;
}

// Create the live registry entry on first valid join, stamped with the host id
// read from Mongo so role detection works even before the host connects.
export function ensureRoom(code, hostId, hostName) {
  let room = registry.get(code);
  if (!room) {
    room = {
      code,
      hostId,
      hostName,
      hostSocketId: null,
      declined: new Set(),
      attendees: new Map(),
    };
    registry.set(code, room);
  }
  return room;
}

// Drop the room once nobody is attached, freeing the declined set with it.
export function dropRoomIfEmpty(code) {
  const room = registry.get(code);
  if (room && room.attendees.size === 0) {
    registry.delete(code);
    return true;
  }
  return false;
}

// --- role / blocking --------------------------------------------------------

// Host = the user whose Mongo id matches the room's stored host. Guests (no
// userId) can never be host.
export function roleFor(room, identity) {
  if (identity?.userId && room.hostId && identity.userId === room.hostId) {
    return "host";
  }
  return "member";
}

// Stable-ish block key: real users by id, guests by lowercased name. Guests can
// rename to dodge a decline — best-effort for v1 (see task.md notes).
export function declinedKey(identity) {
  if (identity?.userId) return `user:${identity.userId}`;
  return `guest:${(identity?.name ?? "").trim().toLowerCase()}`;
}

export function isDeclined(room, identity) {
  return room.declined.has(declinedKey(identity));
}

export function markDeclined(room, identity) {
  room.declined.add(declinedKey(identity));
}

// --- attendees / capacity ---------------------------------------------------

export function inCallCount(room) {
  let n = 0;
  for (const a of room.attendees.values()) if (a.state === "in_call") n++;
  return n;
}

export function isFull(room) {
  return inCallCount(room) >= MAX_PARTICIPANTS;
}

export function addAttendee(room, socketId, identity, role, state) {
  const attendee = { socketId, identity, role, state };
  room.attendees.set(socketId, attendee);
  if (role === "host") room.hostSocketId = socketId;
  return attendee;
}

export function getAttendee(room, socketId) {
  return room.attendees.get(socketId) ?? null;
}

export function setState(room, socketId, state) {
  const a = room.attendees.get(socketId);
  if (a) a.state = state;
  return a ?? null;
}

export function removeAttendee(room, socketId) {
  const a = room.attendees.get(socketId);
  if (!a) return null;
  room.attendees.delete(socketId);
  if (room.hostSocketId === socketId) room.hostSocketId = null;
  return a;
}

// In-call peers, minus one socket — used to seed a freshly admitted client and
// to broadcast joins/leaves.
export function listInCall(room, exceptSocketId) {
  const peers = [];
  for (const a of room.attendees.values()) {
    if (a.state === "in_call" && a.socketId !== exceptSocketId) {
      peers.push({ socketId: a.socketId, identity: a.identity, role: a.role });
    }
  }
  return peers;
}
