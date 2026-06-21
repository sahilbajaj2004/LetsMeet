// Throwaway Phase 0 check: confirm we can reach MongoDB Atlas.
// Run with:  node --env-file=.env.local scripts/test-db.mjs
// (Never logs the connection string / credentials.)
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("✗ MONGODB_URI not set (use --env-file=.env.local)");
  process.exit(1);
}

try {
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const admin = conn.connection.db.admin();
  const ping = await admin.ping();
  console.log("✓ MongoDB connected");
  console.log("  db:", conn.connection.name);
  console.log("  host:", conn.connection.host);
  console.log("  ping:", JSON.stringify(ping));
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error("✗ MongoDB connection failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}
