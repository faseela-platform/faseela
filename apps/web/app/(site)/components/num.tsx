/**
 * A number inside Arabic prose.
 *
 * Digits are strongly LTR, so every number embedded in RTL text is a bidi boundary. Without
 * isolation, adjacent punctuation and neighbouring digits reorder — "17,200+" can render with the
 * plus sign on the wrong side, and two numbers separated by a dash can swap places. This is the
 * single most common Arabic UI defect, and it is invisible to a developer who does not read Arabic.
 *
 * `unicode-bidi: isolate` scopes the number so the surrounding paragraph's direction is unaffected.
 *
 * The formatting is deliberately left to `Intl` with an explicit locale rather than string
 * concatenation, so grouping separators are correct for Lebanon.
 */
export function Num({
  value,
  suffix = '',
  className = '',
}: {
  value: number | string;
  suffix?: string;
  className?: string;
}) {
  const n = typeof value === 'string' ? Number(value) : value;
  const formatted = Number.isFinite(n) ? new Intl.NumberFormat('ar-LB').format(n) : String(value);

  return (
    <span className={`num ${className}`} dir="ltr">
      {formatted}
      {suffix}
    </span>
  );
}
