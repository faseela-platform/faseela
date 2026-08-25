import Link from "next/link";

import { hero } from "../content";
import { SignOutButton } from "./sign-out-button";

/**
 * `route: true` means a real page, reached with `next/link` so the client router
 * prefetches it and the transition costs no document load — the difference
 * between instant and a white flash on a slow Lebanese connection. `route: false`
 * is a fragment on the landing page, left as a plain anchor on purpose: routing
 * to a same-page hash scrolls before the target section's scroll-timeline
 * animations have settled.
 */
const links = [
  { label: "المستجدّات", href: "/mustajaddat", route: true },
  { label: "المسارات", href: "/masarat", route: true },
  { label: "لوحة الموسم", href: "/lawha", route: true },
  { label: "من نحن", href: "/#about", route: false },
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
 *
 * `current` is passed in by the page rather than read from a router hook, because
 * `usePathname` would force this into a client component and put the first
 * JavaScript bundle on every page to render one underline.
 *
 * `signedIn` is likewise passed in. The nav does not read the session itself: a
 * component that calls `getSession` makes every page mounting it dynamic, and the
 * landing page has no reason to become uncacheable because its header could
 * theoretically show a sign-out link.
 *
 * `memberName` is the signed-in Member's name, also passed from the page's
 * session read. Present → shown as the Member's identity; empty (a magic-link
 * account that hasn't completed §5 yet) → replaced by an "أكمل حسابك" prompt, so
 * a nameless Member always has a visible route to finish their account.
 *
 * `tier` is the Member's current tier name (Slice 3), also passed in — the nav
 * never computes it, for the same reason it never reads the session. Present → a
 * small badge beside the name; absent → just the name, so a page that does not
 * compute the tier (most of them) simply omits the badge.
 */
export function Nav({
  current,
  signedIn = false,
  memberName = null,
  tier = null,
}: {
  current?: string;
  signedIn?: boolean;
  memberName?: string | null;
  tier?: string | null;
}) {
  return (
    <header className="gutter sticky top-0 z-50 border-b border-[var(--hairline)] bg-[color-mix(in_oklch,var(--surface)_88%,transparent)] backdrop-blur-md">
      <nav className="flex items-center justify-between gap-4 py-4" aria-label="الرئيسية">
        {/*
         * The wordmark at nav scale. Same authored tatweel as the hero — it is part of the mark, and
         * normalising it away here would make the two disagree.
         *
         * `shrink-0` because without it flexbox compressed the wordmark until it
         * touched the first nav link: at 390px the header rendered
         * "فسيلـةالمسارات" as one run of letters, which in Arabic reads as a
         * single word rather than two elements.
         */}
        <Link
          href="/"
          className="font-display text-card-title shrink-0 leading-[1.5] font-semibold text-[var(--brand)]"
        >
          {hero.wordmark}
        </Link>

        {/*
         * The link list is hidden below 768px and replaced by the single primary
         * action. Three links plus a button do not fit 390px — they wrapped to two
         * lines each and broke the header's height.
         *
         * No hamburger menu, deliberately: a drawer needs client JavaScript and
         * state, and this site has few destinations. The one that matters on a
         * phone stays visible; the rest are a tap away on the landing page, which
         * is where the wordmark leads.
         */}
        <ul className="hidden items-center gap-6 md:flex">
          {links.map((link) => {
            /**
             * `aria-current="page"` is the part that matters. The colour change is
             * invisible to a screen reader, and without this attribute a
             * non-sighted reader has no way to know which page they are on.
             */
            const isCurrent = link.route && current === link.href;
            const className = `text-body-sm font-medium transition-colors duration-[130ms] ease-[var(--ease-hover)] ${
              isCurrent ? "text-[var(--brand)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`;

            return (
              <li key={link.href}>
                {link.route ? (
                  <Link
                    href={link.href}
                    className={className}
                    aria-current={isCurrent ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a href={link.href} className={className}>
                    {link.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>

        {/*
         * The end slot changes with the session, and what it offers is different in
         * kind rather than just in label.
         *
         * Signed out, the primary action stays انضم إلينا — pointing at Linktree,
         * because someone who has never heard of Faseela should be invited to join
         * the initiative, not handed a login form. Sign-in sits beside it as the
         * quieter option, for the Member who already belongs.
         *
         * Signed in, both are pointless: they are already a Member and already
         * authenticated. The slot becomes sign-out.
         */}
        {signedIn ? (
          <div className="flex shrink-0 items-center gap-4">
            {/*
             * The Member's name, now a link to their profile (`/hisabi`) — Slice 3
             * gives the "minimal profile" §30 allowed a home to live at, so the name
             * finally has somewhere to lead. A tier badge sits beside it when the
             * page passed one. A nameless account instead gets the prompt that leads
             * to the §5 completion step.
             */}
            {memberName && memberName.trim() ? (
              <Link
                href="/hisabi"
                className="flex items-center gap-2 transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70"
              >
                <span className="text-body-sm max-w-[9rem] truncate font-medium text-[var(--ink)]">
                  {memberName}
                </span>
                {tier ? (
                  <span className="text-caption rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)] px-2 py-0.5 font-semibold text-[var(--brand)]">
                    {tier}
                  </span>
                ) : null}
              </Link>
            ) : (
              <Link
                href="/akmil-hisabak"
                className="text-body-sm font-semibold text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70"
              >
                أكمل حسابك
              </Link>
            )}
            <SignOutButton />
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-4">
            <Link
              href="/dukhul"
              className="text-body-sm hidden font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--ink)] sm:block"
            >
              دخول
            </Link>
            <a
              href="https://linktr.ee/faseela_24"
              target="_blank"
              rel="noreferrer noopener"
              className="text-body-sm shrink-0 rounded-md border border-[var(--border)] px-4 py-2 font-semibold text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              انضم إلينا
            </a>
          </div>
        )}
      </nav>
    </header>
  );
}
