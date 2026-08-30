import { hero } from "../../content";
import { Mark } from "../mark";
import { Land, STAGE } from "./land";

/**
 * The owner's layered CSS-3D mark — the hero's SSR state and the fallback for every device
 * the WebGL gate declines (ADR 0028).
 *
 * A 460×500 stage holding, back to front: the glow disc, the land, the dashed orbit ring, the
 * mark at three depths (`translateZ` 0/34/72 — the parallax the pointer tilt makes visible), the
 * ground shadow, and the three loop chips. The whole stage floats; `hero-scene/index.tsx` tilts
 * it toward the pointer by writing two custom properties.
 *
 * Everything here is decorative for assistive tech: the mark's name is in the nav, and the loop
 * the chips depict is repeated as real text for screen readers.
 */
const CHIP_POSITIONS: React.CSSProperties[] = [
  { top: "6%", insetInlineEnd: "-8%" },
  { top: "40%", insetInlineStart: "-22%" },
  { top: "84%", insetInlineEnd: "-4%" },
];

const CHIP_DELAYS = ["-1.5s", "-3.5s", "-5s"] as const;

export function Mark3D() {
  return (
    <div
      className="relative mx-auto w-full max-w-[460px]"
      style={{ aspectRatio: `${STAGE.width} / ${STAGE.height}`, perspective: "1200px" }}
    >
      {/* Tilt and float are two elements: both animate `transform`, and on one element the
          float loop would win the cascade and the pointer tilt would never show. */}
      <div className="hero-tilt absolute inset-0">
        <div className="hero-float absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {/* Glow disc — the ambient light the mark floats in. */}
          <div
            aria-hidden="true"
            className="absolute rounded-full"
            style={{
              inset: "8%",
              background: "radial-gradient(circle, var(--glow) 0%, transparent 70%)",
              transform: "translateZ(-90px)",
            }}
          />

          <Land />

          {/* The orbit ring. */}
          <div
            aria-hidden="true"
            className="hero-ring absolute"
            style={{ inset: "2%", transform: "translateZ(-50px)" }}
          >
            <svg viewBox="0 0 440 440" width="100%" height="100%">
              <circle
                cx="220"
                cy="220"
                r="208"
                fill="none"
                strokeWidth="1"
                strokeDasharray="3 14"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* The mark, three layers deep. The back two carry no shadow — one ground shadow is enough. */}
          {[0, 34, 72].map((z, i) => (
            <div
              key={z}
              className={`absolute ${i === 2 ? "" : "hero-mark-back"}`}
              style={{
                left: `${(STAGE.markX / STAGE.width) * 100}%`,
                top: `${(STAGE.markY / STAGE.height) * 100}%`,
                width: `${(STAGE.markWidth / STAGE.width) * 100}%`,
                transform: `translateZ(${z}px)`,
                opacity: i === 2 ? 1 : 0.35,
                filter:
                  i === 2
                    ? "drop-shadow(0 18px 24px color-mix(in oklch, var(--ink) 18%, transparent))"
                    : undefined,
              }}
            >
              <Mark
                size={STAGE.markWidth}
                shadow={i === 2}
                grow={i === 2}
                idPrefix={`hero-mark-${i}`}
                className="h-auto w-full"
              />
            </div>
          ))}

          {/* The loop chips. Decorative — the same loop is real text below for screen readers. */}
          {hero.chips.map((chip, i) => (
            <div
              key={chip.label}
              aria-hidden="true"
              className="hero-chip absolute z-10 hidden items-center gap-3 px-4 py-3 md:flex"
              style={{
                ...CHIP_POSITIONS[i],
                animationDelay: CHIP_DELAYS[i],
                transform: "translateZ(90px)",
              }}
            >
              <ChipIcon kind={chip.icon} />
              <span className="flex flex-col">
                <span className="text-body-sm leading-[1.5] font-bold text-[var(--ink)]">
                  {chip.label}
                </span>
                <span className="text-caption text-[var(--ink-muted)]">{chip.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="sr-only">{hero.chips.map((c) => c.label).join("، ")}</p>
    </div>
  );
}

/** The three chip icons: tracks (a path), check, and a progress ring. */
export function ChipIcon({ kind }: { kind: (typeof hero.chips)[number]["icon"] }) {
  if (kind === "ring") {
    return (
      <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden="true" className="shrink-0">
        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--hairline)" strokeWidth="5" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="var(--gold-hi)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="113"
          strokeDashoffset="40"
          transform="rotate(-90 22 22)"
        />
      </svg>
    );
  }
  const check = kind === "check";
  return (
    <span
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
      style={{
        background: check ? "var(--teal-hi)" : "var(--surface-raised)",
        boxShadow: "0 0 0 1px var(--hairline)",
        color: check ? "#0b0e0d" : "var(--brand)",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {check ? (
          <path d="M20 6L9 17l-5-5" />
        ) : (
          <path d="M5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 18h6a4 4 0 0 0 0-8h-2a4 4 0 0 1 0-8h6" />
        )}
      </svg>
    </span>
  );
}
