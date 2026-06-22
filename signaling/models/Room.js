import mongoose from "mongoose";

// Read-only mirror of the app's models/Room.js — signaling only does
// `Room.findOne({ code })` to validate a room and read its host. The Next.js app
// owns the canonical schema, the unique index, and the TTL index; we deliberately
// don't redeclare those here (no writes happen from this process).
//
// `strict: false` so we never reject fields the app adds later; we only read the
// few we name. Keep `host` / `expiresAt` in sync with the app schema.
const RoomSchema = new mongoose.Schema(
  {
    code: { type: String },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hostName: { type: String },
    expiresAt: { type: Date },
  },
  { strict: false, collection: "rooms" }
);

export default mongoose.models.Room || mongoose.model("Room", RoomSchema);
