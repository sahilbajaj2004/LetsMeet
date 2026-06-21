import { connectToDatabase } from "@/lib/mongodb";
import Room from "@/models/Room";

// Single source of truth for "is this room usable?", shared by the validation
// API route and the room page so they can't disagree.
//
// Returns one of:
//   { status: "not_found" }
//   { status: "expired" }
//   { status: "valid", room: { code, hostName, expiresAt } }
//
// Note: a TTL index also deletes expired rooms, but Mongo's TTL sweep runs
// roughly once a minute — so a room can be past its expiry but not yet gone.
// We check the date explicitly to close that window.
export async function lookupRoom(code) {
  if (!code || typeof code !== "string") return { status: "not_found" };

  await connectToDatabase();
  const room = await Room.findOne({ code }).lean();

  if (!room) return { status: "not_found" };
  if (new Date(room.expiresAt) <= new Date()) return { status: "expired" };

  return {
    status: "valid",
    room: {
      code: room.code,
      hostName: room.hostName,
      expiresAt: room.expiresAt,
    },
  };
}

export default lookupRoom;
