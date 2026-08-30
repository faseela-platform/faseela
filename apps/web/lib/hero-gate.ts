/**
 * The capability gate for the hero's WebGL scene — ADR 0028.
 *
 * Pure: everything it reads is passed in, so it is unit-tested without a browser and the
 * island (`hero-scene/index.tsx`) only has to collect the facts. The default is NO — the
 * CSS-3D mark is the contract every device gets; the scene is an upgrade for devices that
 * have proven they can afford it.
 *
 * Why each rule (mid-range Android on Lebanese mobile data is the floor):
 *  - reduced motion: the scene is motion; the visitor asked for less of it.
 *  - Save-Data: ~190 KB of gzipped JavaScript is exactly what they asked not to receive.
 *  - no WebGL2: the renderer would fall back to WebGL1 with worse precision and no guarantee.
 *  - deviceMemory ≤ 2 GB (only when reported — iOS never reports it, and every iPhone can
 *    run this): the parse cost of three.js alone stalls a 2 GB phone.
 *  - ≤ 6 cores: measured, not guessed — on Lighthouse's 4×-throttled mobile profile the
 *    three.js chunk alone cost 3.5 s of main thread, and budget octa-cores are weaker than
 *    that profile. Six is where mid-range stops and capable begins.
 *  - `#webgl` in the URL forces the scene on and `#noscene` forces it off, for verification
 *    and audits only: headless Chromium reports few cores and renders WebGL through
 *    SwiftShader, and Lighthouse on a desktop reports many cores — neither is the phone the
 *    floor is set for, so each path is audited by asking for it. (Lighthouse no longer
 *    marks its user agent, so sniffing it is not an option.)
 */
export type GateInput = {
  reducedMotion: boolean;
  saveData: boolean;
  webgl2: boolean;
  /** `navigator.deviceMemory`, undefined where unsupported (all of iOS). */
  deviceMemory: number | undefined;
  /** `navigator.hardwareConcurrency`, undefined where unsupported. */
  cores: number | undefined;
  /** `location.hash`, for the `#webgl` / `#noscene` overrides. */
  hash?: string;
};

export type GateVerdict = { ok: true } | { ok: false; reason: string };

export function canRender3D(input: GateInput): GateVerdict {
  if (input.hash === "#webgl") return { ok: true };
  if (input.hash === "#noscene") return { ok: false, reason: "forced-off" };
  if (input.reducedMotion) return { ok: false, reason: "prefers-reduced-motion" };
  if (input.saveData) return { ok: false, reason: "save-data" };
  if (!input.webgl2) return { ok: false, reason: "no-webgl2" };
  if (input.deviceMemory !== undefined && input.deviceMemory <= 2)
    return { ok: false, reason: "low-memory" };
  if (input.cores !== undefined && input.cores <= 6) return { ok: false, reason: "few-cores" };
  return { ok: true };
}

/** Collects the facts from a real browser. Kept apart from the decision so the decision stays pure. */
export function readGateInput(win: Window & typeof globalThis): GateInput {
  const nav = win.navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  let webgl2 = false;
  try {
    const canvas = win.document.createElement("canvas");
    webgl2 = canvas.getContext("webgl2") !== null;
  } catch {
    webgl2 = false;
  }
  return {
    reducedMotion: win.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: nav.connection?.saveData === true,
    webgl2,
    deviceMemory: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    cores: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined,
    hash: win.location.hash,
  };
}
