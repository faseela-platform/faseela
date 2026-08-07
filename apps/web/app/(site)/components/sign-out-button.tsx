"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { signOut } from "@/lib/auth-client";

/**
 * Sign out.
 *
 * `router.refresh()` after the call, not `router.push`. Signing out must
 * re-render the current page rather than navigate away: the Member may be looking
 * at a Track, and throwing them to the home page loses their place. Refresh
 * re-runs the server components, so the same page comes back in its signed-out
 * form — buttons replaced by sign-in prompts.
 *
 * Without the refresh the session cookie is gone but the rendered HTML still shows
 * the signed-in view, so the page claims a session that no longer exists and every
 * button on it fails.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          router.refresh();
        })
      }
      className="text-body-sm shrink-0 rounded-md border border-[var(--border)] px-4 py-2 font-semibold text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50"
    >
      {pending ? "…" : "خروج"}
    </button>
  );
}
