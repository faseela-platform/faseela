import type { RoadStage } from "@/lib/road";

/**
 * طريق الفسائل v2 — the visual road (state mapping in `lib/road.ts`, which is
 * tested and unchanged). Owner round 2026-09-01: the first road read as a "pin
 * on a wire" — this one is a *place*: a wide earthen band with a dashed centre
 * line, planting-circle laybys at each Task, and dense roadside flora, after the
 * owner's aerial-road references.
 *
 * Everything is decorative — the `<ol>` and the cards are the accessible truth,
 * so every lane cell is `aria-hidden`. Authored RTL-first and flipped as one
 * unit for the LTR verification pass (the glyphs are roadside plants, not the
 * mark — ADR 0029's never-mirror rule protects the logo, which never appears
 * here).
 *
 * Colours derive from tokens via `color-mix` against `--surface`, so the road
 * adapts to night mode by construction; teal never sits under opacity (the
 * chroma-ceiling rule).
 */

const BED = "color-mix(in oklch, var(--gold-lo) 26%, var(--surface))";
const BED_EDGE = "color-mix(in oklch, var(--gold-lo) 46%, var(--surface))";
const BED_WALKED = "color-mix(in oklch, var(--gold-hi) 42%, var(--surface))";
const LEAF_DEEP = "color-mix(in oklch, var(--brand) 68%, var(--ink))";

/** The sprout at one planting spot — bolder than v1, drawn for 44px display. */
export function Sprout({ stage, size = 44 }: { stage: RoadStage; size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <ellipse cx="16" cy="26" rx="10" ry="3.5" fill={BED_EDGE} />
      {stage === "soil" ? (
        <circle cx="16" cy="20" r="5.5" fill="none" stroke="var(--ink-muted)" strokeWidth="2" />
      ) : null}
      {stage === "seed" ? <circle cx="16" cy="21" r="4.5" fill="var(--accent)" /> : null}
      {stage === "bud" ? (
        <>
          <path
            d="M16 25 C16 20 16 16 16 12"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse cx="16" cy="9.5" rx="4" ry="5.5" fill="var(--brand)" />
        </>
      ) : null}
      {stage === "returned" ? (
        <>
          <circle
            cx="16"
            cy="16"
            r="12"
            fill="none"
            stroke="var(--accent-ink)"
            strokeWidth="1.75"
            strokeDasharray="3 3"
          />
          <path
            d="M16 25 C16 20 16 17 16 13"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M16 13 C11 10 7 12 6 17 C10 18 14 17 16 13 Z" fill="var(--brand)" />
        </>
      ) : null}
      {stage === "grown" ? (
        <>
          <path
            d="M16 26 C16 18 16 12 16 5"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path d="M16 11 C20 6 25 6 27 10 C24 14 19 14 16 11 Z" fill="var(--brand)" />
          <path d="M16 16 C12 11 7 11 5 15 C8 19 13 18 16 16 Z" fill="var(--brand)" />
        </>
      ) : null}
      {stage === "stone" ? (
        <rect
          x="10.5"
          y="15"
          width="11"
          height="9"
          rx="4.5"
          fill="var(--hairline)"
          stroke="var(--ink-muted)"
          strokeWidth="1.75"
        />
      ) : null}
    </svg>
  );
}

/**
 * Roadside flora — the greenery the references are covered in. Three glyph
 * families (bush cluster, grass tuft, wildflower sprout), deterministic per
 * segment from a tiny hash so the planting never reshuffles between renders,
 * dense on both verges, sized 12–26px, static (calm, and nothing to animate on
 * scroll per ADR 0011's restraint).
 */
type Plant = { kind: 0 | 1 | 2; top: number; left: number; size: number; deep: boolean };

function plantsFor(index: number, count: number): Plant[] {
  const out: Plant[] = [];
  let h = (index + 1) * 2654435761;
  const next = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 0xffffffff;
  };
  for (let i = 0; i < count; i++) {
    const side = i % 2; // alternate verges so both sides stay green
    out.push({
      kind: (Math.floor(next() * 3) % 3) as 0 | 1 | 2,
      top: 4 + next() * 88,
      left: side === 0 ? next() * 15 : 82 + next() * 15,
      size: 15 + Math.round(next() * 17),
      deep: next() > 0.55,
    });
  }
  return out;
}

