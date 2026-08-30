/**
 * Renders every raster the mark needs, from the single geometry source
 * (`packages/tokens/brand.ts`), with Playwright's Chromium.
 *
 * Why not `next/og` / Satori: Satori does not run OpenType shaping, so Arabic letters
 * render disconnected. Chromium shapes Cairo correctly, so the wordmark is real text.
 *
 *   node scripts/brand/render.mjs            # everything
 *   node scripts/brand/render.mjs web        # only apps/web icons + OG
 *   node scripts/brand/render.mjs native     # only apps/native/assets/images
 *   node scripts/brand/render.mjs social     # only assets/brand/exports
 *
 * Outputs (all PNG):
 *   apps/web/app/apple-icon.png            180   paper ground
 *   apps/web/app/opengraph-image.png       1200×630
 *   apps/native/assets/images/icon.png      1024  paper ground
 *   apps/native/assets/images/android-icon-foreground.png 1024 transparent, 66% safe zone
 *   apps/native/assets/images/android-icon-background.png 1024 flat paper
 *   apps/native/assets/images/android-icon-monochrome.png 1024 mono, transparent
 *   apps/native/assets/images/splash-icon.png 512  transparent
 *   apps/native/assets/images/favicon.png     48
 *   assets/brand/exports/{mark-1080,logo-light-1080,logo-night-1080,profile-1080}.png
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { MARK_COLORS, MARK_PATHS } from "../../packages/tokens/brand.ts";
import { writeFileSync } from "node:fs";
import { PAPER, markSvg } from "./mark-svg.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_WEB = resolve(ROOT, "apps/web/app");
const OUT_NATIVE = resolve(ROOT, "apps/native/assets/images");
const OUT_SOCIAL = resolve(ROOT, "../assets/brand/exports");
const CAIRO = pathToFileURL(
  resolve(ROOT, "apps/native/node_modules/@expo-google-fonts/cairo/700Bold/Cairo_700Bold.ttf"),
).href;

const NIGHT = "#0b0e0d";
const only = process.argv[2] ?? "all";
const want = (group) => only === "all" || only === group;

const wordmark = (size, night) =>
  `<span style="font-family: Cairo; font-weight: 700; font-size: ${size}px; line-height: 1.3; background: linear-gradient(180deg, ${night ? "#ecd08a" : MARK_COLORS.goldHi}, ${night ? "#c7a958" : MARK_COLORS.goldLo}); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 0;">فسيلـــة</span>`;

const page = (
  w,
  h,
  bg,
  inner,
) => `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
  @font-face { font-family: Cairo; src: url("${CAIRO}") format("truetype"); font-weight: 700; }
  html, body { margin: 0; width: ${w}px; height: ${h}px; background: ${bg}; overflow: hidden; }
  body { display: grid; place-items: center; font-family: Cairo, sans-serif; -webkit-font-smoothing: antialiased; }
</style></head><body>${inner}</body></html>`;

/** [group, relative output path, width, height, background ("transparent" allowed), inner HTML] */
const SPECS = [
  // web
  ["web", [OUT_WEB, "apple-icon.png"], 180, 180, PAPER, markSvg({ size: 132, shadow: false })],
  [
    "web",
    [OUT_WEB, "opengraph-image.png"],
    1200,
    630,
    PAPER,
    `<div style="width: 1200px; height: 630px; display: grid; grid-template-columns: 1.15fr 0.85fr; align-items: center; padding: 0 64px 0 48px; box-sizing: border-box; background: radial-gradient(60% 60% at 30% 60%, rgba(189,231,220,0.7) 0%, rgba(189,231,220,0) 70%), ${PAPER};">
      <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start; color: #0b0e0d;">
        ${wordmark(124, false)}
        <span style="font-size: 40px; font-weight: 700; line-height: 1.5; white-space: nowrap;">نغرس <span style="color: #30917f;">الوعي</span> في جيلٍ يصنع غدَه</span>
        <span style="font-size: 22px; font-weight: 700; color: #5d6260; margin-top: 14px;">مبادرة شبابية لبنانية <span style="font-family: 'Segoe UI', Rubik, system-ui, sans-serif; font-weight: 600; color: #8e9191;">· faseela.vercel.app</span></span>
      </div>
      <div style="display: grid; place-items: center;">${markSvg({ size: 420 })}</div>
    </div>`,
  ],
  // native
  ["native", [OUT_NATIVE, "icon.png"], 1024, 1024, PAPER, markSvg({ size: 720, shadow: false })],
  [
    "native",
    [OUT_NATIVE, "android-icon-foreground.png"],
    1024,
    1024,
    "transparent",
    markSvg({ size: 560, shadow: false }),
  ],
  ["native", [OUT_NATIVE, "android-icon-background.png"], 1024, 1024, PAPER, ""],
  [
    "native",
    [OUT_NATIVE, "android-icon-monochrome.png"],
    1024,
    1024,
    "transparent",
    markSvg({ size: 560, mono: true, shadow: false, color: "#000000" }),
  ],
  [
    "native",
    [OUT_NATIVE, "splash-icon.png"],
    512,
    512,
    "transparent",
    markSvg({ size: 400, shadow: false }),
  ],
  ["native", [OUT_NATIVE, "favicon.png"], 48, 48, PAPER, markSvg({ size: 40, shadow: false })],
  // social
  ["social", [OUT_SOCIAL, "mark-1080.png"], 1080, 1080, "transparent", markSvg({ size: 820 })],
  [
    "social",
    [OUT_SOCIAL, "logo-light-1080.png"],
    1080,
    1080,
    PAPER,
    `<div style="display: flex; flex-direction: column; align-items: center; gap: 0;">${markSvg({ size: 620 })}${wordmark(150, false)}</div>`,
  ],
  [
    "social",
    [OUT_SOCIAL, "logo-night-1080.png"],
    1080,
    1080,
    NIGHT,
    `<div style="display: flex; flex-direction: column; align-items: center; gap: 0;">${markSvg({ size: 620 })}${wordmark(150, true)}</div>`,
  ],
  [
    "social",
    [OUT_SOCIAL, "profile-1080.png"],
    1080,
    1080,
    PAPER,
    `<div style="width: 1080px; height: 1080px; display: grid; place-items: center; background: radial-gradient(circle at 50% 42%, #eafaf6 0%, ${PAPER}62%);">${markSvg({ size: 700 })}</div>`,
  ],
];

