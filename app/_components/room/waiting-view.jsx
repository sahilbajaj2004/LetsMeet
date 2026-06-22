"use client";

// Shown to a joiner after they knock, until the host accepts or declines.
export default function WaitingView({ hostName }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center">
        <span className="size-3 animate-ping rounded-full bg-live" />
        <span className="absolute size-3 rounded-full bg-live" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">
        Waiting for the host to let you in
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted">
        {hostName ? `${hostName} has been notified.` : "The host has been notified."}{" "}
        You will join the call as soon as they accept.
      </p>
    </div>
  );
}
