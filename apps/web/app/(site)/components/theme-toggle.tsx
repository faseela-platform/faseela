"use client";

import { useSyncExternalStore } from "react";

const COOKIE = "faseela-theme";

function readTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * The `<html data-theme>` attribute is the store; React only observes it. The server
 * snapshot is always "light" (the server cannot know), hydration renders that, and the
 * client snapshot corrects it in the same commit — no effect, no `setState`, no mismatch.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/**
 * The night toggle — ADR 0012 (revised): light by default, night on request.
 *
 * The one piece of client JavaScript the nav carries, ~600 bytes. The server does not
 * know the theme (see `theme-script.tsx`), so the server snapshot is "light" and the
 * client snapshot — read from the attribute the pre-paint script already set — wins
 * as soon as the component hydrates.
 *
 * `html.no-transitions` for two frames: every element that transitions `color` or
 * `background` would otherwise animate the swap at its own pace, and the page would
 * ripple through the change like a badly synced crossfade (performance rule 10).
 *
 * The choice is written to a cookie *and* localStorage: the cookie is what the
 * pre-paint script trusts first (it is present on the very first request after a
 * choice), localStorage is the fallback if cookies are blocked.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as const);

  function toggle() {
    const next = readTheme() === "dark" ? "light" : "dark";
    const html = document.documentElement;
    html.classList.add("no-transitions");
    if (next === "dark") html.dataset.theme = "dark";
    else delete html.dataset.theme;
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    try {
      localStorage.setItem(COOKIE, next);
    } catch {
      /* private mode — the cookie carries it */
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => html.classList.remove("no-transitions"));
    });
  }

  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "الوضع النهاري" : "الوضع الليلي"}
      title={dark ? "الوضع النهاري" : "الوضع الليلي"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none active:scale-[0.97] ${className}`}
    >
      {dark ? (
        // sun
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="h-5 w-5"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // moon
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
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
