/**
 * Faseela's ornamental border — a repeating leaf-and-seed motif taken from the logo file, where it
 * sits beneath the wordmark and has never been used on screen.
 *
 * Drawn as strokes so `stroke-dashoffset` can animate it into existence. `stroke-dashoffset` is not
 * a compositor property, but this runs once on load over a handful of short paths, and the
 * alternative (a rasterised reveal) would need a mask and a promoted layer.
 *
 * `data-draw` marks the animated strokes; `--dash-length` must exceed each path's own length or the
 * stroke starts partially visible.
 */
export function Ornament({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 32"
      className={`hero-ornament ${className}`}
      fill="none"
      stroke="var(--accent)"
      strokeWidth="1.25"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ ['--dash-length' as string]: '260' }}
    >
      {/* Baseline, drawn outward from the centre in both directions. */}
      <line data-draw x1="240" y1="16" x2="20" y2="16" pathLength="220" strokeDasharray="220" />
      <line data-draw x1="240" y1="16" x2="460" y2="16" pathLength="220" strokeDasharray="220" />

      {/* Central seed. */}
      <path
        data-draw
        d="M240 5c5.5 4 8 7.5 8 11s-2.5 7-8 11c-5.5-4-8-7.5-8-11s2.5-7 8-11z"
        pathLength="60"
        strokeDasharray="60"
      />

      {/* Paired leaves, mirrored about the centre. */}
      {[80, 140, 200, 280, 340, 400].map((x, i) => (
        <path
          key={x}
          data-draw
          d={
            i < 3
              ? `M${x} 16c0-6 4.5-10.5 11-11-0.5 6.5-5 11-11 11z`
              : `M${x} 16c0-6-4.5-10.5-11-11 .5 6.5 5 11 11 11z`
          }
          pathLength="30"
          strokeDasharray="30"
        />
      ))}

      {/* Small terminal dots. */}
      <circle data-draw cx="20" cy="16" r="2" pathLength="14" strokeDasharray="14" />
      <circle data-draw cx="460" cy="16" r="2" pathLength="14" strokeDasharray="14" />
    </svg>
  );
}
