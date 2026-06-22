# LetsMeet

Small, private video rooms for up to a handful of people. Audio and video travel
**browser to browser** over a peer-to-peer WebRTC mesh — never through a media
server. Google sign-in to host; guests join with just a name. Every joiner waits
in a lobby until the host lets them in.

> Status: Phases 0–4 complete (auth, rooms, signaling waiting-room, 2-person
> WebRTC call). Phase 5 (mesh scaling to 6) is next. See `task.md` for the live
> checklist and `AGENTS.md` for the full spec.

## Architecture

Two separately-deployed services — this split is deliberate (Vercel's serverless
functions can't hold the persistent socket connection the signaling server needs).

```
┌──────────────────────────┐         ┌──────────────────────────┐
│ Next.js frontend (:3000) │  socket │ Signaling server (:4000) │
│ app/ · App Router        │◀───────▶│ signaling/ · Express +   │
│ pages, API routes, UI    │  .io    │ Socket.io (ESM)          │
└───────────┬──────────────┘         └────────────┬─────────────┘
            │ Mongoose                             │ Mongoose (read-only)
            ▼                                      ▼
        ┌───────────────── MongoDB Atlas ─────────────────┐
        │  users · rooms (TTL index → auto-expire)        │
        └─────────────────────────────────────────────────┘

   Media (audio/video/screen) goes peer ⇄ peer via WebRTC — it never
   touches either server or the database.
```

- **Frontend** (`/`, Next 16 App Router): login, dashboard, room pages, room
  creation + validation API routes, and the in-browser call client (getUserMedia,
  RTCPeerConnection, the lobby UI).
- **Signaling** (`signaling/`, Express 5 + Socket.io 4): the live source of truth
  for presence and the waiting-room state machine — join requests, host
  accept/decline, and relaying WebRTC offer/answer/ICE between admitted peers. It
  holds its own read-only Mongo connection to validate rooms and identify the host.
- **MongoDB** stores only metadata: users and rooms. Rooms self-delete via a TTL
  index. No call content is ever stored.

## Tech stack

| Concern | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, JSX), Tailwind CSS v4 |
| Auth | NextAuth v4 — Google provider only (no email/password) |
| Database | MongoDB Atlas + Mongoose (TTL index on rooms) |
| Signaling | Node.js + Express 5 + Socket.io 4 (ESM) |
| Media | Native WebRTC (`RTCPeerConnection`, `getUserMedia`) — P2P mesh |
| NAT traversal | STUN (Google public by default); TURN optional |
| State (frontend) | React state today; Zustand arrives in Phase 5 |

## Prerequisites

- Node.js ≥ 20.9
- A MongoDB Atlas cluster (or local `mongod`)
- Google OAuth credentials (Web app) with redirect URI
  `http://localhost:3000/api/auth/callback/google`

## Setup

### 1. Frontend env — `.env.local` (repo root, gitignored)

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...                 # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://...
NEXT_PUBLIC_SIGNALING_URL=http://localhost:4000

# WebRTC ICE — optional. STUN defaults to Google public if unset.
# NEXT_PUBLIC_STUN_URLS=stun:stun.l.google.com:19302
# NEXT_PUBLIC_TURN_URL=
# NEXT_PUBLIC_TURN_USER=
# NEXT_PUBLIC_TURN_CRED=
```

### 2. Signaling env — `signaling/.env` (gitignored)

```bash
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb+srv://...        # same cluster; signaling reads only
```

### 3. Install

```bash
npm install                          # frontend (repo root)
cd signaling && npm install && cd ..
```

## Running locally

Two processes, two terminals:

```bash
# terminal 1 — signaling server (:4000)
cd signaling && npm start            # or: npm run dev  (node --watch)

# terminal 2 — Next.js frontend (:3000)
npm run dev
```

Open http://localhost:3000.

## Project layout

```
app/                      Next.js App Router
  api/auth/[...nextauth]/ NextAuth route
  api/rooms/              create + validate room
  room/[code]/            room page, call client, WebRTC hook
  _components/            UI (nav, room/ lobby + tiles, …)
lib/                      auth, mongodb, rooms lookup, room codes, ice servers
models/                   Mongoose User + Room (TTL index)
signaling/                Express + Socket.io service (own package.json)
  lib/                    db connection, room registry + state machine
  models/                 read-only Room
scripts/                  throwaway verification scripts (per phase)
task.md                   phase-by-phase status
AGENTS.md                 full locked spec
```

## How a call works

1. **Create** — a signed-in host POSTs `/api/rooms`; gets a code + shareable link.
   The room is saved with a TTL expiry.
2. **Knock** — anyone opening the link captures their camera, then emits
   `room:join`. The signaling server validates the room and puts them in the lobby
   (the host is auto-admitted and bypasses it).
3. **Admit** — the host sees each request and Accepts or Declines. On accept, the
   joiner becomes a participant and the WebRTC handshake begins.
4. **Connect** — the peer already in the call sends the offer; offer/answer/ICE
   are relayed through Socket.io; media then flows directly peer-to-peer.
5. **Leave** — leaving (or disconnecting) tears down that peer's connections on
   everyone else's side.

Capacity is enforced server-side (4 today, 6 in Phase 5). The next knock past the
cap gets a "room full" response with no lobby entry.

## Verification

Each phase ships a throwaway script in `scripts/` (run with the env file):

```bash
node --env-file=.env.local scripts/test-waiting-room.mjs    # signaling state machine
node --env-file=.env.local scripts/test-webrtc-relay.mjs    # offer/answer/ICE relay
# append `clean` to remove the room a test seeds
```

The actual media path (getUserMedia / RTCPeerConnection) is browser-only and
verified manually: open the room in two tabs (one signed-in host, one incognito
guest), knock, accept, and confirm both tiles show live video.

## Deployment

- Frontend → **Vercel**
- Signaling → **Render** or **Railway** (needs a long-lived connection; not Vercel)

Set the same env vars in each platform, and point `NEXT_PUBLIC_SIGNALING_URL` /
`CLIENT_ORIGIN` at the deployed URLs. Cross-network calls need a real TURN server
(Phase 9).

## Out of scope (v1)

No email/password, no in-call chat, no recording, no SFU/media server (the mesh
caps participants — raising past ~6 would require an SFU like LiveKit or mediasoup,
a different architecture). See `AGENTS.md` for the complete list.
