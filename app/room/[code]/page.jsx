import { lookupRoom } from "@/lib/rooms";
import SiteNav from "../../_components/site-nav";
import SiteFooter from "../../_components/site-footer";
import RoomClient from "./room-client";

export const metadata = {
  title: "Room — LetsMeet",
};

export default async function RoomPage({ params }) {
  const { code } = await params;
  const result = await lookupRoom(code);

  // Valid: hand off to the client for the lobby + live call. The socket
  // re-validates on join, so a room expiring between this render and the knock
  // still resolves cleanly (room:rejected).
  if (result.status === "valid") {
    return (
      <>
        <SiteNav />
        <RoomClient code={result.room.code} hostName={result.room.hostName} />
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <main className="mx-auto grid w-full max-w-xl flex-1 place-items-center px-5 py-16">
        {result.status === "expired" && (
          <Notice
            tone="warn"
            title="This room has expired"
            body="Rooms self-delete after they expire. Ask the host to start a new one and share a fresh link."
            code={code}
          />
        )}
        {result.status === "not_found" && (
          <Notice
            title="Room not found"
            body="That code doesn't match any active room. Check it for typos, or ask the host for a new link."
            code={code}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function Notice({ title, body, code, tone }) {
  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-8 text-center">
      <span
        className={`inline-grid size-12 place-items-center rounded-full text-xl font-semibold ${
          tone === "warn"
            ? "bg-live/15 text-live"
            : "bg-surface-2 text-muted"
        }`}
      >
        {tone === "warn" ? "!" : "?"}
      </span>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted">
        {body}
      </p>
      <p className="mt-4 font-mono text-xs text-faint">code: {code}</p>
      <a
        href="/dashboard"
        className="mt-7 inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        Back to dashboard
      </a>
    </div>
  );
}
