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

## Phase 5 — Mesh Scaling to 4 ✅ (media = manual test)

- [x] Multi-peer connection logic (each peer ↔ every peer) — already mesh-ready from Phase 4 (all keyed by socketId), verified the 4-way path
- [x] Per-peer capture + send-bitrate tuning so the mesh holds at 4 (`lib/media.js`)
- [x] Per-tile connection status ("Connecting…/Reconnecting…")
- [x] Participant-leave cleanup on all sides (`peer:left`→`closePeer`; hard drops via `onconnectionstatechange`)
- [~] Quality at 3 & 4 — manual multi-window test pending

**Phase 5 notes**
- Mesh was written mesh-ready in Phase 4: `use-webrtc.js` keys pcs/ICE/streams/peers by socketId, `ensurePeer` idempotent, no-glare initiator rule; signaling already sends `listInCall` to newcomers + enforces cap 4. So **no signaling/peer rewrite** — Phase 5 = UX + media tuning.
- **NEW `lib/media.js`** — `CAPTURE_CONSTRAINTS` (640×480 @24fps) + `MAX_VIDEO_BITRATE` (500 kbps). getUserMedia uses the constraints; `ensurePeer` caps each video sender via `setParameters` so 3 uplinks fit a home connection. Phase 7 screen share reuses these.
- `use-webrtc.js` exposes `peerStates` (socketId→connectionState); `video-tile.jsx` shows the connecting pill until `connected`.
- **Decision:** kept React state (no Zustand) — current useState/useRef mesh is clean; switching adds no behavior.
- Verify: `npm run lint` clean. Manual: 4 windows on one room → 3 remote tiles each (2×2); leave drops a tile; `chrome://webrtc-internals` shows ≤500 kbps out, ~640×480.

## Phase 6 — Host Controls ✅

- [x] Host UI: participant list + per-peer mute/kick + end-call-for-all (`host-controls.jsx`, floating panel)
- [x] Kick event (block re-entry + remove + others clean up via `peer:left`)
- [x] Mute event (client-enforced — server tells the target to disable its own mic)
- [x] End-call-for-all broadcast + room teardown (`room:ended` + `endRoom`)
- [x] **Host camera-off** — host turns OFF a participant's camera, mirrors host-mute: `host:cam-off` event (server gated by `hostRoomFor`, target must be `in_call` non-host) → target client `setCamOn(false)` → the `camOn` video-track-`.enabled` effect enforces it. "Cam off" button sits between Mute and Kick in `host-controls.jsx`.

**Phase 6 notes**
- Server (`signaling/`): new `endRoom(code)` in `lib/rooms.js`; three handlers in `index.js`, all guarded by existing `hostRoomFor`:
  - `host:mute {socketId}` → `host:muted` to target (no server state).
  - `host:kick {socketId}` → `markDeclined` (blocks re-knock, reuses decline set) + `removeAttendee` + `room:kicked` to target + `peer:left` to others.
  - `host:end` → `room:ended` to all + evict sockets + `endRoom`.
  - Host disconnect now also evicts + tears the room down (old `host:left` TODO closed).
- Client (`room-client.jsx`): `micOn` flag drives audio `track.enabled` (one source of truth for self-toggle + host-mute). Actions `toggleMic/mute/kick/endCall`; listeners `host:muted`→mute, `room:kicked`→kicked screen, `room:ended`→ended screen; new terminal `kicked` phase.
- **Pulled forward from Phase 7:** self Mute/Unmute now exists (host-mute needs the target able to unmute). Camera toggle + screen share stay Phase 7.
- **Decision:** mute is quiet — only the target is told; no per-tile mute-state broadcast (Phase 7/8). Your own mic-off shows a badge on your tile.
- Verify: `npm run lint` clean; `node --check` on signaling files OK. Manual across windows: host mute/kick/end; kicked re-knock blocked; non-host `host:*` = no-op.

## UI Pass — Full-viewport layout & immersive call ✅

- [x] Every page fills the viewport (sticky footer) — `body`→`flex min-h-dvh flex-col`, page `<main>`→`flex-1` (kills the mid-screen footer + blank gap)
- [x] Room call is immersive full-bleed (`fixed inset-0 z-50`, nav hidden), Meet-style
- [x] Responsive tile grid by count (1 full · 2 split · 3 two-over-centered · 4 2×2; portrait stacks) — tiles fill their cells (`callGridClass`; `video-tile` drops fixed aspect)
- [x] Floating control pill (Mute/Unmute · Manage · Leave) + room chip; host's waiting-requests + mute/kick/end in a floating top-right panel (Manage toggle, pending badge)

**UI notes**
- Files: `app/layout.jsx`, `app/dashboard/page.jsx`, `app/page.jsx`, `app/room/[code]/page.jsx` (shell); `room-client.jsx` + `video-tile.jsx` (call). Self mic-off badge on own tile.
- Non-call screens (pre-join / waiting / notices) keep the nav + centered layout.
- Verify: `npm run lint` clean. Manual: dashboard footer pins to bottom; call fills the screen and rearranges at 1/2/3/4.

