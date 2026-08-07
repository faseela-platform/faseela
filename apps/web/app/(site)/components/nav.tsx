import { hero } from '../content';

const links = [
  { label: 'من نحن', href: '#about' },
  { label: 'كيف تعمل', href: '#tracks' },
] as const;

/**
 * Sticky top navigation.
 *
 * Deliberately not a client component. A scroll-aware nav that changes appearance on scroll is the
 * usual reason a marketing page ships its first JavaScript bundle; here the backdrop blur is
 * unconditional, which costs nothing and keeps the page at zero client JS.
 *
 * `sticky` rather than `fixed` so it participates in layout and cannot overlap the hero's first line
 * on a short viewport.
 */
export function Nav() {
  return (
    <header className="gutter sticky top-0 z-50 border-b border-[var(--hairline)] bg-[color-mix(in_oklch,var(--surface)_88%,transparent)] backdrop-blur-md">
      <nav className="flex items-center justify-between py-4" aria-label="الرئيسية">
        {/*
         * The wordmark at nav scale. Same authored tatweel as the hero — it is part of the mark, and
         * normalising it away here would make the two disagree.
         */}
        <a
          href="#"
          className="font-display text-card-title leading-[1.5] font-semibold text-[var(--brand)]"
        >
          {hero.wordmark}
        </a>

        <ul className="flex items-center gap-6">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-body-sm font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--ink)]"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href="https://linktr.ee/faseela_24"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md border border-[var(--border)] px-4 py-2 text-body-sm font-semibold text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              انضم إلينا
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
