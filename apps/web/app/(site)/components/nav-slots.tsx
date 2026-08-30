import Link from "next/link";

import { Num } from "./num";
import { SignOutButton } from "./sign-out-button";

/**
 * The header's end slot, in its two states. Kept apart from `nav.tsx` so the same
 * markup can be rendered by the server nav (when the page knows the session) and
 * by the client island `nav-session.tsx` (when it does not) — one definition, so
 * the two can never disagree about what a signed-in header looks like.
 *
 * No `"use client"` here: imported from a Server Component this renders on the
 * server; imported from the island it ships with it. `SignOutButton` is already
 * a client component either way.
 */

/** The one primary action for a visitor. `href` carries the return path when the page has one. */
export function JoinLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="text-body-sm inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-btn)] bg-[var(--brand)] px-5 font-semibold text-[var(--surface)] transition-[background-color,transform] duration-[150ms] ease-[var(--ease-out-expo)] hover:bg-[var(--brand-deep)] active:scale-[0.97]"
      style={{ boxShadow: "0 8px 20px var(--glow)" }}
    >
      انضم إلينا
    </Link>
  );
}

/**
 * The signed-in slot: the bell, the name (or the §5 prompt), sign-out.
 *
 * On a phone this slot cannot hold the pill, the bell, a name, a tier badge and
 * sign-out beside the wordmark. The name and tier are hidden below `sm` — they
 * live on /hisabi, one tap away — and the actions stay. The «أكمل حسابك» prompt
 * is *not* hidden at any width: it is the only route a nameless Member has to
 * finishing their account, and a phone is where most of them sign in.
 */
export function SignedInSlot({
  memberName,
  tier,
  unreadCount,
}: {
  memberName: string | null;
  tier: string | null;
  unreadCount: number;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
      {/*
       * The bell (§38). A link, not a menu: a dropdown would need client JavaScript
       * on every signed-in page to show what the list page shows better. The count
       * is capped at a glyph, because the difference between "twelve" and "many"
       * changes nothing about what you do next.
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
       * The Member's name, a link to their profile (`/hisabi`). A tier badge sits
       * beside it when the page passed one. A nameless account instead gets the
       * prompt that leads to the §5 completion step.
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
          className="text-body-sm inline-flex min-h-11 shrink-0 items-center font-semibold whitespace-nowrap text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70"
        >
          أكمل حسابك
        </Link>
      )}
      <SignOutButton />
    </div>
  );
}
