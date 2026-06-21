"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { GoogleIcon } from "./icons";

// Standalone Google sign-in button for the /login page.
export default function GoogleSignInButton({ callbackUrl = "/dashboard" }) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={() => {
        setLoading(true);
        signIn("google", { callbackUrl });
      }}
      disabled={loading}
      className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-surface px-6 font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2 disabled:opacity-60"
    >
      <GoogleIcon className="size-5" />
      {loading ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}
