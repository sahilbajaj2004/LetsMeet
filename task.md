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
