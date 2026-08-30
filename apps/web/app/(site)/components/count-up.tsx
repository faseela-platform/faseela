"use client";

import { useEffect, useRef } from "react";

const format = (n: number) => new Intl.NumberFormat("ar-LB").format(n);

/**
 * A number that counts up once, when it scrolls into view — the owner's landing counters.
 *
 * Renders the FINAL value on the server (so no-JS and reduced-motion readers see the fact, not a
 * zero), and only when the element is half on screen does it rewind to zero and ease up over
 * 1.4 s (cubic ease-out — fast start, gentle settle). `.num` isolates the digits from the RTL
 * paragraph and gives them tabular figures so the column does not shimmer while counting.
 */
export function CountUp({
  value,
  suffix = "",
  className = "",
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const t0 = performance.now();
        const duration = 1400;
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = format(Math.round(value * eased)) + suffix;
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, suffix]);

  return (
    <span ref={ref} className={`num ${className}`} dir="ltr">
      {format(value)}
      {suffix}
    </span>
  );
}
