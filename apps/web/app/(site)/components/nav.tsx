import Link from "next/link";

import { hero } from "../content";
import { Mark } from "./mark";
import { Num } from "./num";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

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
  { label: "تواصل", href: "/tawasol", route: true },
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
  unreadCount = 0,
}: {
  current?: string;
  signedIn?: boolean;
  memberName?: string | null;
  tier?: string | null;
  /**
   * How many notifications are new for this Member (§38). Passed in like `tier` and
   * `memberName`, never read here — the bell renders only inside the signed-in branch,
   * so the landing page's nav stays static and JavaScript-free.
   */
  unreadCount?: number;
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
        <Link href="/" className="text-card-title flex shrink-0 items-center gap-2.5 leading-[1.5]">
          {/* The mark beside the wordmark — logo 6a (ADR 0029). Decorative here: the link's text is its name. */}
          <Mark size={36} shadow={false} idPrefix="nav-mark" />
          <span className="wordmark">{hero.wordmark}</span>
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
         * Signed out, the primary action is انضم إلينا. It once pointed at Linktree
         * (the app was not live); since Slice 1 an account is one e-mail away, so the
         * invitation leads to sign-in. دخول sits beside it as the quieter wording of the
         * same door, for the Member who already belongs.
         *
         * Signed in, both are pointless: they are already a Member and already
         * authenticated. The slot becomes sign-out.
         */}
        {signedIn ? (
          /*
           * On a phone this slot cannot hold the toggle, the bell, a name, a tier badge and
           * sign-out beside the wordmark: it overflowed 393px by 61–106px. The name and tier
           * are hidden below `sm` — they live on /hisabi, one tap away via the bell's
           * neighbour — and the gap tightens; the actions stay.
           */
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <ThemeToggle />
            {/*
             * The bell (§38). A link, not a menu: a dropdown would need client
             * JavaScript on every signed-in page to show what the list page shows
             * better. The count is capped at a glyph, because the difference between
             * "twelve" and "many" changes nothing about what you do next.
             */}
            <Link
              href="/ishaarat"
              aria-label={unreadCount > 0 ? `الإشعارات، ${unreadCount} جديدة` : "الإشعارات"}
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[color-mix(in_oklch,var(--brand)_8%,transparent)] hover:text-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {unreadCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[0.625rem] leading-none font-semibold text-[var(--surface)]"
                >
                  {unreadCount > 9 ? <Num value={9} suffix="+" /> : <Num value={unreadCount} />}
                </span>
              ) : null}
            </Link>

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
                className="hidden min-h-11 items-center gap-2 transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70 sm:flex"
              >
                <span className="text-body-sm max-w-[9rem] truncate font-medium text-[var(--ink)]">
                  {memberName}
                </span>
                {tier ? (
                  /* The tier in gold — the identity's colour for standing (ADR 0029). */
                  <span className="text-caption rounded-full bg-[color-mix(in_oklch,var(--gold-hi)_18%,transparent)] px-2 py-0.5 font-semibold text-[var(--accent-ink)]">
                    {tier}
                  </span>
                ) : null}
              </Link>
            ) : (
              <Link
                href="/akmil-hisabak"
                className="text-body-sm hidden min-h-11 items-center font-semibold text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70 sm:flex"
              >
                أكمل حسابك
              </Link>
            )}
            <SignOutButton />
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-4">
            <ThemeToggle />
            <Link
              href="/dukhul"
              className="text-body-sm hidden font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--ink)] sm:block"
            >
              دخول
            </Link>
            {/* Since Slice 1 an account is one e-mail away: the invitation leads to sign-in, not a link tree. */}
            <Link
              href="/dukhul"
              className="text-body-sm shrink-0 rounded-[var(--radius-btn)] border border-[var(--border)] px-4 py-2 font-semibold text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              انضم إلينا
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
