import { lookupRoom } from "@/lib/rooms";

// GET /api/rooms/:code — validate a room code.
// 200 { status: "valid", room }, 410 expired, 404 not found.
export async function GET(_request, ctx) {
  const { code } = await ctx.params;
  const result = await lookupRoom(code);

  const httpStatus =
    result.status === "valid" ? 200 : result.status === "expired" ? 410 : 404;

  return Response.json(result, { status: httpStatus });
}
