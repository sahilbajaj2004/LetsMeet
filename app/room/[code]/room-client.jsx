"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { io } from "socket.io-client";

import { useWebRTC } from "./use-webrtc";
import { CAPTURE_CONSTRAINTS } from "@/lib/media";
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

  // Host-side waiting room queue.
  const [requests, setRequests] = useState([]);
  // Host's floating manage panel (waiting requests + per-peer controls).
  const [showHostPanel, setShowHostPanel] = useState(false);

  // Identity we joined with (for our own tile). Set in knock().
  const [identity, setIdentity] = useState(null);

  const { remoteStreams, peers, peerStates, connectToInitialPeers, closeAll } =
    useWebRTC({ socket, localStream });

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
    const onAdmitted = ({ role: r, peers: initialPeers }) => {
      setJoining(false);
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
    };
  }, [socket, connectToInitialPeers, closeAll]);

  // Release camera/mic once the call is over for us (kicked or ended), so the
  // hardware indicator goes off without waiting for unmount. Stale localStream is
  // fine here — the effect re-runs when it lands.
  useEffect(() => {
    if (phase === "kicked" || phase === "ended") {
      localStream?.getTracks().forEach((t) => t.stop());
    }
  }, [phase, localStream]);

  // --- actions ---
  const toggleMic = useCallback(() => setMicOn((v) => !v), []);

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
    router.push("/dashboard");
  }, [socket, closeAll, localStream, router]);

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
      socket.emit("room:join", { code, identity: id });
    },
    [socket, session, code],
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
    router.push("/dashboard");
  }, [socket, closeAll, localStream, router]);

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
        <VideoTile
          stream={localStream}
          name={self?.name ?? "You"}
          image={self?.image}
          isYou
          isHost={role === "host"}
          muted={!micOn}
        />
        {peerList.map((p, i) => (
          <VideoTile
            key={p.socketId}
            stream={remoteStreams.get(p.socketId)}
            name={p.identity?.name ?? "Guest"}
            image={p.identity?.image}
            isHost={p.role === "host"}
            status={peerStates.get(p.socketId)}
            // 3-up: center the last tile under the top pair on wide screens.
            className={
              tileCount === 3 && i === peerList.length - 1
                ? "sm:col-span-2 sm:mx-auto sm:w-[calc(50%-0.375rem)]"
                : ""
            }
          />
        ))}
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
            onKick={kick}
            onEnd={endCall}
          />
        </aside>
      )}

      {/* Floating control bar — bottom-center, Meet-style. */}
      <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface/80 p-1.5 shadow-xl backdrop-blur-md">
          <button
            onClick={toggleMic}
            aria-pressed={!micOn}
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            {micOn ? "Mute" : "Unmute"}
          </button>

          {role === "host" && (
            <button
              onClick={() => setShowHostPanel((v) => !v)}
              aria-pressed={showHostPanel}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors ${
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
            className="inline-flex h-10 items-center rounded-full bg-live px-6 font-semibold text-on-live transition-colors hover:bg-live-deep"
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
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-5xl place-items-center px-5 py-12">
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
