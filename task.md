# LetsMeet — Task Status

Status: ✅ done · 🚧 in progress · ⬜ not started

Legend tracks plan in `AGENTS.md`. Update as work lands.

---

## Phase 0 — Environment & Project Setup ✅

- [x] Next.js frontend created & runs locally (`next 16.2.9`, App Router)
- [x] Tailwind CSS installed (`tailwindcss v4`)
- [x] Signaling server folder (`signaling/`) created (Express 5 + Socket.io 4, ESM)
- [x] Signaling server runs locally on port 4000 (`GET /` health, `npm start`)
- [x] MongoDB Atlas cluster reachable — connected to `letsmeet` db (host `letsmeet.dba0wix.mongodb.net`, SRV resolves 3 shards, ping ok)
- [x] `MONGODB_URI` in `.env.local` (validated via `scripts/test-db.mjs`)
- [x] `mongoose` installed (`^9.7`) + `lib/mongodb.js` cached-connection helper
- [x] Google OAuth credentials created (console.cloud.google.com)
- [x] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` in `.env.local`
- [x] `next-auth` installed (**v4** `^4.24` — matches the `NEXTAUTH_*` / `GOOGLE_*` env names already set; v5/Auth.js would need them renamed to `AUTH_*`)
- [x] CORS on signaling allows `localhost:3000` (`CLIENT_ORIGIN` env)
- [x] `NEXT_PUBLIC_SIGNALING_URL` in `.env.local`
- [x] `socket.io-client` installed
- [x] Frontend ↔ signaling round-trip confirmed both ends (`scripts/test-signaling.mjs`: client got hello + pong; server logged connect/ping/disconnect)

**Phase 0 notes**
- Structure: Next app at repo root; `signaling/` is a sibling subproject (own `package.json`, own deploy root → Render/Railway). Server deps: `express`, `cors`, `socket.io`, `dotenv`.
- Secrets: `.env.local` is gitignored & untracked (confirmed). `signaling/.env` (`PORT`, `CLIENT_ORIGIN`) gitignored too.
- Throwaway checks in `scripts/`: `test-db.mjs`, `test-signaling.mjs`.
- Run locally: frontend `npm run dev` (:3000); signaling `cd signaling && npm start` (:4000).
- Repo is **Next 16** (plan targets 14): Turbopack default, async request APIs, `middleware`→`proxy`. Follow `node_modules/next/dist/docs/` over the plan where they differ.

## Phase 1 — Authentication ✅

- [x] NextAuth + Google provider integrated (v4 handler at `app/api/auth/[...nextauth]/route.js`, config in `lib/auth.js`)
- [x] "Sign in with Google" login page (`app/login/page.jsx` — server guard redirects authed users away)
- [x] Session handling + protected routes (`AuthProvider` SessionProvider in layout; `/dashboard` guarded via `getServerSession` → 307 to `/login?callbackUrl=`)
- [x] Logged-in user data (name, avatar, email) accessible frontend (`NavAuth` `useSession`) + backend (`getServerSession` in dashboard)

**Phase 1 notes**
- NextAuth **v4** App Router: single catch-all `route.js` exports `handler as GET, POST`. JWT session strategy (no DB adapter yet — User collection is Phase 2). `session.user.id` exposed via jwt/session callbacks.
- Verified live: `/api/auth/providers` lists google; `/api/auth/session` `{}` unauth; `/dashboard` → 307 `/login?callbackUrl=/dashboard`; `/login` 200 w/ button. No log errors.
- **Not yet tested:** real Google consent round-trip (needs human browser click-through + OAuth redirect URI `http://localhost:3000/api/auth/callback/google` registered in Google console — already configured per Phase 0).
- Avatar uses plain `<img>` (Google `lh3` host not in next/image allowlist; avatars tiny). Revisit if adding `next.config` `images.remotePatterns`.
- Landing "Start a call" CTAs now → `/login`. Nav shows avatar + sign-out menu when authed.

## Phase 2 — Room Creation & Database ✅

- [x] Mongoose schemas: `models/User.js`, `models/Room.js` (TTL index `{expiresAt:1}, expireAfterSeconds:0` — verified live in Mongo)
- [x] Create Room flow (logged-in only): `POST /api/rooms` (getServerSession-gated, unique code w/ retry, 24h expiry) → `{code, url}`; `CreateRoom` UI on dashboard reveals code + copyable link
- [x] Room validation route: `GET /api/rooms/[code]` → 200 valid / 410 expired / 404 not_found (shared `lib/rooms.js#lookupRoom`)
- [x] "Room not found / expired" UI state: `app/room/[code]/page.jsx` (valid / expired / not-found); `JoinByCode` form routes here

