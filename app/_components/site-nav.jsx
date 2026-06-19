import Logo from "./logo";
import ThemeToggle from "./theme-toggle";
import { ArrowIcon } from "./icons";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#room", label: "The room" },
  { href: "#privacy", label: "Privacy" },
];

export default function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-canvas/75 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <a href="#top" className="rounded-md" aria-label="LetsMeet home">
          <Logo />
        </a>

        <ul className="hidden items-center gap-8 text-sm text-muted md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-md transition-colors hover:text-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <a
            href="#"
            className="hidden h-10 items-center rounded-full border border-border px-4 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2 sm:inline-flex"
          >
            Sign in
          </a>
          <a
            href="#"
            className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-live px-4 text-sm font-semibold text-on-live transition-colors hover:bg-live-deep"
          >
            Start a call
            <ArrowIcon className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
          </a>
        </div>
      </nav>
    </header>
  );
}
