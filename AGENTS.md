<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
LETSMEET — FULL PROJECT PLAN
========================================
(Google Meet style, 4-participant cap, OAuth + Guest hybrid)


TECH STACK (Final, Locked)
========================================

1. Next.js 14 (App Router, JSX)
   Use: frontend UI, all pages (login, dashboard, room, waiting room),
   plus non-realtime API routes (create room, validate room code).

2. Tailwind CSS
   Use: styling only. No functional role.

3. NextAuth.js (Auth.js) — Google provider only
   Use: handles Google OAuth login, session management, no email/password
   option exists anywhere in the app.

4. MongoDB + Mongoose
   Use: stores Users (from Google login) and Rooms (room code, host id,
   created/expiry time). Does NOT store video, audio, or call content.
   Rooms use a TTL index so they auto-delete after expiry, no manual
   cleanup code needed.

5. Node.js + Socket.io (separate deployed service)
   Use: signaling server. Handles join requests, waiting room state,
   host accept/decline events, kick/mute/end-call events, and relays
   WebRTC offer/answer/ICE candidate messages between participants.
   Runs as its own service, NOT on Vercel, because it needs a
   persistent connection that serverless functions can't hold.

6. Native WebRTC APIs (RTCPeerConnection, getUserMedia, getDisplayMedia)
   Use: actual audio/video/screen-share transport. Peer-to-peer mesh,
   capped at 4 participants. No SFU, no media server, by design at
   this scale.

7. TURN / STUN (coturn self-hosted, or Twilio/Metered.ca free tier)
   Use: lets two browsers find each other through home routers (STUN),
   and relays traffic when that fails on strict/corporate networks
   (TURN). Without this, some users silently can't connect.

8. Zustand
   Use: frontend state — who's in the call, mic/cam status, waiting
   room queue (host side), connection status.

9. Cloudinary (OPTIONAL — not committed yet, flagged below)
   Use: only if you later want call recordings or profile picture
   uploads. Has zero role in the live call itself.

10. Deployment
   - Vercel → Next.js frontend
   - Render or Railway → Socket.io signaling server
   Two separate services. Non-negotiable given Vercel's serverless
   limits on long-lived connections.


LOCKED FUNCTIONALITY SPEC
========================================

AUTHENTICATION
- Sign in with Google only, no email/password
- Logged-in profile: full name + Google avatar
- Session persists across visits

ROOM MANAGEMENT
- Only logged-in users can create a room
- Room creation generates a unique room code + shareable link
- Room auto-expires and deletes from MongoDB (TTL index)
- Anyone opening a link/code sees "valid" / "expired" / "not found"

IDENTITY DISPLAY
- Logged-in member: full name + avatar shown
- Guest (not logged in): only the typed display name shown, no avatar

WAITING ROOM (applies to EVERYONE — logged-in members AND guests)
- Anyone joining a room, regardless of login status, enters a waiting
  state first
- Host sees live "X wants to join" requests
- Host can Accept or Decline each request individually
- Only after Accept does that person's audio/video connection begin
- If declined, that person is blocked from entering this session

CAPACITY
- Max 4 participants per room (mesh topology limit)
- 5th join attempt is rejected with a "room full" message, no waiting
  room entry offered once full

HOST PRIVILEGES (host = whoever created the room)
- Approve or decline waiting room join requests
- Kick any participant out of the call
- Mute any participant
- End the call for everyone (terminates the room for all at once)
- PLUS all normal member controls below (host is never restricted
  from their own controls)

