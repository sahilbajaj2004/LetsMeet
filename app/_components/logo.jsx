// Wordmark with an "on-air" tally dot. The dot's halo pulses (CSS), the tell of a
// live connection. Decorative halo is aria-hidden via the parent's text.

export default function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative grid place-items-center" aria-hidden="true">
        <span
          className="absolute size-2.5 rounded-full bg-live motion-safe:animate-[live-halo_2.6s_ease-in-out_infinite]"
        />
        <span className="size-2.5 rounded-full bg-live" />
      </span>
      <span className="text-[1.05rem] font-semibold tracking-tight text-ink">
        LetsMeet
      </span>
    </span>
  );
}
