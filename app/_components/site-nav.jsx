import Logo from "./logo";
import ThemeToggle from "./theme-toggle";
import NavAuth from "./nav-auth";

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
          <NavAuth />
        </div>
      </nav>
    </header>
  );
}
