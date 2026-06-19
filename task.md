# LetsMeet — Task Status

Status: ✅ done · 🚧 in progress · ⬜ not started

Legend tracks plan in `AGENTS.md`. Update as work lands.

---

## Phase 0 — Environment & Project Setup 🚧

- [x] Next.js frontend created & runs locally (`next 16.2.9`, App Router)
- [x] Tailwind CSS installed (`tailwindcss v4`)
- [ ] Signaling server folder (`signaling/`) created (Express + Socket.io)
- [ ] Signaling server runs locally on port 4000
- [ ] MongoDB Atlas / local cluster set up
- [ ] `MONGODB_URI` in `.env.local`
- [ ] `mongoose` installed
- [ ] Google OAuth credentials created (console.cloud.google.com)
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` in `.env.local`
- [ ] `next-auth` installed
- [ ] CORS on signaling allows `localhost:3000`
- [ ] `NEXT_PUBLIC_SIGNALING_URL` in `.env.local`
- [ ] `socket.io-client` installed
- [ ] Frontend ↔ signaling test connection confirmed both ends

## Phase 1 — Authentication ⬜

- [ ] NextAuth + Google provider integrated
- [ ] "Sign in with Google" login page
- [ ] Session handling + protected routes
- [ ] Logged-in user data (name, avatar, email) accessible frontend + backend

## Phase 2 — Room Creation & Database ⬜

- [ ] Mongoose schemas: User, Room (TTL index on expiry)
- [ ] Create Room flow (logged-in only) → room code + shareable link → saved
- [ ] Room validation route (valid / expired / not found)
- [ ] "Room not found / expired" UI state

## Phase 3 — Signaling Server Core ⬜

- [ ] Socket.io connect/disconnect + room join events
- [ ] Waiting room state machine (pending → accepted/declined → in-call → left/kicked)
- [ ] Host-side incoming join requests
- [ ] Accept/decline events propagated to waiting user

## Phase 4 — WebRTC Core (2-person) ⬜

- [ ] `getUserMedia` camera/mic capture
- [ ] `RTCPeerConnection` between 2 users
- [ ] offer/answer/ICE exchange via signaling
- [ ] 1-on-1 call working end to end
- [ ] TURN/STUN config + tested off home wifi (NAT check)

## Phase 5 — Mesh Scaling to 4 ⬜

- [ ] Multi-peer connection logic (each peer ↔ every peer)
- [ ] Quality tested at 3 and 4 participants
- [ ] Participant-leave cleanup on all sides

## Phase 6 — Host Controls ⬜

- [ ] Host UI: participant list + mute/kick buttons + end-call-for-all
- [ ] Kick event (force disconnect + remove from room)
- [ ] Mute event (client-enforced)
- [ ] End-call-for-all broadcast + room teardown

## Phase 7 — Member Controls & Screen Share ⬜

- [ ] Mute self / camera toggle / leave (all participants)
- [ ] `getDisplayMedia` screen share (everyone)
- [ ] One-active-share-at-a-time via Socket.io broadcast
- [ ] Camera ↔ screen swap via `replaceTrack()`
- [ ] Native "Stop sharing" detect via `track.onended` → auto-revert

## Phase 8 — Identity Display & Polish ⬜

- [ ] Logged-in: full name + avatar
- [ ] Guest: typed name only, no avatar / placeholder
- [ ] Waiting room UI (joiner "waiting" view vs host "approve" view)

## Phase 9 — Testing & Deployment ⬜

- [ ] Deploy frontend → Vercel
- [ ] Deploy signaling → Render / Railway
- [ ] Full flow tested across different networks
- [ ] TURN fallback confirmed when STUN fails
- [ ] Room TTL deletion confirmed in MongoDB
- [ ] 5th joiner rejected ("room full")
- [ ] Kicked/declined users can't rejoin via same link

---

## Open Items (undecided)

- [ ] Reconnection depth: basic refresh (v1 default) vs auto recovery
- [ ] Call recording via Cloudinary (future?)
- [ ] Participant cap > 4 (would need SFU — major rearchitecture)