MEMBER CONTROLS (host and regular members both have these)
- Mute / unmute own mic
- Turn own camera on/off
- Leave the call (individually, doesn't affect others)

SCREEN SHARE
- Available to all participants, no login restriction, no host gate
- Only ONE person can share at a time. Starting a share disables the
  share button for everyone else until the active share ends, enforced
  via a Socket.io broadcast ("X is sharing"), not a hard browser limit
- Detect the browser's native "Stop sharing" button via track.onended
  and auto-revert that user's stream back to camera

SIGNALING & CONNECTION HANDLING
- Socket.io manages: join requests, waiting room state, accept/decline,
  kick/mute/end-call events, WebRTC handshake relay (offer/answer/ICE)
- TURN/STUN fallback included so calls connect on restrictive networks
- Reconnection on network blips: NOT yet decided how deep to build.
  Basic version = user refreshes and rejoins. Built version = automatic
  recovery without user action. Default to basic for v1, revisit later.

DATA & STORAGE
- MongoDB stores: Users, Rooms, room metadata only
- MongoDB never stores: video, audio, or any call content
- Cloudinary: not committed. Only added if recording or profile photo
  upload is confirmed as wanted later.


EXPLICITLY OUT OF SCOPE (v1)
========================================
- No email/password login, ever
- No in-call text chat (not requested, not built)
- No more than 4 participants (mesh limit, not raised in v1)
- No call recording (unless confirmed later)
- No breakout rooms
- No virtual backgrounds
- No live captions
- No simultaneous multi-person screen share (one at a time, see above)
- No SFU/media server (mediasoup, LiveKit) — only revisit if
  participant cap needs to rise above ~4-6 in a future version


HOW TO START — STEP BY STEP
========================================

You need TWO separate project folders. Don't put the signaling server
inside the Next.js app, they deploy to different places and that
separation matters from day one.

Suggested folder structure on your machine:

  letsmeet/
    frontend/      <- Next.js app
    signaling/     <- Node.js + Socket.io server


STEP 1 — Create the Next.js frontend

  npx create-next-app@latest frontend

  When prompted:
    - TypeScript? No (you're using JSX)
    - Tailwind CSS? Yes
    - App Router? Yes
    - src/ directory? Your choice, either works

  cd frontend
  npm run dev

  Confirm it loads at http://localhost:3000 before moving on.


STEP 2 — Create the signaling server (separate folder, separate repo
if you want clean deploys)

  mkdir signaling
  cd signaling
  npm init -y
  npm install socket.io express cors dotenv

  Create a basic index.js that starts an Express server, attaches
  Socket.io to it, and listens on a port (e.g. 4000). Confirm it
  runs locally with:

  node index.js

  Test it responds before writing any real event logic.


STEP 3 — Set up MongoDB

  - Create a free MongoDB Atlas cluster (atlas.mongodb.com) OR run
    Mongo locally if you prefer (mongod, or Docker: 
    docker run -d -p 27017:27017 mongo)
  - Get your connection string, store it in frontend/.env.local as
    MONGODB_URI=your_connection_string_here
  - Install Mongoose in the frontend project:
    npm install mongoose


STEP 4 — Set up Google OAuth credentials

  - Go to console.cloud.google.com
  - Create a new project (or use an existing one)
  - Go to APIs & Services > Credentials > Create OAuth Client ID
  - Application type: Web application
  - Authorized redirect URI (for local dev):
    http://localhost:3000/api/auth/callback/google
  - Copy the Client ID and Client Secret into frontend/.env.local:
    GOOGLE_CLIENT_ID=...
    GOOGLE_CLIENT_SECRET=...
    NEXTAUTH_SECRET=run "openssl rand -base64 32" to generate this
    NEXTAUTH_URL=http://localhost:3000

  - Install NextAuth:
    npm install next-auth


STEP 5 — Confirm both projects can talk to each other

  - In the signaling server, configure CORS to allow requests from
    http://localhost:3000
  - In the frontend, add the signaling server URL to .env.local:
    NEXT_PUBLIC_SIGNALING_URL=http://localhost:4000
  - Install the Socket.io client in the frontend:
    npm install socket.io-client
  - Write a throwaway test: connect from the frontend to the signaling
    server and console.log a successful connection on both ends.
    Don't move to Phase 1 of the build until this works.

Once steps 1 through 5 are confirmed working, you are at PHASE 0
COMPLETE. Proceed into the build phases below in order. Do not skip
ahead to host controls, screen share, or mesh scaling before Phase 4
(the basic 2-person call) is fully working end to end. Every later
phase assumes that foundation already works.


BUILD PHASES
========================================

PHASE 0 — Environment & Project Setup
(see HOW TO START above for exact commands)
- Next.js app running locally
- Signaling server running locally
- MongoDB connected
- Google OAuth credentials configured
- Frontend and signaling server confirmed talking to each other

PHASE 1 — Authentication
- Integrate NextAuth.js with Google provider
- Build login page / "Sign in with Google" button
- Build session handling (protect routes that require login)
- Confirm logged-in user data (name, avatar, email) is accessible
  in both frontend and passed to backend when needed

PHASE 2 — Room Creation & Database
- Define Mongoose schemas: User, Room (with TTL index on expiry field)
- Build "Create Room" flow (logged-in only) — generates room code +
  shareable link, saves to MongoDB
- Build room validation route: check if a room code is valid, expired,
  or doesn't exist
- Build the "room not found / expired" UI state

PHASE 3 — Signaling Server Core
- Build Socket.io server: handle connect/disconnect, room join events
- Build waiting room state machine: pending → accepted/declined →
  in-call → left/kicked
- Build host-side "incoming join requests" event handling
- Build accept/decline events and propagate result to the waiting user

PHASE 4 — WebRTC Core (2-person call first)
- Implement getUserMedia (camera/mic capture)
- Implement RTCPeerConnection setup between exactly 2 users
- Wire offer/answer/ICE candidate exchange through the signaling server
- Get a working 1-on-1 call end to end before adding more participants
- Integrate TURN/STUN config and test on a network that isn't your
  home wifi (mobile hotspot, different network) to catch NAT issues early

PHASE 5 — Mesh Scaling to 4 Participants
- Extend peer connection logic to handle multiple simultaneous peers
  (each participant connects to every other participant)
- Test actual video/audio quality at 3 and 4 participants on varied
  hardware, not just your own dev machine
- Handle a participant leaving mid-call (clean up their peer connections
  on everyone else's side)

PHASE 6 — Host Controls
- Build host UI: list of current participants, mute/kick buttons per
  participant, "end call for all" button
- Wire kick event: signaling server forcibly disconnects target
  participant's peer connections and removes them from the room
- Wire mute event: signaling server tells target participant's client
  to mute their own mic (client enforces it, since you can't force
  someone else's hardware mute remotely without their browser's cooperation)
- Wire end-call-for-all: signaling server broadcasts disconnect to
  every participant, room is torn down

PHASE 7 — Member Controls & Screen Share
- Build mute self / camera toggle / leave buttons (all participants)
- Implement getDisplayMedia for screen share, available to everyone
- Enforce one-active-share-at-a-time via Socket.io broadcast
- Handle the swap between camera stream and screen-share stream cleanly
  using RTCRtpSender.replaceTrack() on every open peer connection
- Detect native "Stop sharing" browser button via track.onended and
  auto-revert to camera

PHASE 8 — Identity Display & Polish
- Show full name + avatar for logged-in members
- Show typed name only for guests, no avatar slot or a generic placeholder
- Waiting room UI: clean "waiting for host to let you in" screen for
  the joining user, separate from the host's "approve requests" view

PHASE 9 — Testing & Deployment
- Deploy Next.js frontend to Vercel
- Deploy Socket.io signaling server to Render or Railway
- Test full flow across actual different networks (not all on your wifi):
  home wifi to mobile data, home wifi to a friend's network, etc.
- Confirm TURN server kicks in correctly when STUN fails
- Confirm room TTL deletion actually works in MongoDB
- Confirm 5th joiner is correctly rejected
- Confirm kicked/declined users can't sneak back in via the same link


OPEN ITEMS — NOT YET DECIDED, REVISIT LATER
========================================
- Reconnection handling depth (basic refresh vs automatic recovery)
- Whether call recording (Cloudinary) gets added in a future version
- Whether participant cap ever needs to rise past 4 (would require
  switching mesh to an SFU like LiveKit or mediasoup — a different
  architecture, not a small change)