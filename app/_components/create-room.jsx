"use client";

import { useState } from "react";
import { ArrowIcon, LinkIcon } from "./icons";

// Host action: POST /api/rooms, then reveal the code + shareable link.
export default function CreateRoom() {
  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState(null); // { code, url, expiresAt }
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setRoom(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(room.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — link is still visible to copy by hand */
    }
  }

  if (room) {
    return (
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
          Your room code
        </p>
        <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-ink">
          {room.code}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={room.url}
            onFocus={(e) => e.target.select()}
            className="h-11 flex-1 rounded-full border border-border bg-canvas px-4 font-mono text-sm text-muted outline-none focus:border-border-strong"
          />
          <button
            onClick={copy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            <LinkIcon className="size-4 text-muted" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={`/room/${room.code}`}
            className="group inline-flex h-11 items-center gap-2 rounded-full bg-live px-6 font-semibold text-on-live transition-colors hover:bg-live-deep"
          >
            Open room
            <ArrowIcon className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
          </a>
          <button
            onClick={() => setRoom(null)}
            className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={create}
        disabled={loading}
        className="inline-flex h-11 items-center rounded-full bg-live px-6 font-semibold text-on-live transition-colors hover:bg-live-deep disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create a room"}
      </button>
      {error && <p className="mt-3 text-sm text-live">{error}</p>}
    </div>
  );
}
