import { randomBytes } from "crypto";

// Crockford-ish alphabet: no 0/1/l/o to avoid look-alike confusion when a code
// is read aloud or typed from a shared link.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

// Returns a code shaped like `abc-defg-hij` (10 chars). 32^10 ≈ 1.1e15
// combinations — collisions are vanishingly rare, but callers still check the
// DB and retry to be safe.
export function generateRoomCode() {
  const bytes = randomBytes(10);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7, 10)}`;
}

export default generateRoomCode;
