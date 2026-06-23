import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Room from "@/models/Room";
import { generateRoomCode } from "@/lib/roomCode";

// How long a room lives before the TTL index reaps it.
const ROOM_TTL_HOURS = 24;

// POST /api/rooms — create a room. Logged-in users only (the host).
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  await connectToDatabase();

  const expiresAt = new Date(Date.now() + ROOM_TTL_HOURS * 60 * 60 * 1000);

  // Generate a unique code. The unique index is the real guard; we retry a few
  // times on the rare collision rather than trusting the first random code.
  let room = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      room = await Room.create({
        code: generateRoomCode(),
        host: session.user.id,
        hostName: session.user.name ?? "Host",
        expiresAt,
      });
      break;
    } catch (err) {
      if (err?.code === 11000) continue; // duplicate code, try again
      throw err;
    }
  }

  if (!room) {
    return Response.json(
      { error: "Could not allocate a room code, try again" },
      { status: 503 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const url = `${origin}/room/${room.code}`;

  return Response.json(
    { code: room.code, url, expiresAt: room.expiresAt },
    { status: 201 }
  );
}
