import { Hero } from "./components/hero";
import { Nav } from "./components/nav";
import { About, App, Join, Steps } from "./components/sections";

/**
 * The landing page — the owner's design (assets/design/faseela-landing.dc.html), ADR 0028/0029.
 *
 * Order follows the owner's page: the hero states the offer with the mark and the real numbers;
 * من نحن explains the initiative and keeps the profile document's wings and stations; المنصّة
 * shows the product; كيف تعمل keeps the four steps; the invitation closes with the channels.
 *
 * Still a server page. The client code is three small islands — the reveal observer, the
 * counters and the hero's tilt/pause — each additive: the HTML is complete without them
 * (ADR 0011, revised). T5 adds the gated WebGL scene on top of the hero.
 */
export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <About />
        <App />
        <Steps />
        <Join />
      </main>
    </>
  );
}
