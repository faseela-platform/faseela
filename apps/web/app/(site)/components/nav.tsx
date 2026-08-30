import Link from "next/link";

import { hero } from "../content";
import { Mark } from "./mark";
import { NavSession } from "./nav-session";
import { JoinLink, SignedInSlot } from "./nav-slots";
import { ThemeToggle } from "./theme-toggle";

/**
 * The owner's header has three groups, start to end: the mark, the product (where a Member
 * goes to *do* something), and the initiative (where a visitor goes to *learn* something)
 * followed by the theme pill and the one primary action.
 *
 * `route: true` means a real page, reached with `next/link` so the client router prefetches
 * it and the transition costs no document load. `route: false` is a fragment on the landing
 * page, left as a plain anchor on purpose: routing to a same-page hash scrolls before the
 * target section's reveals have settled.
 */
const productLinks = [
  { label: "المستجدّات", href: "/mustajaddat", route: true },
  { label: "المسارات", href: "/masarat", route: true },
  { label: "لوحة الموسم", href: "/lawha", route: true },
] as const;

const initiativeLinks = [
  { label: "من نحن", href: "/#about", route: false },
  { label: "المنصّة", href: "/#app", route: false },
  { label: "تواصل", href: "/tawasol", route: true },
] as const;

type NavLink = (typeof productLinks)[number] | (typeof initiativeLinks)[number];

/**
 * Top navigation.
 *
 * A server component. A scroll-aware nav that changes appearance on scroll is the usual reason
 * a marketing page ships its first JavaScript bundle; here the header is either a plain overlay
 * (the landing, `overlay`) or a sticky blurred bar (every product page), and neither needs
 * script. The one client piece is the end slot on pages that cannot read the session on the
 * server (`signedIn` undefined → `nav-session.tsx`, ~1 KB): it server-renders the signed-out
 * link and swaps to the member's slot once `useSession` resolves, so `/` and `/masarat` stay
 * static without ever showing a signed-in member the door.
 *
 * `overlay` lays the header over the hero's own sky — no border, no backdrop — so the top of
 * the landing reads as one piece, as the owner drew it. Product pages keep the sticky bar: a
 * page of rows and forms needs its header to stay put and be separable from what scrolls under
 * it.
 *
 * `current` is passed in by the page rather than read from a router hook, because
 * `usePathname` would force this into a client component and put the first JavaScript bundle
 * on every page to render one underline.
 *
 * `signedIn` is likewise passed in. The nav does not read the session itself: a component that
 * calls `getSession` makes every page mounting it dynamic, and the landing page has no reason
 * to become uncacheable because its header could theoretically show a sign-out link.
 *
 * It is three-valued. `true`/`false` is server truth from a page that read the session, and
 * renders without a flash. `undefined` — the page did not say — hands the end slot to the
 * `NavSession` island, which renders the signed-out action on the server and swaps to the
 * signed-in slot in the browser once `useSession` resolves. That is what lets the cached
 * pages (`/`, `/masarat`) recognise a Member without becoming dynamic; a page that knows
 * the answer should always pass it.
 *
 * `memberName` is the signed-in Member's name, also passed from the page's session read.
 * Present → shown as the Member's identity; empty (a magic-link account that hasn't completed
 * §5 yet) → replaced by an "أكمل حسابك" prompt, so a nameless Member always has a visible route
 * to finish their account.
 *
 * `tier` is the Member's current tier name (Slice 3), also passed in — the nav never computes
 * it, for the same reason it never reads the session.
 */
export function Nav({
  current,
  overlay = false,
  signedIn,
  memberName = null,
  tier = null,
  unreadCount = 0,
}: {
  current?: string;
  /** Lay the header over the page's first section instead of a sticky bar. */
  overlay?: boolean;
  /** Server truth when the page read the session; leave undefined to let the client resolve it. */
  signedIn?: boolean;
  memberName?: string | null;
  tier?: string | null;
  /**
   * How many notifications are new for this Member (§38). Passed in like `tier` and
   * `memberName`, never read here — the bell renders only inside the signed-in slot, and
   * on the static pages (client island) it shows without a count.
   */
  unreadCount?: number;
}) {
  const linkClass = (link: NavLink) => {
    /**
     * `aria-current="page"` is the part that matters. The colour change is invisible to a
     * screen reader, and without this attribute a non-sighted reader has no way to know
     * which page they are on.
     */
    const isCurrent = link.route && current === link.href;
    return {
      isCurrent,
      className: `text-body-sm font-medium transition-colors duration-[130ms] ease-[var(--ease-hover)] ${
        isCurrent ? "text-[var(--brand)]" : "text-[var(--ink)] hover:text-[var(--brand)]"
      }`,
    };
  };

  /**
   * Where sign-in returns to. A visitor who pressed «انضم إلينا» on the Tracks page wants
   * the Tracks page back, not a generic home, so the current path rides along as
   * `callbackURL`; /dukhul validates it with `safeInternalPath` and falls back to the
   * personalised home when there is none.
   */
  const signInHref = current ? `/dukhul?callbackURL=${encodeURIComponent(current)}` : "/dukhul";

  const renderLink = (link: NavLink) => {
    const { isCurrent, className } = linkClass(link);
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
  };

  return (
    <header
      className={
        overlay
          ? "gutter absolute inset-x-0 top-0 z-50"
          : "gutter sticky top-0 z-50 border-b border-[var(--hairline)] bg-[color-mix(in_oklch,var(--surface)_88%,transparent)] backdrop-blur-md"
      }
    >
      <nav className="flex items-center justify-between gap-4 py-4 md:py-5" aria-label="الرئيسية">
        {/*
         * The wordmark at nav scale. Same authored tatweel as the hero — it is part of the
         * mark, and normalising it away here would make the two disagree.
         *
         * `shrink-0` because without it flexbox compressed the wordmark until it touched the
         * first nav link: at 390px the header rendered "فسيلـةالمسارات" as one run of letters,
         * which in Arabic reads as a single word rather than two elements.
         */}
        <Link href="/" className="text-card-title flex shrink-0 items-center gap-2.5 leading-[1.5]">
          {/* The mark beside the wordmark — logo 6a (ADR 0029). Decorative here: the link's text is its name. */}
          <Mark size={36} shadow={false} idPrefix="nav-mark" />
          <span className="wordmark">{hero.wordmark}</span>
        </Link>

        {/*
         * The product links, centred. Hidden below `lg`: with two link groups, the pill and a
         * button, a phone's header holds only the mark, the pill and the primary action. No
         * hamburger menu, deliberately: a drawer needs client JavaScript and state, and the
         * destinations are a tap away on the landing page, which is where the wordmark leads.
         */}
        <ul className="hidden items-center gap-7 lg:flex">{productLinks.map(renderLink)}</ul>

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <ul className="hidden items-center gap-6 md:flex">{initiativeLinks.map(renderLink)}</ul>
          <ThemeToggle />

          {/*
           * The end slot changes with the session, and what it offers is different in kind
           * rather than just in label. Signed out, the one primary action is انضم إلينا —
           * since Slice 1 an account is one e-mail away, so the invitation leads to sign-in,
           * and it is the same door for the Member who already belongs. Signed in, it is
           * pointless: the slot becomes the bell, the name and sign-out.
           */}
          {signedIn === true ? (
            <SignedInSlot memberName={memberName} tier={tier} unreadCount={unreadCount} />
          ) : signedIn === false ? (
            <JoinLink href={signInHref} />
          ) : (
            <NavSession signInHref={signInHref} />
          )}
        </div>
      </nav>
    </header>
  );
}
