// Throwaway Phase 0 check: confirm the frontend can reach the signaling server.
// Start the signaling server first (cd signaling && npm start), then run:
//   node --env-file=.env.local scripts/test-signaling.mjs
import { io } from "socket.io-client";

const url = process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000";
console.log("→ connecting to", url);

const socket = io(url, { transports: ["websocket", "polling"], timeout: 8000 });

const fail = (msg) => {
  console.error("✗", msg);
  socket.close();
  process.exit(1);
};

const timer = setTimeout(() => fail("timed out — is the signaling server running?"), 10000);

socket.on("connect", () => {
  console.log("✓ client connected:", socket.id);
  socket.emit("client:ping", { from: "phase0-test" });
});

socket.on("server:hello", (data) => {
  console.log("✓ server hello:", data.message);
});

socket.on("server:pong", (data) => {
  console.log("✓ server pong:", JSON.stringify(data));
  clearTimeout(timer);
  socket.close();
  console.log("✓ frontend ↔ signaling round-trip OK");
  process.exit(0);
});

socket.on("connect_error", (err) => fail("connect_error: " + err.message));
