"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { io } from "socket.io-client";

import { useWebRTC } from "./use-webrtc";
import { CAPTURE_CONSTRAINTS, SCREEN_CAPTURE_CONSTRAINTS } from "@/lib/media";
import PreJoin from "../../_components/room/pre-join";
import WaitingView from "../../_components/room/waiting-view";
import HostApprove from "../../_components/room/host-approve";
import HostControls from "../../_components/room/host-controls";
import VideoTile from "../../_components/room/video-tile";

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000";

// Phases: prejoin → connecting → waiting → in_call
//         (terminal) declined | full | rejected | ended
export default function RoomClient({ code, hostName }) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [socket, setSocket] = useState(null);
  const [phase, setPhase] = useState("prejoin");
  const [rejectReason, setRejectReason] = useState(null);
  const [role, setRole] = useState(null);
  const [joining, setJoining] = useState(false);

  const [localStream, setLocalStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Our own socket id (from room:admitted) — lets us tell "we're the sharer".
  const [selfId, setSelfId] = useState(null);
  // Mirror of selfId for the socket listeners, whose effect doesn't re-bind on it.
  const selfIdRef = useRef(null);
  useEffect(() => {
    selfIdRef.current = selfId;
  }, [selfId]);
  // Screen share: our own active display capture + who holds the room's one slot.
  const [sharing, setSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [activeSharer, setActiveSharer] = useState(null);

  // Host-side waiting room queue.
  const [requests, setRequests] = useState([]);
  // Host's floating manage panel (waiting requests + per-peer controls).
  const [showHostPanel, setShowHostPanel] = useState(false);

  // Identity we joined with (for our own tile). Set in knock().
  const [identity, setIdentity] = useState(null);

  const {
    remoteStreams,
    remoteScreens,
    peers,
    peerStates,
    connectToInitialPeers,
    addScreenShare,
    removeScreenShare,
    setPeerScreen,
    closeAll,
  } = useWebRTC({ socket, localStream });

  const isGuest = status === "authenticated" ? false : true;

  // --- capture camera/mic once, reused for the live call ---
  useEffect(() => {
    let cancelled = false;
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia(CAPTURE_CONSTRAINTS);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(stream);
      } catch (err) {
        if (!cancelled) setMediaError(err.name || "permission denied");
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Mic on/off is driven entirely by this flag → audio track .enabled. Both the
  // self toggle and a host mute just flip micOn, so there's one source of truth.
  useEffect(() => {
    if (!localStream) return;
    for (const t of localStream.getAudioTracks()) t.enabled = micOn;
  }, [micOn, localStream]);

  // Camera on/off mirrors mic: one flag → video track .enabled, flipped by the
  // self toggle and by a host cam toggle alike.
  useEffect(() => {
    if (!localStream) return;
    for (const t of localStream.getVideoTracks()) t.enabled = camOn;
  }, [camOn, localStream]);

  // Publish our mic/cam state to the room so peers render the right avatar/badge
  // and the host panel tracks our live camera. Only while in-call; the value is
  // also our pre-join baseline (sent again here, which is harmless).
  useEffect(() => {
    if (phase !== "in_call") return;
    socket?.emit("media:update", { mic: micOn, cam: camOn });
  }, [socket, phase, micOn, camOn]);

  // --- socket connection ---
  // Created in an effect, NOT a useState initializer: client components also
  // render on the server for the initial HTML, and io() must never run during
  // SSR (it would open a stray connection from the Node process). The effect
  // only runs in the browser. StrictMode's double-mount is safe — cleanup
  // disconnects and the remount makes a fresh socket.
  useEffect(() => {
    const s = io(SIGNALING_URL, { transports: ["websocket", "polling"] });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one intended render to publish the client-only socket
    setSocket(s);
    return () => s.disconnect();
  }, []);

  // --- room lifecycle events ---
  useEffect(() => {
    if (!socket) return;

    const onPending = () => {
      setJoining(false);
      setPhase("waiting");
    };
    const onAdmitted = ({ selfId: sid, role: r, peers: initialPeers }) => {
      setJoining(false);
      setSelfId(sid);
      setRole(r);
      setPhase("in_call");
      connectToInitialPeers(initialPeers ?? []);
    };
    const onRequest = (req) =>
      setRequests((prev) =>
        prev.some((p) => p.socketId === req.socketId) ? prev : [...prev, req],
      );
    const onCancelled = ({ socketId }) =>
      setRequests((prev) => prev.filter((p) => p.socketId !== socketId));
    const onDeclined = () => {
      setJoining(false);
      setPhase("declined");
    };
    const onFull = () => {
      setJoining(false);
      setPhase("full");
    };
    const onRejected = ({ reason }) => {
      setJoining(false);
      setRejectReason(reason);
      setPhase("rejected");
    };
    const onHostLeft = () => {
      closeAll();
      setPhase("ended");
    };
    // Host pressed "End call for all" — same outcome as the host dropping.
    const onEnded = () => {
      closeAll();
      setPhase("ended");
    };
    // Host kicked us — tear down and show a terminal notice.
    const onKicked = () => {
      closeAll();
      setPhase("kicked");
    };
    // Host muted us — flip the shared mic flag; the audio-track effect enforces it.
    const onMuted = () => setMicOn(false);
    // Host toggled our camera — set camOn to the requested state (the cam effect
    // enforces it on our track, and the media:update effect echoes it to peers).
    const onHostCam = ({ on }) => setCamOn(on === true);
    // Screen-share slot changed somewhere in the room: gate our own Share button
    // (activeSharer) AND tell the webrtc layer which of that peer's two video
    // streams is the screen (streamId), so it can split screen vs face circle.
    const onShareActive = ({ socketId, streamId }) => {
      setActiveSharer(socketId);
      if (socketId !== selfIdRef.current) setPeerScreen(socketId, streamId ?? null);
    };
    const onShareInactive = ({ socketId }) => {
      setActiveSharer((cur) => (cur === socketId ? null : cur));
      if (socketId !== selfIdRef.current) setPeerScreen(socketId, null);
    };

    socket.on("waiting:pending", onPending);
    socket.on("room:admitted", onAdmitted);
    socket.on("waiting:request", onRequest);
    socket.on("waiting:cancelled", onCancelled);
    socket.on("room:declined", onDeclined);
    socket.on("room:full", onFull);
    socket.on("room:rejected", onRejected);
    socket.on("host:left", onHostLeft);
    socket.on("room:ended", onEnded);
    socket.on("room:kicked", onKicked);
    socket.on("host:muted", onMuted);
    socket.on("host:cam", onHostCam);
    socket.on("share:active", onShareActive);
    socket.on("share:inactive", onShareInactive);

    return () => {
      socket.off("waiting:pending", onPending);
      socket.off("room:admitted", onAdmitted);
      socket.off("waiting:request", onRequest);
      socket.off("waiting:cancelled", onCancelled);
      socket.off("room:declined", onDeclined);
      socket.off("room:full", onFull);
      socket.off("room:rejected", onRejected);
      socket.off("host:left", onHostLeft);
      socket.off("room:ended", onEnded);
      socket.off("room:kicked", onKicked);
      socket.off("host:muted", onMuted);
      socket.off("host:cam", onHostCam);
      socket.off("share:active", onShareActive);
      socket.off("share:inactive", onShareInactive);
    };
  }, [socket, connectToInitialPeers, closeAll, setPeerScreen]);

  // Release camera/mic once the call is over for us (kicked or ended), so the
  // hardware indicator goes off without waiting for unmount. Stale localStream is
  // fine here — the effect re-runs when it lands.
  useEffect(() => {
    if (phase === "kicked" || phase === "ended") {
      localStream?.getTracks().forEach((t) => t.stop());
      screenStream?.getTracks().forEach((t) => t.stop());
    }
  }, [phase, localStream, screenStream]);

  // --- actions ---
  const toggleMic = useCallback(() => setMicOn((v) => !v), []);
  const toggleCam = useCallback(() => setCamOn((v) => !v), []);

  // Stop sharing: pull the screen track off every peer (camera keeps flowing),
  // stop the display capture, and release the slot. Nulling onended first so the
  // track.stop() below doesn't re-enter this via the native "Stop sharing" path.
  const stopShare = useCallback(() => {
    setSharing(false);
    removeScreenShare();
    setScreenStream((s) => {
      s?.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      return null;
    });
    socket?.emit("share:stop");
  }, [socket, removeScreenShare]);

  // Start sharing: capture the screen and add it as a SECOND outbound video track
  // to every peer (face cam stays on), then claim the slot — passing the stream
  // id so receivers can pick the screen out. Native "Stop sharing" → track.onended.
  const startShare = useCallback(async () => {
    if (!socket || sharing) return;
    let display;
    try {
      display = await navigator.mediaDevices.getDisplayMedia(
        SCREEN_CAPTURE_CONSTRAINTS,
      );
    } catch {
      return; // user dismissed the picker
    }
    const track = display.getVideoTracks()[0];
    if (!track) {
      display.getTracks().forEach((t) => t.stop());
      return;
    }
    setScreenStream(display);
    setSharing(true);
    addScreenShare(display);
    socket.emit("share:start", { streamId: display.id });
    track.onended = () => stopShare();
  }, [socket, sharing, addScreenShare, stopShare]);

  const setPeerCam = useCallback(
    (socketId, on) => socket?.emit("host:cam", { socketId, on }),
    [socket],
  );

  const mute = useCallback(
    (socketId) => socket?.emit("host:mute", { socketId }),
    [socket],
  );

  const kick = useCallback(
    (socketId) => socket?.emit("host:kick", { socketId }),
    [socket],
  );

  const endCall = useCallback(() => {
    socket?.emit("host:end");
    closeAll();
    localStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    router.push("/dashboard");
  }, [socket, closeAll, localStream, screenStream, router]);

  const knock = useCallback(
    (name) => {
      if (!socket) return;
      const id = session?.user
        ? {
            userId: session.user.id,
            name: session.user.name,
            image: session.user.image ?? null,
            isGuest: false,
          }
        : { userId: null, name, image: null, isGuest: true };
      setIdentity(id);
      setJoining(true);
      setPhase("connecting");
      // Carry the lobby mic/cam choice so peers admit us in the right state.
      socket.emit("room:join", { code, identity: id, media: { mic: micOn, cam: camOn } });
    },
    [socket, session, code, micOn, camOn],
  );

  const accept = useCallback(
    (socketId) => {
      socket?.emit("waiting:accept", { socketId });
      setRequests((prev) => prev.filter((p) => p.socketId !== socketId));
    },
    [socket],
  );

  const decline = useCallback(
    (socketId) => {
      socket?.emit("waiting:decline", { socketId });
      setRequests((prev) => prev.filter((p) => p.socketId !== socketId));
    },
    [socket],
  );

  const leave = useCallback(() => {
    socket?.emit("room:leave");
    closeAll();
    localStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    router.push("/dashboard");
  }, [socket, closeAll, localStream, screenStream, router]);

  // --- render ---
  if (status === "loading") {
    return <Centered>Loading…</Centered>;
  }

  if (phase === "prejoin" || phase === "connecting") {
    return (
      <Centered>
        <PreJoin
          code={code}
          hostName={hostName}
          isGuest={isGuest}
          defaultName={session?.user?.name ?? ""}
          previewStream={localStream}
          mediaError={mediaError}
          joining={joining}
          micOn={micOn}
          camOn={camOn}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onJoin={knock}
        />
      </Centered>
    );
  }

  if (phase === "waiting") {
    return (
      <Centered>
        <WaitingView hostName={hostName} />
      </Centered>
    );
  }

  if (phase === "declined") {
    return (
      <Notice
        tone="warn"
        title="The host declined your request"
        body="You weren't let into this call. If you think that's a mistake, ask the host for a new link."
      />
    );
  }

  if (phase === "full") {
    return (
      <Notice
        tone="warn"
        title="This room is full"
        body="LetsMeet calls are capped at 4 people. Try again once someone leaves."
      />
    );
  }

  if (phase === "ended") {
    return (
      <Notice
        title="The host ended the call"
        body="The room has been closed for everyone."
      />
    );
  }

  if (phase === "kicked") {
    return (
      <Notice
        tone="warn"
        title="You were removed from the call"
        body="The host removed you from this room. You can't rejoin this session."
      />
    );
  }

  if (phase === "rejected") {
    const body =
      rejectReason === "expired"
        ? "This room has expired. Ask the host to start a new one."
        : rejectReason === "not_found"
          ? "That room code doesn't match an active room."
          : "Something went wrong joining the room. Try again.";
    return <Notice title="Can't join this room" body={body} />;
  }

  // in_call — immersive, full-bleed call that covers the site nav (fixed inset-0).
  const self = identity;
  const tileCount = peers.size + 1;
  const peerList = [...peers.entries()].map(([socketId, p]) => ({
    socketId,
    ...p,
  }));
  const pendingCount = requests.length;

  return (
    <div className="fixed inset-0 z-50 bg-canvas">
      {/* Tile grid fills the whole screen; cells stretch to share the space. */}
      <div
        className={`grid h-full w-full gap-2 p-2 sm:gap-3 sm:p-3 ${callGridClass(tileCount)}`}
      >
        {/* Self-tile stays on the camera even while presenting — showing your own
            screen capture here would feed back into an infinity mirror (you're
            already looking at that screen). Remote peers get the screen track. */}
        <VideoTile
          stream={localStream}
          name={self?.name ?? "You"}
          image={self?.image}
          isGuest={self?.isGuest ?? isGuest}
          isYou
          isHost={role === "host"}
          muted={!micOn}
          videoOn={camOn}
          presenting={sharing}
        />
        {peerList.map((p, i) => {
          // A presenting peer sends two videos: their screen (main) + camera (the
          // corner circle). When not presenting, the camera is the main tile.
          const screen = remoteScreens.get(p.socketId);
          const camera = remoteStreams.get(p.socketId);
          const media = p.media ?? { mic: true, cam: true };
          return (
            <VideoTile
              key={p.socketId}
              stream={screen ?? camera}
              overlayStream={screen ? camera : null}
              name={p.identity?.name ?? "Guest"}
              image={p.identity?.image}
              isGuest={p.identity?.isGuest ?? false}
              isHost={p.role === "host"}
              status={peerStates.get(p.socketId)}
              muted={!media.mic}
              // While presenting, the main tile is the screen (always shown); the
              // cam flag only gates the face circle (handled inside VideoTile via
              // overlayHasVideo + the track's own enabled state).
              videoOn={screen ? undefined : media.cam}
              camOff={!media.cam}
              presenting={Boolean(screen)}
              // 3-up: center the last tile under the top pair on wide screens.
              className={
                tileCount === 3 && i === peerList.length - 1
                  ? "sm:col-span-2 sm:mx-auto sm:w-[calc(50%-0.375rem)]"
                  : ""
              }
            />
          );
        })}
      </div>

      {/* Room chip — top-left, since the nav is hidden during the call. */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <span className="rounded-full bg-surface/80 px-3 py-1.5 font-mono text-xs text-faint backdrop-blur-md">
          room {code} · {tileCount} in call
        </span>
      </div>

      {/* Host's floating manage panel (top-right), toggled from the control bar. */}
      {role === "host" && showHostPanel && (
        <aside className="absolute right-3 top-3 z-20 flex max-h-[calc(100dvh-8rem)] w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-3 overflow-y-auto">
          <HostApprove requests={requests} onAccept={accept} onDecline={decline} />
          <HostControls
            peers={peerList}
            onMute={mute}
            onSetCam={setPeerCam}
            onKick={kick}
            onEnd={endCall}
          />
        </aside>
      )}

      {/* Floating control bar — bottom-center, Meet-style. */}
      <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-3">
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-border bg-surface/80 p-1.5 shadow-xl backdrop-blur-md scrollbar-none sm:gap-2">
          <button
            onClick={toggleMic}
            aria-pressed={!micOn}
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-border px-3 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2 sm:px-5"
          >
            <span className="sm:hidden">{micOn ? "Mic" : "Unmute"}</span>
            <span className="hidden sm:inline">{micOn ? "Mute" : "Unmute"}</span>
          </button>

          <button
            onClick={toggleCam}
            aria-pressed={!camOn}
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-border px-3 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2 sm:px-5"
          >
            <span className="sm:hidden">{camOn ? "Cam" : "Cam off"}</span>
            <span className="hidden sm:inline">{camOn ? "Stop video" : "Start video"}</span>
          </button>

          <button
            onClick={sharing ? stopShare : startShare}
            disabled={!sharing && !!activeSharer && activeSharer !== selfId}
            aria-pressed={sharing}
            title={
              !sharing && activeSharer && activeSharer !== selfId
                ? "Someone else is sharing"
                : undefined
            }
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-border px-3 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent sm:px-5"
          >
            <span className="sm:hidden">{sharing ? "Stop" : "Share"}</span>
            <span className="hidden sm:inline">{sharing ? "Stop sharing" : "Share screen"}</span>
          </button>

          {role === "host" && (
            <button
              onClick={() => setShowHostPanel((v) => !v)}
              aria-pressed={showHostPanel}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors sm:px-5 ${
                showHostPanel
                  ? "border-border-strong bg-surface-2 text-ink"
                  : "border-border text-ink hover:border-border-strong hover:bg-surface-2"
              }`}
            >
              Manage
              {pendingCount > 0 && (
                <span className="inline-grid size-5 place-items-center rounded-full bg-live text-[11px] font-semibold text-on-live">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={leave}
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-live px-4 font-semibold text-on-live transition-colors hover:bg-live-deep sm:px-6"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

// Tile layout by participant count, sized to FILL the screen (rows are explicit
// so cells stretch). Portrait stacks in one column; from `sm` up it spreads:
// 1 → full, 2 → side-by-side, 3 → two over a centered one, 4 → 2×2.
function callGridClass(count) {
  if (count <= 1) return "grid-cols-1 grid-rows-1";
  if (count === 2) return "grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1";
  if (count === 3) return "grid-cols-1 grid-rows-3 sm:grid-cols-2 sm:grid-rows-2";
  return "grid-cols-1 grid-rows-4 sm:grid-cols-2 sm:grid-rows-2";
}

function Centered({ children }) {
  return (
    <div className="mx-auto grid min-h-dvh max-w-5xl place-items-center px-5 py-12 -mt-16">
      {children}
    </div>
  );
}

function Notice({ title, body, tone }) {
  return (
    <Centered>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <span
          className={`inline-grid size-12 place-items-center rounded-full text-xl font-semibold ${
            tone === "warn" ? "bg-live/15 text-live" : "bg-surface-2 text-muted"
          }`}
        >
          {tone === "warn" ? "!" : "·"}
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted">
          {body}
        </p>
        <a
          href="/dashboard"
          className="mt-7 inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          Back to dashboard
        </a>
      </div>
    </Centered>
  );
}
