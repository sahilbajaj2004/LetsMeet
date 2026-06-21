import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SiteNav from "../_components/site-nav";
import SiteFooter from "../_components/site-footer";
import CreateRoom from "../_components/create-room";
import JoinByCode from "../_components/join-by-code";

export const metadata = {
  title: "Dashboard — LetsMeet",
};

export default async function DashboardPage() {
  // Secure check at the data source: no session → bounce to /login, which
  // returns here via callbackUrl after Google sign-in.
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/dashboard");

  const { name, email, image } = session.user;

  return (
    <>
      <SiteNav />

      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <div className="flex items-center gap-4">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={name ?? "Account"}
              referrerPolicy="no-referrer"
              className="size-14 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-14 place-items-center rounded-full bg-live text-xl font-semibold text-on-live">
              {(name ?? "?").trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
              {name}
            </h1>
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-surface p-8">
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              Start a room
            </h2>
            <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted">
              Get a short code and a shareable link. The room expires on its own
              after 24 hours — no cleanup.
            </p>
            <div className="mt-6">
              <CreateRoom />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-8">
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              Join a room
            </h2>
            <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted">
              Have a code? Enter it to check the room and head to the waiting
              door.
            </p>
            <div className="mt-6">
              <JoinByCode />
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
