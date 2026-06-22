"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { ArrowIcon } from "./icons";

// Auth-aware controls for the site nav. Three states: loading, signed-out,
// signed-in. Signed-in shows the Google avatar + name and a sign-out menu.
export default function NavAuth() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="h-10 w-24 animate-pulse rounded-full bg-surface-2" />;
  }

  if (!session) {
    return (
      <>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="hidden h-10 items-center rounded-full border border-border px-4 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2 sm:inline-flex"
        >
          Sign in
        </button>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-live px-4 text-sm font-semibold text-on-live transition-colors hover:bg-live-deep"
        >
          Start a call
          <ArrowIcon className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
        </button>
      </>
    );
  }

  const { name, image } = session.user;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={name} image={image} />
        <span className="hidden max-w-[10rem] truncate sm:inline">{name}</span>
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <button
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-canvas shadow-lg"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Avatar name={name} image={image} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{name}</p>
                <p className="truncate text-xs text-muted">{session.user.email}</p>
              </div>
            </div>
            <a
              href="/dashboard"
              className="block px-4 py-2.5 text-sm text-ink transition-colors hover:bg-surface-2"
              role="menuitem"
            >
              Dashboard
            </a>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-2"
              role="menuitem"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Google avatar, or initials fallback for accounts with no photo.
function Avatar({ name, image }) {
  if (image) {
    // Plain <img>: Google's lh3.googleusercontent.com host isn't in the
    // next/image allowlist, and avatars are tiny — no optimization needed.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name ?? "Account"}
        referrerPolicy="no-referrer"
        className="size-8 rounded-full object-cover"
      />
    );
  }
  const initial = (name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <span className="grid size-8 place-items-center rounded-full bg-live text-sm font-semibold text-on-live">
      {initial}
    </span>
  );
}
