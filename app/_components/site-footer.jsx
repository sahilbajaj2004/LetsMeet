import Logo from "./logo";

const COLUMNS = [
  {
    title: "Product",
    links: ["How it works", "The room", "Host controls", "Screen share"],
  },
  {
    title: "Trust",
    links: ["Privacy", "Peer-to-peer", "Security", "Status"],
  },
  {
    title: "Company",
    links: ["About", "Changelog", "Contact"],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Small, private video rooms. Browser to browser, capped at four,
              with no media server in the middle.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-muted">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="rounded transition-colors hover:text-ink">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} LetsMeet. Built peer-to-peer.</p>
          <p className="font-mono text-xs tracking-wide">
            P2P MESH · 4 PEERS MAX · NO MEDIA SERVER
          </p>
        </div>
      </div>
    </footer>
  );
}
