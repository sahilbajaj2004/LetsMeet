import mongoose from "mongoose";

// A room is just metadata — a code, who owns it, and when it dies. Audio/video
// never touches this; that's peer-to-peer. Rooms self-delete via a TTL index
// on `expiresAt`, so there's no cleanup job.
const RoomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Denormalized host name for quick display without a populate/join.
    hostName: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL: MongoDB drops the document once `expiresAt` is in the past.
// expireAfterSeconds:0 means "delete at the date stored in this field".
RoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.Room || mongoose.model("Room", RoomSchema);
