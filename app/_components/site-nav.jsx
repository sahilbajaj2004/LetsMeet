import Logo from "./logo";
import ThemeToggle from "./theme-toggle";
import NavAuth from "./nav-auth";

// TODO: replace with your actual portfolio URL
const PORTFOLIO_URL = "https://sahilbajaj.dev";

export default function SiteNav() {
  return (
    <>
      <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-xs text-amber-600 dark:text-amber-400">
        Backend may be sleeping.{" "}
        <a
          href="https://letsmeet-9ihi.onrender.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 font-medium hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
        >
          Wake it up
        </a>
        , then refresh.
      </div>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-canvas/75 backdrop-blur-md">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <a href="#top" className="rounded-md" aria-label="LetsMeet home">
              <Logo />
            </a>
            <span className="text-border" aria-hidden="true">·</span>
            <a
              href={PORTFOLIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted transition-colors hover:text-ink"
            >
              by Sahil Bajaj
            </a>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <NavAuth />
          </div>
        </nav>
      </header>
    </>
  );
}
