// Throwaway Phase 2 check. Inserts a valid + an expired room and prints the
// TTL index, so the validation API and room page can be exercised by curl.
//   node --env-file=.env.local scripts/test-rooms.mjs         # seed
//   node --env-file=.env.local scripts/test-rooms.mjs clean   # remove them
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI not set (use --env-file=.env.local)");
  process.exit(1);
}

const RoomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hostName: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
RoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Room = mongoose.models.Room || mongoose.model("Room", RoomSchema);

const VALID = "test-valid-001";
const EXPIRED = "test-expired-01";
const clean = process.argv[2] === "clean";

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });

  if (clean) {
    const r = await Room.deleteMany({ code: { $in: [VALID, EXPIRED] } });
    console.log(`✓ removed ${r.deletedCount} test room(s)`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const host = new mongoose.Types.ObjectId();
  await Room.deleteMany({ code: { $in: [VALID, EXPIRED] } });
  await Room.create([
    { code: VALID, host, hostName: "Ada Lovelace", expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    { code: EXPIRED, host, hostName: "Ada Lovelace", expiresAt: new Date(Date.now() - 60 * 60 * 1000) },
  ]);
  await Room.syncIndexes();

  console.log("✓ seeded:", VALID, "(valid),", EXPIRED, "(expired)");
  const idx = await Room.collection.indexes();
  const ttl = idx.find((i) => "expireAfterSeconds" in i);
  console.log("✓ TTL index:", ttl ? JSON.stringify({ key: ttl.key, expireAfterSeconds: ttl.expireAfterSeconds }) : "MISSING");

  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error("✗ failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}