## Phase 7 — Member Controls & Screen Share ✅ (media = manual test)

- [x] Mute self + leave (all participants) — shipped in Phase 6 / UI pass
- [x] Camera on/off toggle (all participants) — `camOn` flag → video track `.enabled` (same one-source-of-truth pattern as `micOn`); "Stop video/Start video" in the control bar
- [x] `getDisplayMedia` screen share (everyone) — control-bar "Share screen/Stop sharing"
- [x] One-active-share-at-a-time via Socket.io broadcast (`share:active`/`share:inactive`, slot held in `room.sharingSocketId`)
- [x] Screen share = **second video track** (camera stays live) via add-track + renegotiation; mid-share joiners handled in `ensurePeer`
- [x] Meet-style PiP — presenter's screen is the big tile, their **face cam shows in a top-corner circle** for everyone (the reason for the two-track model)
- [x] Native "Stop sharing" detect via `track.onended` → auto-revert (drops the screen track, camera continues)
- [x] **Pre-join mic/cam toggle** — lobby preview has Mic/Camera pill toggles; the chosen state is carried in `room:join {media}` and applied from the first frame in-call
- [x] **Media-state broadcast** (`media:update`→`peer:media`) — peers know each other's live mic/cam, so a remote camera-off now shows the **avatar** (not a frozen frame) and the host panel reflects live camera state
- [x] **Host camera toggle both ways** — `host:cam {on}` turns a participant's camera off AND back on (button label flips Cam off ⇄ Cam on). Mic stays **mute-only** by design (host can't silently reopen a mic)

**Phase 7 notes**
- **Camera toggle** mirrors Phase 6 mic exactly: `camOn` state + an effect setting `localStream` video tracks' `.enabled`. Self-toggle and host cam toggle both flip `camOn`. Self tile shows the initials avatar when off (`VideoTile` uses the explicit `videoOn` prop so the switch tracks React state, not the lagging DOM flag).
- **Media-state model (this pass).** Every attendee carries `media:{mic,cam}` server-side (`rooms.js`), defaulted from the pre-join choice. A client publishes its own state via `media:update` whenever `micOn`/`camOn` change in-call; the server stores it and fans out `peer:media` to the room. `listInCall` + `peer:joined` now include `media`, so a late joiner renders the right avatar/badge from the first frame. **This closed the earlier "remote camera-off = frozen black frame" gap:** the receiver's track stays `.enabled` even after the sender disables it, so tiles trust the explicit `media.cam`/`camOff` flag, not the track. Mute is no longer "quiet" — a peer's mute now shows the mic-off badge on their tile.
- **Pre-join mic/cam.** `PreJoin` shows Mic/Camera pill toggles over the lobby preview (camera-off hides the preview → "Camera off" placeholder, since a disabled track would otherwise freeze on the last frame). `knock()` sends `room:join {media:{mic,cam}}`; the cam-enforcement effect already runs in the lobby so the local track is disabled immediately.
- **Host camera both-ways.** `host:cam {socketId, on}` replaces the old one-way `host:cam-off`. Target client sets `camOn` to the requested state → its cam effect enforces it → its `media:update` echoes the new state back, which updates the host's button label (Cam off ⇄ Cam on) and the target's tile everywhere. Per the product call, **mic is mute-only** — there is deliberately no host-unmute.
- **Screen share — two-track model (rewritten from the initial replaceTrack swap).** The first cut swapped camera→screen on one sender; that made the presenter's face vanish AND fed an infinity mirror on the self-tile. Now the presenter **keeps the camera track and ADDS the screen as a second video track** (`addScreenShare` → `pc.addTrack` on every pc → `renegotiate`), so peers receive two videos and render screen-big + face-circle. `removeScreenShare` drops the screen sender + renegotiates back. Mid-share joiners get the screen track in `ensurePeer` (in their initial offer, no extra round-trip). Self-tile stays on the camera with a "Presenting" badge — never shows its own screen (no mirror).
- **Screen share — two-track model (rewritten from the initial replaceTrack swap).** The first cut swapped camera→screen on one sender; that made the presenter's face vanish AND fed an infinity mirror on the self-tile. Now the presenter **keeps the camera track and ADDS the screen as a second video track** (`addScreenShare` → `pc.addTrack` on every pc → `renegotiate`), so peers receive two videos and render screen-big + face-circle. `removeScreenShare` drops the screen sender + renegotiates back. Mid-share joiners get the screen track in `ensurePeer` (in their initial offer, no extra round-trip). Self-tile stays on the camera with a "Presenting" badge — never shows its own screen (no mirror).
  - **Renegotiation is safe from glare:** only the presenter ever re-offers, and the original handshake is long-settled (`stable`). The existing `onOffer`/`onAnswer` handlers already apply a fresh offer to an existing pc, so no new signaling path was needed.
  - **Receiver classification by stream id:** a presenting peer's two streams are told apart by `MediaStream.id`, relayed over the socket (`share:active {socketId, streamId}`), NOT by SDP guessing. `use-webrtc` buffers all received streams per peer (`peerStreamsRef`) and re-resolves camera vs screen whenever a track arrives or the screen id lands — race-safe in either order. Exposes `remoteScreens` (screen feed) alongside `remoteStreams` (camera) + `setPeerScreen()`.
  - **Audio rides the camera stream** (screen capture is video-only, `SCREEN_CAPTURE_CONSTRAINTS.audio:false`). So the face-circle `<video>` is **unmuted** on remote tiles — muting it would kill the presenter's voice while the screen (now the main tile) has no audio track.
