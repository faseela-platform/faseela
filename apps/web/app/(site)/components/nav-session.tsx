"use client";

import { useSession } from "@/lib/auth-client";
import { JoinLink, SignedInSlot } from "./nav-slots";

/**
 * The header's end slot for pages that cannot read the session on the server.
 *
 * The landing page and `/masarat` are cached (static / ISR), so their HTML is
 * the same for everyone and the nav there was hard-coded signed-out. A Member
 * arriving from a magic link therefore saw «انضم إلينا» and no name, and
 * concluded the sign-in had failed; the CTA then led back to `/dukhul`, which
 * bounced them out again. This island resolves the session in the browser
 * instead, so those pages stay cacheable and still recognise a Member.
 *
 * The server render — and the first client render, while the session request
 * is in flight — is the signed-out `JoinLink`, byte-for-byte the same element
 * the static nav renders, so there is nothing to hydrate differently and no
 * layout shift; the slot swaps only once a session is known. The signed-in slot
 * shows the bell without a count (the count needs a database read the page
 * did not do) and the name the session carries.
 */
export function NavSession({ signInHref }: { signInHref: string }) {
  const { data, isPending } = useSession();
  if (isPending || !data?.user) return <JoinLink href={signInHref} />;
  return <SignedInSlot memberName={data.user.name ?? null} tier={null} unreadCount={0} />;
}
