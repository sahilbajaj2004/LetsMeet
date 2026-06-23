"use client";

import Avatar from "./avatar";

// Host-only control panel. Lists everyone else in the call with per-person Mute,
// a camera on/off toggle and Kick, plus an "End call for all" button. Rendered
// alongside the video grid. Mirrors host-approve.jsx.
// `peers` is [{ socketId, identity, role, media }].
export default function HostControls({ peers, onMute, onSetCam, onKick, onEnd }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-faint">
        Host controls
      </p>

      {peers.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {peers.map((p) => (
            <li
              key={p.socketId}
              className="flex items-center gap-3 rounded-xl border border-border bg-canvas px-3 py-2"
            >
              <Avatar
                name={p.identity?.name}
                image={p.identity?.image}
                isGuest={p.identity?.isGuest}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {p.identity?.name ?? "Guest"}
                </p>
                <p className="truncate text-xs text-muted">
                  {p.identity?.isGuest ? "Guest" : "Signed in"}
                </p>
              </div>
              <button
                onClick={() => onMute(p.socketId)}
                className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                Mute
              </button>
              <button
                onClick={() => onSetCam(p.socketId, !(p.media?.cam ?? true))}
                className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                {p.media?.cam ?? true ? "Cam off" : "Cam on"}
              </button>
              <button
                onClick={() => onKick(p.socketId)}
                className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                Kick
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={onEnd}
        className="inline-flex h-10 w-full items-center justify-center rounded-full bg-live px-6 font-semibold text-on-live transition-colors hover:bg-live-deep"
      >
        End call for all
      </button>
    </div>
  );
}
