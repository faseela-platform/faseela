"use client";

import { MARK_COLORS } from "@faseela/tokens/brand";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, type Group, MathUtils, NoToneMapping, PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { buildMarkGeometry, MARK_FRAME, MARK_PIVOT, MARK_Z, paintGradient } from "./mark-geometry";

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
 * Rendering choices, so the lit mark still reads as the logo (the references are the
 * Three.js Journey lessons on materials, lights, environment maps and realistic rendering):
 *
 *  - **No tone mapping.** R3F defaults to ACES filmic, which is right for a photographic scene
 *    and wrong for a brand colour: it darkened and desaturated the teal into something that
 *    was not the token. Colours here must survive to the screen as authored.
 *  - **Brand gradients as vertex colours** (`paintGradient`), the material colour white.
 *  - **An environment map instead of hard key lights.** `RoomEnvironment` through a PMREM
 *    generator gives every surface soft, believable reflections — gold reads as metal, the
 *    covers get a gentle sheen — without a directional light carving dark slabs.
 *  - **Flat, unlit strokes** for the page lines and veins (`MeshBasicMaterial`), as the SVG draws
 *    them. Lit tubes looked like plumbing.
 *
 * Colours are the mark's own stops (`@faseela/tokens/brand`) and follow the theme attribute
 * live. Not `@faseela/tokens/native`: its `./lib/*.js` re-exports do not resolve in the
 * browser bundle, and the scene needs only the mark's colours anyway.
 */
export type SceneTargets = { pointerX: number; pointerY: number; scroll: number };

/**
 * Exposure. With no tone mapping, a face straight to the camera shows the vertex colour times
 * (hemisphere fill + environment irradiance). Both were tuned by sampling the rendered cover
 * against the CSS mark (`.scratch/webgl-sample.mjs`) until the two matched. The environment
 * is scaled on the scene (`environmentIntensity`) — a material's `envMapIntensity` does not
 * apply to a scene-level environment, which was measured, not assumed.
 */
const LIGHT = { hemi: 0.85, env: 0.36 } as const;

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
      gl={{
        antialias: fine,
        stencil: false,
        alpha: true,
        powerPreference: "low-power",
        toneMapping: NoToneMapping,
      }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      onCreated={({ gl, scene, camera }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onFail("context-lost");
        });
        // The room: a neutral studio environment, prefiltered once, shared by every material.
        const pmrem = new PMREMGenerator(gl);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = LIGHT.env;
        pmrem.dispose();
        // Verification hook (`#webgl` only): lets the smoke script inspect the scene graph.
        if (window.location.hash === "#webgl") {
          (window as Window & { __heroScene?: unknown }).__heroScene = { scene, gl, camera };
        }
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
    tealHi: new Color(night ? MARK_COLORS.tealHiNight : MARK_COLORS.tealHi),
    tealLo: new Color(night ? MARK_COLORS.tealLoNight : MARK_COLORS.tealLo),
    goldHi: new Color(night ? MARK_COLORS.goldHiNight : MARK_COLORS.goldHi),
    goldLo: new Color(night ? MARK_COLORS.goldLoNight : MARK_COLORS.goldLo),
    paperHi: new Color(MARK_COLORS.paperHi),
    paperLo: new Color(MARK_COLORS.paperLo),
    pageLine: new Color(MARK_COLORS.pageLine),
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

  // The gradients, painted per part over its own bounding box — the SVG's, in 3D.
  useEffect(() => {
    paintGradient(geometry.coverRight, colors.tealHi, colors.tealLo);
    paintGradient(geometry.coverLeft, colors.tealHi, colors.tealLo);
    paintGradient(geometry.leafLower, colors.tealHi, colors.tealLo);
    paintGradient(geometry.leafUpper, colors.tealHi, colors.tealLo);
    paintGradient(geometry.paper, colors.paperHi, colors.paperLo);
    paintGradient(geometry.stem, colors.goldHi, colors.goldLo);
    invalidate();
  }, [geometry, colors, invalidate]);

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
      {/* Soft fill only; the environment map does the shaping. */}
      <hemisphereLight args={["#ffffff", "#9fb8b2", LIGHT.hemi]} />
      <group position={[MARK_PIVOT.x, MARK_PIVOT.y, 0]}>
        <group ref={group}>
          <group position={[-MARK_PIVOT.x, -MARK_PIVOT.y, 0]}>
            <mesh geometry={geometry.paper} position={[0, 0, MARK_Z.paper]}>
              <meshStandardMaterial vertexColors roughness={0.85} metalness={0} />
            </mesh>
            <mesh geometry={geometry.coverRight}>
              <meshStandardMaterial vertexColors roughness={0.72} metalness={0} />
            </mesh>
            <mesh geometry={geometry.coverLeft}>
              <meshStandardMaterial vertexColors roughness={0.72} metalness={0} />
            </mesh>
            <mesh geometry={geometry.stem} position={[0, 0, MARK_Z.stem]}>
              <meshStandardMaterial vertexColors roughness={0.3} metalness={0.55} />
            </mesh>
            <mesh geometry={geometry.leafLower} position={[0, 0, MARK_Z.leaves]}>
              <meshStandardMaterial vertexColors roughness={0.7} metalness={0} />
            </mesh>
            <mesh geometry={geometry.leafUpper} position={[0, 0, MARK_Z.leaves]}>
              <meshStandardMaterial vertexColors roughness={0.7} metalness={0} />
            </mesh>
            {/* Page lines and veins: flat, unlit, translucent — the strokes the SVG draws. */}
            {geometry.lines.map((g, i) => (
              <mesh key={`line-${i}`} geometry={g} position={[0, 0, MARK_Z.lines]}>
                <meshBasicMaterial color={colors.pageLine} transparent opacity={0.7} />
              </mesh>
            ))}
            {geometry.veins.map((g, i) => (
              <mesh key={`vein-${i}`} geometry={g} position={[0, 0, MARK_Z.veins]}>
                <meshBasicMaterial color={colors.vein} transparent opacity={0.95} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </>
  );
}
