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
  /* The label names the mode the press leads to — the owner's pill. */
  const label = dark ? "الوضع النهاري" : "الوضع الليلي";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={label}
      className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-4 text-[0.8125rem] font-semibold text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--ink-faint)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none active:scale-[0.97] ${className}`}
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: "linear-gradient(135deg, var(--teal-hi), var(--gold-hi))" }}
      />
      {/* On a phone the dot alone is the toggle; the name is still there for assistive tech. */}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
