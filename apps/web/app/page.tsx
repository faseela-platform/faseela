import { Hero } from "./components/hero";
import { Nav } from "./components/nav";
import { About, Channels, Cta, Rail, Stations, Stats, Tracks } from "./components/sections";

/**
 * The landing page. Fully scroll-driven (round 3, B7 = C), built entirely on native CSS scroll
 * timelines so it holds up on a mid-range Android (ADR 0011).
 *
 * Deliberately a server component with no client boundary: there is no JavaScript on this page at
 * all. The hero is a one-shot CSS animation and every reveal is a CSS scroll timeline, so nothing
 * here needs React on the client. That is the cheapest possible route to the performance floor —
 * a JS scroll library would have shipped a runtime and put the work back on the main thread.
 *
 * Section order follows the page's purpose: legitimacy first, then recruitment, then explanation
 * (round 3, B4 = D). The hadith now opens the hero as its eyebrow rather than occupying a section of
 * its own, and the real numbers follow immediately — evidence before argument.
 */
export default function Page() {
  return (
    <>
      <Nav />
      {/* Page-level, so the position indicator persists for the whole scroll rather than one section. */}
      <Rail />
      <main>
        <Hero />
        <Stats />
        <About />
        <Tracks />
        <Stations />
        <Channels />
        <Cta />
      </main>
    </>
  );
}
