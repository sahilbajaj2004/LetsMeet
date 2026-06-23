"use client";

import Avatar from "./avatar";

// Host-only panel listing people in the waiting room. Accept moves them into the
// call; Decline blocks them for the session. Rendered alongside the video grid.
export default function HostApprove({ requests, onAccept, onDecline }) {
  if (!requests.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-faint">
        Waiting to join · {requests.length}
      </p>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li
            key={r.socketId}
            className="flex items-center gap-3 rounded-xl border border-border bg-canvas px-3 py-2"
          >
            <Avatar
              name={r.identity.name}
              image={r.identity.image}
              isGuest={r.identity.isGuest}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {r.identity.name}
              </p>
              <p className="truncate text-xs text-muted">
                {r.identity.isGuest ? "Guest" : "Signed in"}
              </p>
            </div>
            <button
              onClick={() => onAccept(r.socketId)}
              className="inline-flex h-9 items-center rounded-full bg-live px-4 text-sm font-semibold text-on-live transition-colors hover:bg-live-deep"
            >
              Accept
            </button>
            <button
              onClick={() => onDecline(r.socketId)}
              className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              Decline
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
