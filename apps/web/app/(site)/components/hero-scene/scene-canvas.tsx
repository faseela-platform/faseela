"use client";

import { MARK_COLORS } from "@faseela/tokens/brand";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, type Group, MathUtils } from "three";

import { buildMarkGeometry, MARK_FRAME, MARK_PIVOT } from "./mark-geometry";

/**
 * The WebGL mark — ADR 0028. Mounted by `hero-scene/index.tsx` only after the gate says yes;
 * everything about it is budgeted:
 *
 *  - `frameloop="demand"`: nothing renders unless something changed. Pointer and scroll write
 *    targets; `useFrame` eases toward them and re-invalidates only while the error is above ε,
 *    so the scene settles and then costs zero GPU time at rest.
 *  - `dpr` capped at 1.5, no antialias on coarse pointers, no shadows, no post-processing.
 *  - An orthographic camera framing the viewBox exactly, so the canvas overlays the CSS mark
 *    pixel-for-pixel and the swap between them is invisible.
 *  - A 2 s self-check: if the first two seconds average under ~30 fps, `onFail` unmounts the
 *    scene and the CSS mark stays. The heuristics in the gate cannot know every GPU.
 *  - `webglcontextlost` → `onFail` too.
 *
 * Colours are the mark's own stops (`@faseela/tokens/brand`) and follow the theme attribute
 * live. Not `@faseela/tokens/native`: its `./lib/*.js` re-exports do not resolve in the
 * browser bundle, and the scene needs only the mark's colours anyway.
 */
export type SceneTargets = { pointerX: number; pointerY: number; scroll: number };

export function SceneCanvas({
  targets,
  onReady,
  onFail,
  skipCheck = false,
}: {
  /** Mutable targets the island writes: pointer in −0.5..0.5, scroll progress 0..1. */
  targets: React.MutableRefObject<SceneTargets>;
  onReady: () => void;
  onFail: (reason: string) => void;
  /** `#webgl` verification: headless Chromium's software renderer would fail the fps check. */
  skipCheck?: boolean;
}) {
  const fine =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      orthographic
      camera={{
        left: 0,
        right: MARK_FRAME.width,
        top: 0,
        bottom: -MARK_FRAME.height,
        near: -500,
        far: 500,
        position: [0, 0, 100],
      }}
      gl={{ antialias: fine, stencil: false, alpha: true, powerPreference: "low-power" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onFail("context-lost");
        });
      }}
    >
      <MarkMesh targets={targets} onReady={onReady} onFail={onFail} skipCheck={skipCheck} />
    </Canvas>
  );
}

function themeColors() {
  const night =
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  return {
    teal: new Color(night ? MARK_COLORS.tealLoNight : MARK_COLORS.tealLo),
    tealHi: new Color(night ? MARK_COLORS.tealHiNight : MARK_COLORS.tealHi),
    gold: new Color(night ? MARK_COLORS.goldHiNight : MARK_COLORS.goldHi),
    paper: new Color(MARK_COLORS.paperLo),
    paperLine: new Color(MARK_COLORS.pageLine),
    vein: new Color(MARK_COLORS.vein),
  };
}

function MarkMesh({
  targets,
  onReady,
  onFail,
  skipCheck,
}: {
  targets: React.MutableRefObject<SceneTargets>;
  onReady: () => void;
  onFail: (r: string) => void;
  skipCheck: boolean;
}) {
  const group = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => buildMarkGeometry(), []);
  const [colors, setColors] = useState(themeColors);
  const check = useRef({ frames: 0, start: 0, done: false });

  // Follow the theme toggle live.
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setColors(themeColors());
      invalidate();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [invalidate]);

  useEffect(() => {
    onReady();
    check.current.start = performance.now();
    // Keep rendering for the first two seconds so the self-check measures real throughput.
    const id = window.setInterval(invalidate, 16);
    const stop = window.setTimeout(() => {
      window.clearInterval(id);
      const elapsed = (performance.now() - check.current.start) / 1000;
      const fps = check.current.frames / Math.max(elapsed, 0.1);
      check.current.done = true;
      if (fps < 28 && !skipCheck) onFail(`slow:${fps.toFixed(0)}fps`);
    }, 2000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [invalidate, onReady, onFail, skipCheck]);

  const current = useRef({ x: 0, y: 0, s: 0 });
  useFrame(() => {
    if (!check.current.done) check.current.frames++;
    const g = group.current;
    if (!g) return;
    const t = targets.current;
    const c = current.current;
    c.x = MathUtils.lerp(c.x, t.pointerX, 0.08);
    c.y = MathUtils.lerp(c.y, t.pointerY, 0.08);
    c.s = MathUtils.lerp(c.s, t.scroll, 0.08);
    // Pointer → tilt (matches the CSS-3D fallback's ±16°/±12°); scroll → a slow turn and a lift.
    g.rotation.y = MathUtils.degToRad(c.x * 16 + c.s * 22);
    g.rotation.x = MathUtils.degToRad(-c.y * 12 + c.s * 6);
    g.position.y = -c.s * 18;
    const err = Math.abs(c.x - t.pointerX) + Math.abs(c.y - t.pointerY) + Math.abs(c.s - t.scroll);
    if (err > 0.0015 || !check.current.done) invalidate();
  });

  // Geometry is y-up (see mark-geometry.ts). The rotating group pivots on the spine's base.
  return (
    <>
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#ffffff", "#7a8a86", 1.0]} />
      <directionalLight position={[-120, 160, 220]} intensity={1.6} />
      <directionalLight position={[180, -40, 120]} intensity={0.4} color={colors.gold} />
      <group position={[MARK_PIVOT.x, MARK_PIVOT.y, 0]}>
        <group ref={group}>
          <group position={[-MARK_PIVOT.x, -MARK_PIVOT.y, 0]}>
            <mesh geometry={geometry.paper} position={[0, 0, -2]}>
              <meshStandardMaterial color={colors.paper} roughness={0.9} metalness={0} />
            </mesh>
            <mesh geometry={geometry.coverRight}>
              <meshStandardMaterial color={colors.teal} roughness={0.55} metalness={0.1} />
            </mesh>
            <mesh geometry={geometry.coverLeft}>
              <meshStandardMaterial color={colors.teal} roughness={0.55} metalness={0.1} />
            </mesh>
            <mesh geometry={geometry.stem}>
              <meshStandardMaterial color={colors.gold} roughness={0.35} metalness={0.6} />
            </mesh>
            <mesh geometry={geometry.leafLower} position={[0, 0, 6]}>
              <meshStandardMaterial color={colors.tealHi} roughness={0.5} metalness={0.05} />
            </mesh>
            <mesh geometry={geometry.leafUpper} position={[0, 0, 6]}>
              <meshStandardMaterial color={colors.tealHi} roughness={0.5} metalness={0.05} />
            </mesh>
            {/* Page lines and veins: the strokes the SVG draws, so the cross-fade drops nothing. */}
            {geometry.lines.map((g, i) => (
              <mesh key={`line-${i}`} geometry={g}>
                <meshStandardMaterial
                  color={colors.paperLine}
                  roughness={0.8}
                  metalness={0}
                  transparent
                  opacity={0.75}
                />
              </mesh>
            ))}
            {geometry.veins.map((g, i) => (
              <mesh key={`vein-${i}`} geometry={g}>
                <meshStandardMaterial color={colors.vein} roughness={0.6} metalness={0} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </>
  );
}
