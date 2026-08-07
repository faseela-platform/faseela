/**
 * A media slot.
 *
 * Faseela has 686 posts of real material, but none of it is cleared for use on a website yet: the
 * photography shows identifiable people at gatherings, and both consent and copyright are the media
 * wing's to grant, not ours to assume. So this renders a graphic placeholder built from the brand's
 * own botanical motif.
 *
 * The slot is real layout, not a stand-in. When approved photography arrives, pass `src` and the
 * placeholder disappears — the composition, aspect ratio and reserved space are unchanged, so no
 * layout shifts and nothing downstream needs editing.
 *
 * `caption` is rendered as a visible credit line when supplied, which is where attribution belongs
 * once real photographs are in place.
 */
export function Media({
  ratio = "4 / 3",
  src,
  alt,
  caption,
  className = "",
}: {
  /** CSS aspect-ratio. Fixed so space is reserved at build time and layout cannot shift. */
  ratio?: string;
  src?: string;
  alt?: string;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div className={`media ${src ? "" : "media-placeholder"}`} style={{ aspectRatio: ratio }}>
        {src ? (
          /* eslint-disable-next-line @next/next/no-img-element -- swapped for next/image when real
             assets land and their dimensions are known */
          <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" />
        ) : null}
      </div>
      {caption ? (
        <figcaption className="text-caption mt-3 text-[var(--ink-muted)]">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
