"use client";

import { PersonIcon } from "../icons";

// Shared identity avatar, used in the call tile, the host approve list, and the
// host controls list — one source of truth for the identity-display rule in
// AGENTS.md:
//
//   • Signed-in WITH a Google photo → the photo.
//   • Signed-in WITHOUT a photo      → initials on the live accent.
//   • Guest (no account)             → a generic person placeholder, never
//                                       initials/accent, so guests read as
//                                       distinctly anonymous next to members.
//
// `size` is a Tailwind size-* utility (e.g. "size-9") so callers control scale;
// `iconClass`/`textClass` scale the glyph or initials to match.
export default function Avatar({
  name,
  image,
  isGuest = false,
  size = "size-9",
  textClass = "text-sm",
  iconClass = "size-1/2",
}) {
  // A guest never has an image even if one is somehow passed — enforce the rule.
  if (image && !isGuest) {
    return (
      // Plain <img>: Google's lh3.googleusercontent.com host isn't in the
      // next/image allowlist, and avatars are tiny — no optimization needed.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name ?? "Participant"}
        referrerPolicy="no-referrer"
        className={`${size} rounded-full object-cover`}
      />
    );
  }

  if (isGuest) {
    return (
      <span
        className={`${size} grid place-items-center rounded-full bg-surface-2 text-muted`}
        aria-label={name ? `${name} (guest)` : "Guest"}
      >
        <PersonIcon className={iconClass} />
      </span>
    );
  }

  const initial = (name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <span
      className={`${size} grid place-items-center rounded-full bg-live font-semibold text-on-live ${textClass}`}
    >
      {initial}
    </span>
  );
}
