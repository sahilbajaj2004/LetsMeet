"use client";

import { useEffect, useRef } from "react";

// One video cell. Binds a MediaStream to a <video> imperatively (srcObject can't
// be set declaratively). Self-view is always muted to avoid echo. Falls back to
// an initials avatar when there's no live video track yet.
export default function VideoTile({
  stream,
  name,
  image,
  isYou = false,
  isHost = false,
  status,
  muted = false,
  className = "",
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream ?? null;
  }, [stream]);

  const hasVideo = stream?.getVideoTracks?.().some((t) => t.enabled);
  const progress = connectLabel(status);

  // Fills its grid cell — the call layout sizes cells, the tile just covers them.
  return (
    <div
      className={`relative size-full min-h-0 overflow-hidden rounded-2xl border border-border bg-surface-2 ${className}`}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={isYou}
        className={`size-full object-cover ${hasVideo ? "" : "opacity-0"}`}
      />

      {!hasVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <Avatar name={name} image={image} />
        </div>
      )}

      {progress && (
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
          {progress}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/55 to-transparent px-3 py-2">
        {muted && <MicOffIcon className="size-3.5 shrink-0 text-white" />}
        <span className="truncate text-sm font-medium text-white">
          {name}
          {isYou ? " (you)" : ""}
        </span>
        {isHost && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Host
          </span>
        )}
      </div>
    </div>
  );
}

function MicOffIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

// Remote-tile connection hint, driven by RTCPeerConnection.connectionState.
// Self tile passes no status; a connected peer shows nothing.
function connectLabel(status) {
  if (!status || status === "connected") return null;
  if (status === "disconnected" || status === "failed") return "Reconnecting…";
  return "Connecting…";
}

// Mirrors the avatar treatment in app/_components/nav-auth.jsx.
function Avatar({ name, image }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name ?? "Participant"}
        referrerPolicy="no-referrer"
        className="size-16 rounded-full object-cover"
      />
    );
  }
  const initial = (name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <span className="grid size-16 place-items-center rounded-full bg-live text-2xl font-semibold text-on-live">
      {initial}
    </span>
  );
}
