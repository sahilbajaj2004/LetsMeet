"use client";

import { SunIcon, MoonIcon } from "./icons";

// Stateless: the icon is driven entirely by the `.dark` class on <html> (via the
// `dark:` variant), so there's no React state, no effect, and no hydration
// mismatch. The button only mutates the DOM + localStorage on click.
export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";

    root.classList.add("theme-transition");
    root.classList.toggle("dark", next === "dark");

    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage unavailable — toggle still works for the session
    }

    window.setTimeout(() => root.classList.remove("theme-transition"), 400);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light and dark theme"
      title="Toggle theme"
      className="grid size-10 place-items-center rounded-full border border-border text-muted transition-colors hover:border-border-strong hover:text-ink"
    >
      <MoonIcon className="size-[18px] dark:hidden" />
      <SunIcon className="hidden size-[18px] dark:block" />
    </button>
  );
}
