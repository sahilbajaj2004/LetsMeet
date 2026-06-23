"use client";

import { useEffect, useRef } from "react";

import Avatar from "./avatar";

// One video cell. Binds a MediaStream to a <video> imperatively (srcObject can't
// be set declaratively). Self-view is always muted to avoid echo. Falls back to
// an identity avatar (guest-aware) when there's no live video track yet.
export default function VideoTile({
  stream,
  overlayStream = null,
  name,
  image,
  isGuest = false,
  isYou = false,
  isHost = false,
  status,
  muted = false,
  videoOn,
  camOff = false,
  presenting = false,
  className = "",
}) {
  const ref = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream ?? null;
  }, [stream]);

  // The camera circle shown over a presenter's screen. It also carries the
  // presenter's AUDIO (the screen stream is video-only), so it must not be muted.
  useEffect(() => {
    const el = overlayRef.current;
    if (el && el.srcObject !== overlayStream) el.srcObject = overlayStream ?? null;
  }, [overlayStream]);

  // The face circle is live only if there's a camera stream AND the peer hasn't
  // turned their camera off. A receiver's track stays `.enabled` even after the
  // sender disables it, so we trust the explicit camOff flag (from media state).
  const overlayHasVideo =
    !camOff && overlayStream?.getVideoTracks?.().some((t) => t.enabled);

  // For self-tile, use the explicit videoOn prop (driven by camOn state) so the
  // avatar/video switch is in sync with the React state, not the DOM track flag
  // which only updates after the effect runs (causing a stale render).
  const hasVideo =
    videoOn !== undefined
      ? videoOn
      : stream?.getVideoTracks?.().some((t) => t.enabled);
  const progress = connectLabel(status);

  // Fills its grid cell — the call layout sizes cells, the tile just covers them.
  return (
    <div
      className={`relative size-full min-h-0 overflow-hidden rounded-2xl border border-border bg-surface-2 ${className}`}
    >
      {/* A shared screen is letterboxed (object-contain) so code/slides aren't
          cropped; camera tiles fill the cell (object-cover). */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={isYou}
        className={`size-full ${presenting ? "bg-black object-contain" : "object-cover"} ${hasVideo ? "" : "opacity-0"}`}
      />

      {!hasVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <Avatar
            name={name}
            image={image}
            isGuest={isGuest}
            size="size-16"
            textClass="text-2xl"
          />
        </div>
      )}

      {/* Presenter's face cam, circle in the top-left over the screen. Carries the
          presenter's audio too (the screen track is video-only), so it's unmuted
          on remote tiles. Falls back to an initials bubble if their cam is off. */}
      {overlayStream && (
        <div className="absolute left-3 top-3 size-20 overflow-hidden rounded-full border-2 border-white/80 bg-surface-2 shadow-lg sm:size-24">
          <video
            ref={overlayRef}
            autoPlay
            playsInline
            muted={isYou}
            className={`size-full object-cover ${overlayHasVideo ? "" : "opacity-0"}`}
          />
          {!overlayHasVideo && (
            <div className="absolute inset-0 grid place-items-center">
              <Avatar
                name={name}
                image={image}
                isGuest={isGuest}
                size="size-12"
                textClass="text-lg"
              />
            </div>
          )}
        </div>
      )}

      {progress && (
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
          {progress}
        </span>
      )}

      {presenting && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 text-[11px] font-semibold text-on-live">
          <span className="size-1.5 rounded-full bg-on-live" />
          Presenting
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/55 to-transparent px-3 py-2">
        {muted && <MicOffIcon className="size-3.5 shrink-0 text-white" />}
        <span className="truncate text-sm font-medium text-white">
          {name}
          {isYou ? " (you)" : ""}
        </span>
        {isHost ? (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Host
          </span>
        ) : (
          isGuest && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85">
              Guest
            </span>
          )
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
