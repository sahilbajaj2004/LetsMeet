// Seed one sample user into the `letsmeet` db. Idempotent — upserts by email,
// so re-running won't create duplicates.
// Run with:  node --env-file=.env.local scripts/seed-user.mjs
//
// Self-contained (inline schema) so it runs under plain Node without ESM
// interop against the app's models/User.js. Keep the fields in sync with it.
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI not set (use --env-file=.env.local)");
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    image: { type: String },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

const sample = {
  googleId: "sample-google-id-ada",
  name: "Ada Lovelace",
  email: "ada@example.com",
  image: "https://i.pravatar.cc/150?u=ada@example.com",
};

try {
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log("✓ connected to db:", conn.connection.name);

  const doc = await User.findOneAndUpdate(
    { email: sample.email },
    { $set: sample },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  console.log("✓ sample user ready:");
  console.log("  _id:  ", doc._id.toString());
  console.log("  name: ", doc.name);
  console.log("  email:", doc.email);

  const total = await User.countDocuments();
  console.log("  users in collection:", total);

  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error("✗ seed failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}