/** The tab icon: the mark simplified for 16–32 px — no shadow, sheen, hairline or veins, strokes thickened. */
function iconSvg() {
  const P = MARK_PATHS,
    C = MARK_COLORS;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 230">
  <!-- Faseela mark, logo 6a (ADR 0029). Generated by scripts/brand/render.mjs from packages/tokens/brand — do not edit. -->
  <defs>
    <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.tealHi}"/><stop offset="1" stop-color="${C.tealLo}"/></linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.goldHi}"/><stop offset="1" stop-color="${C.goldLo}"/></linearGradient>
  </defs>
  <path d="${P.paperEdge}" fill="${C.paperLo}"/>
  <path d="${P.coverRight}" fill="url(#t)"/>
  <path d="${P.coverLeft}" fill="url(#t)"/>
  <path d="${P.linesRight} ${P.linesLeft}" stroke="${C.pageLine}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.75"/>
  <path d="${P.stem}" stroke="url(#g)" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="${P.leafLower}" fill="url(#t)"/>
  <path d="${P.leafUpper}" fill="url(#t)"/>
</svg>
`;
}
if (want("web")) {
  writeFileSync(resolve(OUT_WEB, "icon.svg"), iconSvg());
  console.log("wrote ./apps/web/app/icon.svg");
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
let n = 0;
for (const [group, [dir, file], w, h, bg, inner] of SPECS) {
  if (!want(group)) continue;
  mkdirSync(dir, { recursive: true });
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(page(w, h, bg === "transparent" ? "transparent" : bg, inner), {
    waitUntil: "load",
  });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({
    path: resolve(dir, file),
    omitBackground: bg === "transparent",
    clip: { x: 0, y: 0, width: w, height: h },
  });
  await p.close();
  n++;
  console.log("wrote", resolve(dir, file).replace(ROOT, "."));
}
await browser.close();
console.log(`${n} files`);