**Phase 2 notes**
- User persistence: `lib/auth.js` jwt callback upserts the Google user into `letsmeet.users` on sign-in and stamps `token.id = mongo _id`. So `session.user.id` (and `Room.host`) is the **DB id**, not Google's `sub`. (Until a real Google login runs, the `users` collection only has the seeded sample user.)
- Code format `abc-defg-hij` via `lib/roomCode.js` (Crockford-ish alphabet, no 0/1/l/o). Unique index is the real guard; route retries 5× on collision.
- `lookupRoom` checks `expiresAt <= now` explicitly — TTL sweep runs ~60s, so a room can be past-expiry but not yet deleted; the date check closes that window (verified: got `expired` 410 within the window, `not_found` 404 after sweep).
- Shareable URL built from `NEXTAUTH_URL` ?? request origin.
- Verified live (curl): valid 200, expired 410, not_found 404, unauth create 401, room page renders all 3 states. No log errors.
- **Not tested:** create via real session cookie (needs Google login); covered indirectly — route logic + 401 guard confirmed.
- Throwaway: `scripts/seed-user.mjs`, `scripts/test-rooms.mjs` (`clean` arg to remove test rooms).

## Phase 3 — Signaling Server Core ✅

- [x] Socket.io connect/disconnect + room join events (`signaling/index.js` handlers; `room:join` validates room via Mongo)
- [x] Waiting room state machine (pending → in_call → left; pending → declined; kicked reserved for Phase 6) in `signaling/lib/rooms.js`
- [x] Host-side incoming join requests (`waiting:request` to host socket; queued requests replayed if host connects after waiters)
- [x] Accept/decline events propagated (`waiting:accept`→`room:admitted`+`peer:joined`; `waiting:decline`→`room:declined`, re-knock blocked)

**Phase 3 notes**
- Signaling now holds its **own read-only Mongo connection** (`signaling/lib/db.js` + `signaling/models/Room.js`, `strict:false`, collection `rooms`). On `room:join` it reads the room to validate exists/expired and to learn `room.host`. Mongo connects on boot (`[db] connected`, fail-fast). Added `mongoose ^9.7` to `signaling/package.json`, `MONGODB_URI` to `signaling/.env` (gitignored).
- **Event contract** (frontend Phase 8 must match):
  - C→S: `room:join {code, identity}` · `waiting:accept {socketId}` · `waiting:decline {socketId}` · `room:leave`
  - S→C: `room:rejected {reason: not_found|expired|error}` · `room:full` · `room:declined` · `waiting:pending` · `room:admitted {selfId, role, peers[]}` · `waiting:request {socketId, identity}` (host) · `waiting:cancelled {socketId}` (host) · `peer:joined {socketId, identity, role}` · `peer:left {socketId}` · `host:left {socketId}` · `waiting:error {socketId, reason}` (host, accept past cap)
  - identity `{userId?, name, image?, isGuest}`; role `host|member`.
- **Host = `room.host` (Mongo id) == joiner `identity.userId`.** Host bypasses waiting room (auto `in_call`). Guests (no userId) never host. Capacity **4** enforced at both join (5th → `room:full`, no waiting entry) and accept (cap reached → `waiting:error`). Members are NOT in the socket.io `code` broadcast group until admitted (no call leakage while pending).
- Registry is **in-memory** (`Map<code, room>`); process restart drops calls (v1 = basic reconnect: refresh + re-knock). Room entry dropped when last attendee leaves → declined set forgotten with it.
- **Trust:** signaling compares client-sent `identity.userId` to DB `room.host`. Host id is never exposed by any public API/page (only `hostName` is), so not guessable. Future hardening: signed join token.
- **Declined-key limitation:** blocked key is `user:<id>` for logged-in, `guest:<lowercased name>` for guests → a guest can rename to dodge a decline. Best-effort v1, Phase 9 hardening.
- **Deferred:** WebRTC offer/answer/ICE relay → Phase 4. Host kick/mute/end-for-all → Phase 6 (`host:left` currently just notifies, no teardown).
- Verified live (`scripts/test-waiting-room.mjs`, throwaway): host bypass · pending+request · accept→admitted+peer:joined · decline+re-knock block · 4-cap→room:full · leave→peer:left · freed-slot retry. Plus inline probe: not_found, expired, host:left. No server error/warn lines. `clean` arg drops the seeded room.
- Run locally: signaling `cd signaling && npm start`; test `node --env-file=.env.local scripts/test-waiting-room.mjs`.

## Phase 4 — WebRTC Core (2-person) ✅ (media = manual test)