- **One-at-a-time** is server-arbitrated: `room.sharingSocketId` + `room.sharingStreamId` are the single slot. `share:start {streamId}` claims it (ignored if held by another), `share:stop`/leave/kick/disconnect frees it; both broadcast `share:active`/`share:inactive` → clients set `activeSharer` (disables everyone else's Share button) and `setPeerScreen` (splits that peer's two videos). Newly-admitted clients are caught up via a targeted `share:active` carrying the streamId. Self id captured from `room:admitted.selfId` (mirrored to `selfIdRef` for the listeners).
- **Native "Stop sharing"**: `screenTrack.onended` → `stopShare()` (removeScreenShare + releases slot). `stopShare` nulls `onended` before `track.stop()` so the button path doesn't double-fire.
- **`lib/media.js`** — screen share gets its own `SCREEN_CAPTURE_CONSTRAINTS` (10–15fps, no audio) + `SCREEN_MAX_BITRATE` (1.5 Mbps, higher than the 500 kbps camera cap since it's the focus and carries text). Screen track gets `contentHint="detail"` to favour sharpness over motion. Only one sharer at a time, so the extra uplink doesn't stack across the mesh.
- **`VideoTile`** — letterboxes the screen (`object-contain` + black bg) so code isn't cropped; adds the `overlayStream` face-circle (top-left, ringed, falls back to an initials bubble when the presenter's cam is off — driven by the explicit `camOff` flag since the receiver track stays enabled).
- **Event contract** — C→S: `room:join {…, media}` · `media:update {mic,cam}` · `host:cam {socketId, on}` · `host:mute {socketId}` · `share:start {streamId}` · `share:stop`. S→C: `host:cam {on}` (target) · `host:muted` (target) · `peer:media {socketId, media}` (room) · `peer:joined {…, media}` · `share:active {socketId, streamId}` · `share:inactive {socketId}` (room).
- Verify: `node --check` signaling OK, `npm run lint` clean, `npm run build` ✅. **Manual (REQUIRED — getDisplayMedia/renegotiation can't be node-scripted):** 2+ windows in a room → A clicks Share screen, picks a window → B sees A's **screen as the big tile with A's face in a top-corner circle**, code stays crisp, A still hears/sees nothing weird (A's own tile = camera + "Presenting" badge, no mirror); B's Share button greys out ("Someone else is sharing"). A clicks browser "Stop sharing" → both revert to A's camera, B's button re-enables. A third person joining mid-share immediately sees the screen+circle. `chrome://webrtc-internals` shows the presenter with two outbound video tracks while sharing.

## Phase 8 — Identity Display & Polish ✅

- [x] Logged-in: full name + Google avatar (initials-on-accent fallback when no photo)
- [x] Guest: typed name only, **generic person placeholder** (no avatar, no initials) + a "Guest" badge on the tile
- [x] Waiting room UI — joiner `WaitingView` (pinging "waiting for host") vs host `HostApprove` (accept/decline list); both built in Phase 3, HostApprove now uses the shared avatar

**Phase 8 notes**
- **The real gap was guest vs member identity.** Earlier phases already rendered name + avatar on tiles and in both host panels, but a guest looked **identical** to a signed-in user with no Google photo (both got initials-on-accent). AGENTS.md requires guests show "typed name only, no avatar / a generic placeholder" — so guests now render a neutral **person silhouette** (`PersonIcon` on `bg-surface-2`/muted), never initials/accent, reading as distinctly anonymous next to members.
- **New shared `app/_components/room/avatar.jsx`** — one guest-aware Avatar (rule: photo if signed-in+image → initials if signed-in+no-image → person placeholder if guest). Replaced **three** duplicated local `Avatar` helpers (`video-tile`, `host-approve`, `host-controls`), each previously guest-blind. `isGuest` is threaded from the server identity (`identity.isGuest`, already on every payload) through `room-client` into all three.
- **`VideoTile`** — uses the shared Avatar for both the main fallback and the presenter face-circle; name bar shows a **"Guest" badge** (when not host) mirroring the existing Host badge. New `PersonIcon` added to `icons.jsx`.
- Verify: `npm run lint` clean, `npm run build` ✅. **Manual:** join one window signed-in (Google photo on tile + name), another as a guest (typed name, grey person placeholder, "Guest" badge); confirm the host's approve list + controls list show the same guest placeholder, and a signed-in user with no Google photo still gets initials (not the guest placeholder).

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
