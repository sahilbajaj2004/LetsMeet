import { lookupRoom } from "@/lib/rooms";
import SiteNav from "../../_components/site-nav";
import SiteFooter from "../../_components/site-footer";

export const metadata = {
  title: "Room — LetsMeet",
};

// Human-friendly "expires in 23h 40m" from a future date.
function timeLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function RoomPage({ params }) {
  const { code } = await params;
  const result = await lookupRoom(code);

  return (
    <>
      <SiteNav />
      <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-xl place-items-center px-5 py-16">
        {result.status === "valid" && <ValidRoom room={result.room} />}
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

function ValidRoom({ room }) {
  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-8 text-center">
      <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-faint">
        <span className="size-1.5 rounded-full bg-live" />
        Active room
      </p>
      <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-ink">
        {room.code}
      </p>
      <p className="mt-3 text-sm text-muted">
        Hosted by <span className="text-ink">{room.hostName}</span> · expires in{" "}
        {timeLeft(room.expiresAt)}
      </p>

      <button
        disabled
        className="mt-8 inline-flex h-12 cursor-not-allowed items-center rounded-full bg-live px-7 font-semibold text-on-live opacity-50"
      >
        Knock to join
      </button>
      <p className="mt-3 text-xs text-faint">
        The waiting room and live call arrive in the next phases.
      </p>
    </div>
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
