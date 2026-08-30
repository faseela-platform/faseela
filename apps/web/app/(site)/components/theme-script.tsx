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
 * The same script also stamps `data-grown` when the grow intro has already played this session
 * (T1b), so the CSS animation is skipped on internal navigation without a React island. It sets
 * the flag as it reads it: the first page of a session grows, every later one is grown.
 */
const script = `(function(){try{var m=document.cookie.match(/(?:^|; )faseela-theme=(light|dark)/);var t=m?m[1]:null;if(!t){try{t=localStorage.getItem("faseela-theme")}catch(e){}}if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark"){document.documentElement.dataset.theme="dark"}}catch(e){}try{if(sessionStorage.getItem("faseela:grown")==="1"){document.documentElement.dataset.grown="1"}else{sessionStorage.setItem("faseela:grown","1")}}catch(e){}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
