"use client";

import { useEffect, useMemo, useRef } from "react";

// 4 peers as a complete graph (K4 = 6 edges): exactly the product's mesh topology.
// One center node ("you") spoked to three peers, who also connect to each other.
const NODES = [
  { x: 230, y: 205, r: 38, label: "YOU", name: "You", you: true },
  { x: 230, y: 66, r: 30, label: "AD", name: "Ada" },
  { x: 86, y: 320, r: 30, label: "LE", name: "Lee" },
  { x: 374, y: 312, r: 30, label: "MA", name: "Mai" },
];

const EDGES = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];

export default function MeshVisual() {
  const pulseRefs = useRef([]);
  const rafRef = useRef(0);

  // One signal per edge; the three "you" spokes carry a second, offset signal so
  // the center reads as the busiest peer. Direction + speed vary for life.
  const pulses = useMemo(() => {
    const list = [];
    EDGES.forEach((edge, i) => {
      const touchesYou = edge[0] === 0 || edge[1] === 0;
      list.push({ edge, dir: i % 2 === 0 ? 1 : -1, speed: 0.16 + (i % 3) * 0.03, offset: (i * 0.17) % 1 });
      if (touchesYou) {
        list.push({ edge, dir: i % 2 === 0 ? -1 : 1, speed: 0.13 + (i % 2) * 0.04, offset: (i * 0.17 + 0.5) % 1 });
      }
    });
    return list;
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const place = (p, t) => {
      const [a, b] = p.dir === 1 ? p.edge : [p.edge[1], p.edge[0]];
      const na = NODES[a];
      const nb = NODES[b];
      return { x: na.x + (nb.x - na.x) * t, y: na.y + (nb.y - na.y) * t };
    };

    if (reduce) {
      // Static, legible snapshot — no animation loop.
      pulses.forEach((p, i) => {
        const el = pulseRefs.current[i];
        if (!el) return;
        const { x, y } = place(p, 0.5);
        el.setAttribute("cx", x);
        el.setAttribute("cy", y);
        el.setAttribute("opacity", "0.85");
      });
      return;
    }

    let startedAt = 0;
    const frame = (now) => {
      if (!startedAt) startedAt = now;
      const elapsed = (now - startedAt) / 1000;
      pulses.forEach((p, i) => {
        const el = pulseRefs.current[i];
        if (!el) return;
        const t = (elapsed * p.speed + p.offset) % 1;
        const { x, y } = place(p, t);
        el.setAttribute("cx", x);
        el.setAttribute("cy", y);
        // Fade in/out near the endpoints so signals "arrive" and "leave".
        el.setAttribute("opacity", (0.2 + 0.75 * Math.sin(Math.PI * t)).toFixed(3));
      });
      rafRef.current = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!rafRef.current) {
        startedAt = 0;
        rafRef.current = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    // Pause when the visual scrolls offscreen.
    const host = pulseRefs.current[0]?.ownerSVGElement;
    let io;
    if (host && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([e]) => (e.isIntersecting && !document.hidden ? start() : stop()),
        { threshold: 0.05 },
      );
      io.observe(host);
    } else {
      start();
    }

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
    };
  }, [pulses]);

  return (
    <div className="relative mx-auto w-full max-w-[min(34rem,92vw)]">
      {/* Soft presence glow behind the center peer — single, low, not an "orb field". */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--live-glow), transparent 70%)" }}
      />
      <svg
        viewBox="0 0 460 400"
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="A four-person peer-to-peer mesh: you connected directly to three peers, who are also connected to each other."
      >
        {/* Edges */}
        <g stroke="var(--border-strong)" strokeWidth="1.25">
          {EDGES.map(([a, b], i) => {
            const touchesYou = a === 0 || b === 0;
            return (
              <line
                key={i}
                x1={NODES[a].x}
                y1={NODES[a].y}
                x2={NODES[b].x}
                y2={NODES[b].y}
                stroke={touchesYou ? "var(--live)" : "var(--border-strong)"}
                strokeOpacity={touchesYou ? 0.35 : 1}
              />
            );
          })}
        </g>

        {/* Signal pulses */}
        <g fill="var(--live)">
          {pulses.map((_, i) => (
            <circle
              key={i}
              ref={(el) => (pulseRefs.current[i] = el)}
              r="3.4"
              cx="0"
              cy="0"
              opacity="0"
              style={{ filter: "drop-shadow(0 0 5px var(--live))" }}
            />
          ))}
        </g>

        {/* Nodes */}
        {NODES.map((n, i) => (
          <g key={i}>
            {n.you && (
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r + 9}
                fill="none"
                stroke="var(--live)"
                strokeOpacity="0.45"
                strokeWidth="1"
              />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="var(--surface-2)"
              stroke={n.you ? "var(--live)" : "var(--border-strong)"}
              strokeWidth={n.you ? 1.75 : 1.25}
            />
            <text
              x={n.x}
              y={n.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-mono)"
              fontSize={n.you ? 15 : 13}
              fontWeight="600"
              letterSpacing="0.04em"
              fill={n.you ? "var(--live)" : "var(--ink)"}
            >
              {n.label}
            </text>
            {/* live status dot */}
            <circle cx={n.x + n.r * 0.72} cy={n.y - n.r * 0.72} r="4.5" fill="var(--canvas)" />
            <circle cx={n.x + n.r * 0.72} cy={n.y - n.r * 0.72} r="3" fill="var(--live)" />
          </g>
        ))}
      </svg>
    </div>
  );
}
