import SiteNav from "./_components/site-nav";
import SiteFooter from "./_components/site-footer";
import MeshVisual from "./_components/mesh-visual";
import Reveal from "./_components/reveal";
import { ArrowIcon, LinkIcon } from "./_components/icons";

const STEPS = [
  {
    n: "01",
    title: "Spin up a room",
    body: "Sign in with Google and create a room. You get a short code and a shareable link that expires on its own — no cleanup, no leftovers.",
  },
  {
    n: "02",
    title: "Everyone waits at the door",
    body: "Members and guests land in a waiting room first. You see each request live and accept or decline, one person at a time.",
  },
  {
    n: "03",
    title: "Connect, peer to peer",
    body: "The moment you let someone in, their video links straight to yours. Up to four people, with no server relaying the stream.",
  },
];

export default function Home() {
  return (
    <>
      <SiteNav />

      <main id="top">
        {/* ---------------------------------------------------------------- HERO */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid min-h-[calc(100dvh-4rem)] items-center gap-y-14 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-x-10">
              {/* Copy */}
              <div className="max-w-xl">
                <p
                  className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-faint motion-safe:animate-[reveal-up_0.7s_var(--ease-out-expo)_both]"
                >
                  <span className="relative grid place-items-center">
                    <span className="absolute size-1.5 rounded-full bg-live motion-safe:animate-[live-halo_2.6s_ease-in-out_infinite]" />
                    <span className="size-1.5 rounded-full bg-live" />
                  </span>
                  Live · peer-to-peer video rooms
                </p>

                <h1
                  className="mt-6 text-balance text-[clamp(2.6rem,6vw,4.75rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink motion-safe:animate-[reveal-up_0.8s_var(--ease-out-expo)_both] [animation-delay:80ms]"
                >
                  Four of you, one room, nothing in between.
                </h1>

                <p
                  className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted motion-safe:animate-[reveal-up_0.8s_var(--ease-out-expo)_both] [animation-delay:160ms]"
                >
                  LetsMeet is a video room for up to four people, built on a
                  peer-to-peer mesh. Audio and video travel straight from browser
                  to browser — never through a media server we could see.
                </p>

                <div
                  className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center motion-safe:animate-[reveal-up_0.8s_var(--ease-out-expo)_both] [animation-delay:240ms]"
                >
                  <a
                    href="/login"
                    className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-live px-6 font-semibold text-on-live transition-colors hover:bg-live-deep"
                  >
                    Start a call
                    <ArrowIcon className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                  </a>
                  <a
                    href="#how"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border px-6 font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
                  >
                    <LinkIcon className="size-4 text-muted" />
                    Get a room link
                  </a>
                </div>

                <p
                  className="mt-8 font-mono text-xs tracking-wide text-faint motion-safe:animate-[reveal-up_0.8s_var(--ease-out-expo)_both] [animation-delay:320ms]"
                >
                  P2P MESH · 4 PEERS MAX · WAITING ROOM ON BY DEFAULT
                </p>
              </div>

              {/* Mesh visual */}
              <div className="motion-safe:animate-[reveal-up_1s_var(--ease-out-expo)_both] [animation-delay:200ms]">
                <MeshVisual />
                <p className="mt-2 text-center font-mono text-[0.7rem] uppercase tracking-[0.16em] text-faint">
                  A live 4-peer mesh — every line is a direct connection
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- HOW IT WORKS */}
        <section id="how" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <Reveal className="max-w-2xl">
              <h2 className="text-balance text-[clamp(1.9rem,4vw,3rem)] font-semibold tracking-[-0.03em] text-ink">
                From link to live in three steps.
              </h2>
              <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted">
                The host stays in control the whole way — nothing connects until
                you say so.
              </p>
            </Reveal>

            <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal
                  as="li"
                  key={step.n}
                  delay={i * 90}
                  className="flex flex-col gap-4 bg-surface p-7 sm:p-8"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-live">
                      {step.n}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-ink">
                    {step.title}
                  </h3>
                  <p className="text-pretty leading-relaxed text-muted">
                    {step.body}
                  </p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------- CAPABILITIES */}
        <section id="room" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <Reveal className="max-w-2xl">
              <h2 className="text-balance text-[clamp(1.9rem,4vw,3rem)] font-semibold tracking-[-0.03em] text-ink">
                Built for small, private rooms.
              </h2>
              <p className="mt-4 max-w-lg text-pretty leading-relaxed text-muted">
                Every choice points the same way: fewer people, tighter control,
                and a call that stays between the people in it.
              </p>
            </Reveal>

            <div className="mt-12 grid auto-rows-fr gap-4 md:grid-cols-3">
              {/* Privacy — the anchor feature */}
              <Reveal
                id="privacy"
                className="flex scroll-mt-24 flex-col justify-between gap-8 rounded-2xl border border-border bg-surface p-8 md:col-span-2 md:row-span-2"
              >
                <div className="max-w-md">
                  <h3 className="text-[clamp(1.5rem,2.5vw,2rem)] font-semibold tracking-tight text-ink">
                    No media server. On purpose.
                  </h3>
                  <p className="mt-4 text-pretty leading-relaxed text-muted">
                    Most video apps route your camera through their servers.
                    LetsMeet doesn&apos;t. The mesh connects browsers directly, so
                    the call never lands somewhere we could record. Our database
                    only holds the room itself — the conversation isn&apos;t ours
                    to keep.
                  </p>
                </div>

                <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
                  <div className="bg-surface-2 p-5">
                    <dt className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint">
                      What we store
                    </dt>
                    <dd className="mt-2 text-sm leading-relaxed text-muted">
                      Room code, host, expiry time. Nothing more.
                    </dd>
                  </div>
                  <div className="bg-surface-2 p-5">
                    <dt className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-live">
                      What we never store
                    </dt>
                    <dd className="mt-2 text-sm leading-relaxed text-muted">
                      Audio, video, or anything said on the call.
                    </dd>
                  </div>
                </dl>
              </Reveal>

              {/* Host controls */}
              <Reveal
                delay={80}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-7"
              >
                <h3 className="text-lg font-semibold tracking-tight text-ink">
                  You run the room
                </h3>
                <p className="text-pretty text-sm leading-relaxed text-muted">
                  Mute anyone, remove anyone, or end the call for everyone at
                  once. The host&apos;s controls are never taken away.
                </p>
              </Reveal>

              {/* Waiting room */}
              <Reveal
                delay={120}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-7"
              >
                <h3 className="text-lg font-semibold tracking-tight text-ink">
                  Nobody slips in
                </h3>
                <p className="text-pretty text-sm leading-relaxed text-muted">
                  Every join — member or guest — waits for approval. Decline
                  someone and they&apos;re locked out of that session.
                </p>
              </Reveal>

              {/* Capacity — a single deliberate number */}
              <Reveal
                delay={80}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-surface p-7"
              >
                <span className="font-mono text-[3.25rem] font-semibold leading-none tracking-tight text-live">
                  4
                </span>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-ink">
                    Four, and that&apos;s the point
                  </h3>
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-muted">
                    A mesh stays sharp at four. The fifth join is turned away,
                    not queued.
                  </p>
                </div>
              </Reveal>

              {/* Screen share */}
              <Reveal
                delay={120}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-7 md:col-span-2"
              >
                <h3 className="text-lg font-semibold tracking-tight text-ink">
                  One screen at a time
                </h3>
                <p className="max-w-lg text-pretty text-sm leading-relaxed text-muted">
                  Anyone can share — no host gate — but only one share runs at
                  once. Hit your browser&apos;s stop button and your camera comes
                  back on its own.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- CTA BAND */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <Reveal className="relative overflow-hidden rounded-3xl border border-border bg-canvas px-6 py-16 text-center sm:px-12">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-2/3 rounded-full blur-3xl"
                style={{ background: "radial-gradient(circle, var(--live-glow), transparent 70%)" }}
              />
              <h2 className="relative mx-auto max-w-2xl text-balance text-[clamp(2rem,4.5vw,3.25rem)] font-semibold tracking-[-0.03em] text-ink">
                Start a room. Send the link. Talk.
              </h2>
              <p className="relative mx-auto mt-5 max-w-md text-pretty leading-relaxed text-muted">
                No installs, no lobbies full of strangers. Just a private,
                four-person room that connects the moment you let people in.
              </p>
              <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href="/login"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-live px-7 font-semibold text-on-live transition-colors hover:bg-live-deep"
                >
                  Start a call
                  <ArrowIcon className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                </a>
                <a
                  href="#how"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-border px-7 font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface-2"
                >
                  See how it works
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
