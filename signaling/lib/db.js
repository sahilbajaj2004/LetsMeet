import mongoose from "mongoose";

// Read-only Mongo connection for the signaling server. It only validates rooms
// and reads `room.host` — the Next.js app owns the schema, TTL index, and all
// writes. Cached so repeated joins reuse one connection (mirror of the app's
// lib/mongodb.js).
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI in environment (signaling/.env)");
}

let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

export default connectToDatabase;
