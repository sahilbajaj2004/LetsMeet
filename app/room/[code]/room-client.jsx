"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { io } from "socket.io-client";

import { useWebRTC } from "./use-webrtc";
import PreJoin from "../../_components/room/pre-join";
import WaitingView from "../../_components/room/waiting-view";
import HostApprove from "../../_components/room/host-approve";
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

  // Host-side waiting room queue.
  const [requests, setRequests] = useState([]);

  // Identity we joined with (for our own tile). Set in knock().
  const [identity, setIdentity] = useState(null);

  const { remoteStreams, peers, connectToInitialPeers, closeAll } = useWebRTC({
    socket,
    localStream,
  });

  const isGuest = status === "authenticated" ? false : true;

  // --- capture camera/mic once, reused for the live call ---
  useEffect(() => {
    let cancelled = false;
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
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

    socket.on("waiting:pending", onPending);
    socket.on("room:admitted", onAdmitted);
    socket.on("waiting:request", onRequest);
    socket.on("waiting:cancelled", onCancelled);
    socket.on("room:declined", onDeclined);
    socket.on("room:full", onFull);
    socket.on("room:rejected", onRejected);
    socket.on("host:left", onHostLeft);

    return () => {
      socket.off("waiting:pending", onPending);
      socket.off("room:admitted", onAdmitted);
      socket.off("waiting:request", onRequest);
      socket.off("waiting:cancelled", onCancelled);
      socket.off("room:declined", onDeclined);
      socket.off("room:full", onFull);
      socket.off("room:rejected", onRejected);
      socket.off("host:left", onHostLeft);
    };
  }, [socket, connectToInitialPeers, closeAll]);

  // --- actions ---
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

  if (phase === "rejected") {
    const body =
      rejectReason === "expired"
        ? "This room has expired. Ask the host to start a new one."
        : rejectReason === "not_found"
          ? "That room code doesn't match an active room."
          : "Something went wrong joining the room. Try again.";
    return <Notice title="Can't join this room" body={body} />;
  }

  // in_call
  const self = identity;
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <div className="grid gap-3 sm:grid-cols-2">
        <VideoTile
          stream={localStream}
          name={self?.name ?? "You"}
          image={self?.image}
          isYou
          isHost={role === "host"}
        />
        {[...peers.entries()].map(([id, p]) => (
          <VideoTile
            key={id}
            stream={remoteStreams.get(id)}
            name={p.identity?.name ?? "Guest"}
            image={p.identity?.image}
            isHost={p.role === "host"}
          />
        ))}
      </div>

      {role === "host" && (
        <div className="mt-4">
          <HostApprove requests={requests} onAccept={accept} onDecline={decline} />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="font-mono text-xs text-faint">
          room {code} · {peers.size + 1} in call
        </p>
        <button
          onClick={leave}
          className="inline-flex h-11 items-center rounded-full bg-live px-6 font-semibold text-on-live transition-colors hover:bg-live-deep"
        >
          Leave
        </button>
      </div>
    </div>
  );
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
