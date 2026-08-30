/**
 * Renders the grow intro («النبتة تخرج من الكتاب») to video for social — T1b, ADR 0029.
 *
 * One source of motion: the keyframes in `apps/web/app/landing.css` (the `grow intro` block) are
 * lifted verbatim into a standalone page with the mark from `mark-svg.mjs`, so the clip IS the
 * site's intro. Frames are captured deterministically by pausing every animation and seeking
 * `currentTime` — no real-time capture, no dropped frames — then ffmpeg encodes them.
 *
 *   node scripts/brand/export-video.mjs           # all variants
 *   node scripts/brand/export-video.mjs preview   # only the light square GIF, for approval
 *
 * Output: ../assets/brand/motion/grow-{light,night}-{1080x1080,1080x1920}.{mp4,webm,gif}
 * (WebM keeps alpha for the transparent variant: grow-alpha-1080x1080.webm.)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { PAPER, markSvg } from "./mark-svg.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "../assets/brand/motion");
const CAIRO = pathToFileURL(
  resolve(ROOT, "apps/native/node_modules/@expo-google-fonts/cairo/700Bold/Cairo_700Bold.ttf"),
).href;
const NIGHT = "#0b0e0d";
const FPS = 30;
const SECONDS = 2.6; // 1.6 s of growth + a 1 s hold on the final frame
const only = process.argv[2] ?? "all";

/** The grow block, verbatim, from the site's stylesheet. */
const landingCss = readFileSync(resolve(ROOT, "apps/web/app/landing.css"), "utf8");
const growStart = landingCss.indexOf(
  "/* ------------------------------------------------------------ grow intro */",
);
if (growStart < 0) throw new Error("grow intro block not found in landing.css");
const growCss = landingCss.slice(growStart);

const page = ({
  w,
  h,
  bg,
  night,
  size,
  wordmark,
}) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
  @font-face { font-family: Cairo; src: url("${CAIRO}") format("truetype"); font-weight: 700; }
  :root { --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1); --gold-hi: ${night ? "#ecd08a" : "#e3bd4e"}; --gold-lo: ${night ? "#c7a958" : "#b18f2f"}; }
  html, body { margin: 0; width: ${w}px; height: ${h}px; background: ${bg}; overflow: hidden; }
  body { display: grid; place-items: center; }
  .stack { display: flex; flex-direction: column; align-items: center; gap: 0; }
  .wm { font-family: Cairo; font-weight: 700; font-size: ${Math.round(size * 0.24)}px; line-height: 1.3; letter-spacing: 0; background: linear-gradient(180deg, var(--gold-hi), var(--gold-lo)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; padding-bottom: .08em; animation: grow-fade 0.6s var(--ease-out-expo) 1.5s both; }
  ${growCss}
</style></head><body><div class="stack">${markSvg({ size, grow: true })}${wordmark ? `<div class="wm">فسيلـــة</div>` : ""}</div></body></html>`;

const VARIANTS = [
  {
    name: "grow-light-1080x1080",
    w: 1080,
    h: 1080,
    bg: PAPER,
    night: false,
    size: 620,
    wordmark: true,
    formats: ["mp4", "webm", "gif"],
  },
  {
    name: "grow-night-1080x1080",
    w: 1080,
    h: 1080,
    bg: NIGHT,
    night: true,
    size: 620,
    wordmark: true,
    formats: ["mp4", "webm", "gif"],
  },
  {
    name: "grow-light-1080x1920",
    w: 1080,
    h: 1920,
    bg: PAPER,
    night: false,
    size: 700,
    wordmark: true,
    formats: ["mp4", "webm", "gif"],
  },
  {
    name: "grow-night-1080x1920",
    w: 1080,
    h: 1920,
    bg: NIGHT,
    night: true,
    size: 700,
    wordmark: true,
    formats: ["mp4", "webm", "gif"],
  },
  {
    name: "grow-alpha-1080x1080",
    w: 1080,
    h: 1080,
    bg: "transparent",
    night: false,
    size: 760,
    wordmark: false,
    formats: ["webm-alpha"],
  },
];

const chosen =
  only === "preview"
    ? [{ ...VARIANTS[0], formats: ["gif"] }]
    : only === "story"
      ? VARIANTS.filter((v) => v.h === 1920)
      : VARIANTS;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const v of chosen) {
  const frames = resolve(OUT, `.frames-${v.name}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const p = await ctx.newPage();
  await p.setContent(page(v), { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const total = Math.round(SECONDS * FPS);
  for (let i = 0; i < total; i++) {
    const t = (i / FPS) * 1000;
    await p.evaluate(
      (ms) =>
        document.getAnimations().forEach((a) => {
          a.currentTime = ms;
        }),
      t,
    );
    await p.screenshot({
      path: resolve(frames, `f${String(i).padStart(4, "0")}.png`),
      omitBackground: v.bg === "transparent",
    });
  }
  await ctx.close();

  const input = ["-framerate", String(FPS), "-i", resolve(frames, "f%04d.png")];
  for (const f of v.formats) {
    const out = resolve(OUT, `${v.name}.${f === "webm-alpha" ? "webm" : f}`);
    const args =
      f === "mp4"
        ? [
            ...input,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "18",
            "-movflags",
            "+faststart",
            out,
          ]
        : f === "webm"
          ? [...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "28", "-pix_fmt", "yuv420p", out]
          : f === "webm-alpha"
            ? [
                ...input,
                "-c:v",
                "libvpx-vp9",
                "-b:v",
                "0",
                "-crf",
                "28",
                "-pix_fmt",
                "yuva420p",
                out,
              ]
            : [
                ...input,
                "-vf",
                `fps=${FPS},scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4`,
                "-loop",
                "0",
                out,
              ];
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
    console.log("wrote", out.replace(ROOT, "."));
  }
  rmSync(frames, { recursive: true, force: true });
  writeFileSync(resolve(OUT, `${v.name}.html`), page(v)); // the exact page each clip was rendered from
}
await browser.close();
console.log("done");
