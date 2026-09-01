"use client";

import { useEffect, useRef } from "react";

import { STAGE } from "./stage";

/**
 * The grow intro as the generated Lottie (R2-B, ADR 0034) — the same asset the app
 * splash plays, rendered by lottie-web's SVG renderer in the mark's own box. Crisp at
 * any DPI because nothing here passes through the CSS-3D perspective rasterization
 * that softened the keyframe version.
 *
 * Contract with `theme-script.tsx` and `landing.css`:
 *   html[data-grow="js"]   — set pre-paint when JS is on and motion welcome; the CSS
 *                            keyframe intro stands down, the mark layers hide.
 *   html[data-grow="done"] — set here on completion (or bail-out); this overlay fades
 *                            out while the real, interactive mark fades in.
 *   attribute absent       — no JS or reduced motion; this component does nothing.
 *
 * The runtime (~45 KB gz) and the 9 KB asset load in parallel during the intro's
 * light phase; if they take longer than 2.5 s (a very slow line), the intro is
 * skipped for this load and the mark simply appears — never a blank stage.
 */
export function GrowIntro() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.grow !== "js") return;
    let disposed = false;
    let anim: { destroy(): void; addEventListener(n: string, cb: () => void): void } | undefined;
    const done = () => {
      if (root.dataset.grow === "js") root.dataset.grow = "done";
    };
    const bail = window.setTimeout(done, 2500);

    Promise.all([
      import("lottie-web/build/player/lottie_light"),
      fetch("/brand/grow.json").then((r) => r.json()),
    ])
      .then(([mod, data]) => {
        if (disposed || !ref.current) return;
        window.clearTimeout(bail);
        /** The bail already revealed the static mark — starting now would double it. */
        if (root.dataset.grow !== "js") return;
        anim = mod.default.loadAnimation({
          container: ref.current,
          renderer: "svg",
          loop: false,
          autoplay: true,
          animationData: data,
        });
        anim.addEventListener("complete", done);
      })
      .catch(done);

    return () => {
      disposed = true;
      window.clearTimeout(bail);
      anim?.destroy();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="grow-intro-box pointer-events-none absolute"
      style={{
        left: `${(STAGE.markX / STAGE.width) * 100}%`,
        top: `${(STAGE.markY / STAGE.height) * 100}%`,
        width: `${(STAGE.markWidth / STAGE.width) * 100}%`,
        aspectRatio: "240 / 230",
      }}
    />
  );
}