function PlantGlyph({ plant }: { plant: Plant }) {
  const fill = plant.deep ? LEAF_DEEP : "var(--brand)";
  if (plant.kind === 0) {
    /* Bush — a cluster of three crowns. */
    return (
      <svg viewBox="0 0 24 24" width={plant.size} height={plant.size} aria-hidden="true">
        <circle cx="8" cy="14" r="6" fill={fill} />
        <circle cx="16" cy="15" r="5" fill={plant.deep ? "var(--brand)" : LEAF_DEEP} />
        <circle cx="12" cy="9" r="5.5" fill={fill} />
      </svg>
    );
  }
  if (plant.kind === 1) {
    /* Grass tuft — three blades. */
    return (
      <svg viewBox="0 0 24 24" width={plant.size} height={plant.size} aria-hidden="true">
        <path
          d="M12 22 C12 14 10 10 7 6"
          fill="none"
          stroke={fill}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M12 22 C12 13 12 9 12 4"
          fill="none"
          stroke={fill}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M12 22 C12 14 14 10 17 7"
          fill="none"
          stroke={fill}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  /* Wildflower sprout — a stem with a gold head. */
  return (
    <svg viewBox="0 0 24 24" width={plant.size} height={plant.size} aria-hidden="true">
      <path
        d="M12 22 C12 16 12 12 12 8"
        fill="none"
        stroke={fill}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M12 14 C9 12 6 13 5 16 C8 17 11 16 12 14 Z" fill={fill} />
      <circle cx="12" cy="6.5" r="3" fill="var(--gold-hi)" />
    </svg>
  );
}

/**
 * One row's slice of the road: a wide bed with an edge, a dashed centre line
 * (solid gold once walked), stretched to the row. `vector-effect` keeps the
 * widths true while the curve stretches with tall cards.
 */
function Segment({
  bow,
  walked,
  straight,
}: {
  bow: "start" | "end";
  walked: boolean;
  straight?: boolean;
}) {
  /** RTL-first: a bow toward inline-start (the right) is authored at high x. */
  const apex = bow === "start" ? 116 : 28;
  const d = straight
    ? "M72 0 C72 33 72 67 72 100"
    : `M72 0 C72 30 ${apex} 22 ${apex} 50 C${apex} 78 72 70 72 100`;
  return (
    <svg
      viewBox="0 0 144 100"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={BED_EDGE}
        strokeWidth="40"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke={walked ? BED_WALKED : BED}
        strokeWidth="34"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
      {walked ? (
        <path
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3.5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      ) : (
        <path
          d={d}
          fill="none"
          stroke="var(--surface)"
          strokeWidth="3.5"
          strokeDasharray="11 9"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

/**
 * The lane cell for row `index`: the road segment, a planting-circle layby at
 * the bow's apex carrying the Task's sprout, and the roadside flora. Pinned in
 * physical coordinates (`left`) so everything rides the LTR flip together.
 */
export function RoadLane({
  index,
  stage,
  walked,
}: {
  index: number;
  stage: RoadStage;
  walked: boolean;
}) {
  const bow = index % 2 === 0 ? "start" : "end";
  const apexPct = ((bow === "start" ? 116 : 28) / 144) * 100;
  const plants = plantsFor(index, 9);
  return (
    <div className="relative h-full min-h-28 ltr:-scale-x-100" aria-hidden="true">
      <div className="hidden h-full md:block">
        <Segment bow={bow} walked={walked} />
      </div>
      <div className="h-full md:hidden">
        <Segment bow={bow} walked={walked} straight />
      </div>

      {/* Flora on both verges — desktop only; the phone rail is too narrow to plant. */}
      {plants.map((plant, i) => (
        <span
          key={i}
          className="absolute hidden md:block"
          style={{ top: `${plant.top}%`, left: `${plant.left}%` }}
        >
          <PlantGlyph plant={plant} />
        </span>
      ))}

      {/* The layby: a planting circle pulled off the road on the card's side. */}
      <span
        className="absolute top-1/2 hidden -translate-y-1/2 md:block"
        style={{ left: `calc(${apexPct}% - 32px)` }}
      >
        <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
          <circle cx="32" cy="32" r="29" fill={BED_EDGE} />
          <circle cx="32" cy="32" r="25" fill={walked ? BED_WALKED : BED} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <Sprout stage={stage} />
        </span>
      </span>
      <span
        className="absolute top-1/2 -translate-y-1/2 md:hidden"
        style={{ left: "calc(50% - 24px)" }}
      >
        <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">
          <circle cx="32" cy="32" r="29" fill={BED_EDGE} />
          <circle cx="32" cy="32" r="25" fill={walked ? BED_WALKED : BED} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <Sprout stage={stage} size={34} />
        </span>
      </span>
    </div>
  );
}
