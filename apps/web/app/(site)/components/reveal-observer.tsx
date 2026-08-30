"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Arms the one-shot reveals — ADR 0011 (revised).
 *
 * The markup ships in its final state. This island:
 *   1. does nothing under reduced motion (every load otherwise replays — the owner's call,
 *      2026-08-30: the page should look the same on every refresh);
 *   1b. re-runs on every route change. It lives in the root layout, which React keeps mounted
 *      across client navigations — so an effect that ran once would never observe the next
 *      page's `[data-reveal]` elements, and with `data-reveal-armed` still on <html> they
 *      stayed invisible until a hard refresh (owner report, 2026-08-30);
 *   2. observes every `[data-reveal]`; on the FIRST observer callback it marks the elements
 *      already on screen as revealed, then sets `data-reveal-armed` on <html>, which is what
 *      hides the still-offscreen ones (see landing.css). Nothing is hidden until the observer
 *      has proven it works — a dead observer leaves the page whole;
 *   3. reveals each element once as it enters and forgets it.
 *
 * The per-element delay (`data-reveal="120"`) becomes `--reveal-delay`, capped so a long
 * stagger can never push the last item of a row past the reader's patience.
 */
export function RevealObserver() {
  const pathname = usePathname();
  useEffect(() => {
    const html = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (els.length === 0) return;
    const pending = new Set(els);

    const reveal = (el: HTMLElement) => {
      if (!pending.has(el)) return;
      pending.delete(el);
      const delay = Math.min(Number(el.dataset.reveal ?? 0) || 0, 240);
      el.style.setProperty("--reveal-delay", `${delay}ms`);
      el.setAttribute("data-revealed", "");
    };

    let armed = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            reveal(el);
            io.unobserve(el);
          }
        }
        if (!armed) {
          armed = true;
          html.setAttribute("data-reveal-armed", "");
        }
        if (pending.size === 0) io.disconnect();
      },
      { threshold: 0.18 },
    );
    els.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      html.removeAttribute("data-reveal-armed");
    };
  }, [pathname]);

  return null;
}
