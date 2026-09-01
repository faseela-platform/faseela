/**
 * Applies the visitor's theme before first paint — ADR 0012 (revised).
 *
 * Order of authority: the `faseela-theme` cookie (written by the toggle, so a visitor's
 * choice survives a cleared localStorage and reaches the *first* HTML byte's paint
 * without a server read), then localStorage, then `prefers-color-scheme`. Light is the
 * default and is expressed as the *absence* of `data-theme`, so the light stylesheet is
 * never the second thing painted.
 *
 * Deliberately a blocking inline script, not a server read of the cookie: `cookies()`
 * in the root layout would make every route dynamic and cost the landing its static
 * render and `/masarat` its ISR. The script runs in under a millisecond and the
 * `suppressHydrationWarning` on `<html>` covers the attribute React did not render.
 */
/*
 * The grow intro (T1b) is NOT gated here: the owner chose to replay it on every load (2026-08-30)
 * — one consistent first second, rather than a page that looks different on the second visit.
 *
 * `data-grow="js"` (R2-B, ADR 0034): when JS is on and motion is welcome, the Lottie intro
 * will play, so the CSS keyframe intro stands down and the mark layers hide until the island
 * finishes (`data-grow="done"`). Set pre-paint for the same reason as the theme: the CSS
 * intro must never start a frame before being replaced. No JS → attribute absent → the CSS
 * intro runs untouched. Reduced motion → attribute absent → the static final frame stands.
 */
const script = `(function(){try{var m=document.cookie.match(/(?:^|; )faseela-theme=(light|dark)/);var t=m?m[1]:null;if(!t){try{t=localStorage.getItem("faseela-theme")}catch(e){}}if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark"){document.documentElement.dataset.theme="dark"}if(!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.grow="js"}}catch(e){}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