- [x] `getUserMedia` camera/mic capture (`room-client.jsx` captures on mount, reused for call + self-preview)
- [x] `RTCPeerConnection` between 2 users (`app/room/[code]/use-webrtc.js`)
- [x] offer/answer/ICE exchange via signaling (`webrtc:offer|answer|ice` relay in `signaling/index.js`; node-verified)
- [x] 1-on-1 call working end to end (functional UI; **manual two-browser confirmation pending** — see note)
- [~] TURN/STUN config: STUN wired (`lib/ice.js`, Google default). **TURN creds + off-wifi NAT test deferred → Phase 9.**

**Phase 4 notes**
- **Relay events** (forward-only; server never parses SDP/ICE; both ends must be `in_call` same room): `webrtc:offer {to,sdp}`→`{from,sdp}`, `webrtc:answer`, `webrtc:ice {to,candidate}`→`{from,candidate}`. Added to `signaling/index.js`.
- **Initiator rule (no glare, scales to mesh):** the peer already in the call offers to the newcomer. Existing peer on `peer:joined`→`createOffer`; newcomer from `room:admitted.peers`→opens pc, waits for offer.
- **ICE-candidate queue:** candidates arriving before `setRemoteDescription` are buffered per-peer and flushed after — fixes the classic race.
- **ICE config** `lib/ice.js`: `NEXT_PUBLIC_STUN_URLS` (default `stun:stun.l.google.com:19302`, works zero-config) + optional `NEXT_PUBLIC_TURN_URL/_USER/_CRED`. Commented in `.env.local`.
- **Client structure (React state, no Zustand yet — Zustand lands Phase 5 mesh):** `app/room/[code]/page.jsx` (server validity gate) → renders `RoomClient` for valid rooms. `room-client.jsx` phase machine: `prejoin→connecting→waiting→in_call` + terminal `declined|full|rejected|ended`. Socket lazy-init (stable ref), reconnect-on-mount for StrictMode. Hook `use-webrtc.js` owns pcs Map + remoteStreams/peers state. Components in `app/_components/room/`: `pre-join`, `waiting-view`, `host-approve`, `video-tile`.
- This builds a **functional** waiting-room + call UI now; **Phase 8 polishes** it (and formalizes identity display — guest=name only already honored).
- **Verify:**
  - Relay (node, automated): `node --env-file=.env.local scripts/test-webrtc-relay.mjs` — offer/answer/ice forwarded with `from`; non-`in_call` relay dropped. `clean` arg removes seeded room. ✅ passed.
  - `npm run build` ✅ compiles (Next 16 build does **not** gate on ESLint; lint advisory). `npm run lint` clean for Phase 4 files (img `<img>` warnings only, same as existing `nav-auth.jsx`).
  - **Media (manual, REQUIRED — getUserMedia/RTCPeerConnection can't be node-scripted):** `cd signaling && npm start` + `npm run dev`. Tab A signed-in → create room → open → allow camera (host, auto-admitted). Tab B incognito → open link → type guest name → allow camera → knock → host Accepts. Confirm both tiles show live video/audio; Tab B Leave → host sees tile drop (`peer:left`); host Leave → Tab B sees "host ended" (`host:left`). Same-network works on STUN; cross-network/TURN is Phase 9. Debug via `chrome://webrtc-internals`.
- **Deferred:** mic/cam toggle + screen share → Phase 7; host kick/mute/end-for-all → Phase 6 (`host:left` currently notifies only, no teardown).

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

## Room Lifecycle — Idle Expiry ⬜

**Requirement:** a room auto-deletes **1 hour after it goes idle** — i.e. nobody
is actively joined to the link. A created-but-never-joined room also dies 1h
after creation. Active rooms stay alive; the clock only counts idle time.

- [ ] Change Phase 2's fixed 24h `expiresAt` → rolling 1h window (`expiresAt = now + 1h` on create)
- [ ] Signaling server (Phase 3) bumps `expiresAt = now + 1h` on each join / presence heartbeat while ≥1 participant is connected
- [ ] When the last participant leaves, leave `expiresAt` as-is → TTL reaps the room ~1h later if no one rejoins
- [ ] Path for signaling → DB write (internal API route `PATCH /api/rooms/[code]/touch`, or signaling holds its own Mongo connection)
- [ ] Keep existing TTL index (`{expiresAt:1}, expireAfterSeconds:0`) — only the value written changes; Mongo TTL sweep (~60s) does the deletion
- [ ] Edge: TTL sweep lag means a room can be 1h+ idle but not yet gone — `lookupRoom` already rejects past-expiry rooms explicitly, so joiners still see "expired"

**Depends on:** Phase 3 (signaling tracks who's connected — that's the only
source of "active"). Until then, rooms use the simple time-based expiry.

---

## Open Items (undecided)

- [ ] Reconnection depth: basic refresh (v1 default) vs auto recovery
- [ ] Call recording via Cloudinary (future?)
- [ ] Participant cap > 4 (would need SFU — major rearchitecture)
