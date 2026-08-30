"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { canRender3D, readGateInput } from "../../../../lib/hero-gate";
import type { SceneTargets } from "./scene-canvas";
import { STAGE } from "./land";

/**
 * The scene is a separate chunk (~190 KB gzipped of three.js) that only devices passing the
 * gate ever download. `ssr: false` is allowed here because this file is a client component;
 * the server HTML is the CSS-3D mark below, always.
 */
const SceneCanvas = dynamic(() => import("./scene-canvas").then((m) => m.SceneCanvas), {
  ssr: false,
  loading: () => null,
});

/**
 * The hero scene island — ADR 0028.
 *
 * Renders the CSS-3D mark synchronously (it IS the server HTML), then adds what only a script
 * can: the pointer tilt, pausing the ambient loops while the hero is scrolled away, and — after
 * the page has loaded, the grow intro has finished, the hero is on screen, the browser is idle
 * AND the capability gate says yes — the WebGL mark, cross-faded over the CSS one.
 *
 * Order matters: the three.js chunk must never compete with the page's own load, so it is
 * requested from `requestIdleCallback` after `load`, and never before the intro ends (the swap
 * would cut the animation). If the scene fails (context lost, under ~30 fps in its first two
 * seconds) it unmounts and the CSS mark simply stays — the visitor never sees an error state.
 *
 * Tilt is written as custom properties (CSS mark) and a mutable ref (WebGL) — never React
 * state, so a pointermove re-renders nothing.
 *
 * The CSS-3D mark arrives as `children`, rendered by the server: passed in rather than
 * imported, its three SVG marks, land and chips are RSC payload that React never hydrates.
 * Importing `<Mark3D>` here would make that whole subtree client code — measured as most
 * of the landing's hydration cost on a throttled phone.
 */
export function HeroScene({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const targets = useRef<SceneTargets>({ pointerX: 0, pointerY: 0, scroll: 0 });
  const [scene, setScene] = useState<"off" | "loading" | "on" | "failed">("off");
  const [reason, setReason] = useState<string>("");
  // Stable identities: both are effect dependencies inside the scene, and a fresh
  // function per render would restart its 2 s self-check on every state change.
  const fail = useCallback((why: string) => {
    setReason(why);
    setScene("failed");
  }, []);
  const ready = useCallback(() => setScene("on"), []);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let cancelled = false;
    const stage = host.querySelector<HTMLElement>(".hero-tilt");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Pause the ambient loops off-screen; feed scroll progress to the scene while on-screen;
    // and hold the WebGL load until the hero is actually in view (ADR 0028 §3).
    let visible = true;
    let wantScene = false;
    const mount = () => {
      if (!cancelled && visible && wantScene) {
        wantScene = false;
        setScene("loading");
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        visible = entry.isIntersecting;
        if (visible) {
          host.removeAttribute("data-scene-paused");
          mount();
        } else host.setAttribute("data-scene-paused", "");
      },
      { threshold: 0.05 },
    );
    io.observe(host);

    const onScroll = () => {
      if (!visible) return;
      const r = host.getBoundingClientRect();
      targets.current.scroll = Math.min(1, Math.max(0, -r.top / Math.max(r.height, 1)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    let onMove: ((e: PointerEvent) => void) | undefined;
    let onLeave: (() => void) | undefined;
    if (fine && !reduced) {
      onMove = (e) => {
        const r = host.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        targets.current.pointerX = x;
        targets.current.pointerY = y;
        stage?.style.setProperty("--tilt-y", `${(x * 16).toFixed(2)}deg`);
        stage?.style.setProperty("--tilt-x", `${(-y * 12).toFixed(2)}deg`);
      };
      onLeave = () => {
        targets.current.pointerX = 0;
        targets.current.pointerY = 0;
        stage?.style.setProperty("--tilt-y", "0deg");
        stage?.style.setProperty("--tilt-x", "0deg");
      };
      host.addEventListener("pointermove", onMove, { passive: true });
      host.addEventListener("pointerleave", onLeave);
    }

    // The gate, then the idle-time load — deferred further until the hero is on screen.
    // `#webgl` forces the gate (verification).
    const decide = () => {
      if (cancelled) return;
      const verdict = canRender3D(readGateInput(window));
      if (!verdict.ok) {
        setReason(verdict.reason);
        return;
      }
      const idle = (
        window as Window & {
          requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
        }
      ).requestIdleCallback;
      const go = () => {
        wantScene = true;
        mount();
      };
      if (idle) idle(go, { timeout: 4000 });
      else window.setTimeout(go, 800);
    };
    // Not before the grow intro has finished (1.6 s) and the document has loaded.
    const afterLoad = () =>
      window.setTimeout(decide, document.documentElement.dataset.grown ? 300 : 2000);
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });

    // If reduced motion flips on mid-session, retire the scene.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      if (mq.matches) fail("reduced-motion-changed");
    };
    mq.addEventListener("change", onMq);

    return () => {
      cancelled = true;
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("load", afterLoad);
      mq.removeEventListener("change", onMq);
      if (onMove) host.removeEventListener("pointermove", onMove);
      if (onLeave) host.removeEventListener("pointerleave", onLeave);
    };
  }, [fail]);

  const active = scene === "loading" || scene === "on";

  return (
    /* `data-scene-reason` is diagnostic only — why the scene is off or failed, for verification. */
    <div ref={ref} className="relative" data-scene={scene} data-scene-reason={reason || undefined}>
      {children}
      {active ? (
        /* Same box as the CSS mark's layers, so the two overlay exactly; fades in on ready. */
        <div
          aria-hidden="true"
          className="pointer-events-none absolute transition-opacity duration-700 ease-[var(--ease-enter)]"
          style={{
            left: `${(STAGE.markX / STAGE.width) * 100}%`,
            top: `${(STAGE.markY / STAGE.height) * 100}%`,
            width: `${(STAGE.markWidth / STAGE.width) * 100}%`,
            aspectRatio: "240 / 230",
            opacity: scene === "on" ? 1 : 0,
          }}
        >
          <SceneCanvas
            targets={targets}
            onReady={ready}
            onFail={fail}
            skipCheck={typeof window !== "undefined" && window.location.hash === "#webgl"}
          />
        </div>
      ) : null}
    </div>
  );
}
