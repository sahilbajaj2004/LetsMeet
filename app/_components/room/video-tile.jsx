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
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream ?? null;
  }, [stream]);

  const hasVideo = stream?.getVideoTracks?.().some((t) => t.enabled);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-surface-2">
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

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/55 to-transparent px-3 py-2">
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
