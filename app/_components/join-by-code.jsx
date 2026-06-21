"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Sends the user to /room/<code>, where the code is validated server-side.
export default function JoinByCode() {
  const [code, setCode] = useState("");
  const router = useRouter();

  function submit(e) {
    e.preventDefault();
    const c = code.trim();
    if (c) router.push(`/room/${encodeURIComponent(c)}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="abc-defg-hij"
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
        className="h-11 flex-1 rounded-full border border-border bg-canvas px-4 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-border-strong"
      />
      <button
        type="submit"
        disabled={!code.trim()}
        className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2 disabled:opacity-50"
      >
        Join
      </button>
    </form>
  );
}
