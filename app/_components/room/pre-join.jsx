"use client";

import { useEffect, useRef, useState } from "react";

// The lobby before knocking: a self-preview plus identity entry. Logged-in users
// join under their account name; guests type a display name (no avatar — that's
// the identity rule in AGENTS.md). The camera stream captured here is reused for
// the live call, so permission is asked once.
export default function PreJoin({
  code,
  hostName,
  isGuest,
  defaultName = "",
  previewStream,
  mediaError,
  joining,
  onJoin,
}) {
  const [name, setName] = useState(defaultName);
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && el.srcObject !== previewStream) el.srcObject = previewStream ?? null;
  }, [previewStream]);

  const trimmed = name.trim();
  const canJoin = !joining && !!trimmed && (!isGuest || trimmed.length >= 2);

  function submit(e) {
    e.preventDefault();
    if (canJoin) onJoin(trimmed);
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
      <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-faint">
        <span className="size-1.5 rounded-full bg-live" />
        Joining room {code}
      </p>

      <div className="mt-4 aspect-video overflow-hidden rounded-xl border border-border bg-surface-2">
        {previewStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center px-6 text-center text-sm text-muted">
            {mediaError
              ? `Camera unavailable — ${mediaError}. You can still join.`
              : "Requesting camera…"}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="mt-5">
        {isGuest ? (
          <>
            <label className="block text-sm font-medium text-ink">
              Your display name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              autoFocus
              maxLength={60}
              className="mt-2 h-11 w-full rounded-full border border-border bg-canvas px-4 text-sm text-ink outline-none placeholder:text-faint focus:border-border-strong"
            />
          </>
        ) : (
          <p className="text-sm text-muted">
            Joining as <span className="font-medium text-ink">{defaultName}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={!canJoin}
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-live px-6 font-semibold text-on-live transition-colors hover:bg-live-deep disabled:opacity-50"
        >
          {joining ? "Joining…" : "Knock to join"}
        </button>
        <p className="mt-3 text-center text-xs text-faint">
          {hostName ? `${hostName} will let you in.` : "The host will let you in."}
        </p>
      </form>
    </div>
  );
}
