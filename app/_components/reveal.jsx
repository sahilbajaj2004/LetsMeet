"use client";

import { useEffect, useRef } from "react";

/**
 * Reveal-on-scroll wrapper. Content is fully visible by default (no JS / reduced
 * motion); when scripting is present it starts hidden and animates up once it
 * enters the viewport. Never gates content behind the animation.
 */
export default function Reveal({
  as: Tag = "div",
  delay = 0,
  className = "",
  children,
  ...rest
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion: leave the (already-visible) content as-is, no entrance.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // No IntersectionObserver: play the entrance once, immediately.
    if (!("IntersectionObserver" in window)) {
      el.setAttribute("data-revealed", "");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-revealed", "");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal=""
      style={{ "--reveal-delay": `${delay}ms` }}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}
