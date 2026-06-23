import Logo from "./logo";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Small, private video rooms. Browser to browser, capped at four,
              with no media server in the middle.
            </p>
          </div>

          <p className="text-sm text-muted">
            Built by{" "}
            <a
              href="https://sahilbajaj.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              Sahil Bajaj
            </a>
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} LetsMeet. Built peer-to-peer.</p>
          <p className="font-mono text-xs tracking-wide">
            P2P MESH · 4 PEERS MAX · NO MEDIA SERVER
          </p>
        </div>
      </div>
    </footer>
  );
}
