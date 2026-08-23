import { describe, expect, it } from "vitest";

import { magicLinkEmail } from "./magic-link-email";

const url = "https://faseela.example/api/auth/magic-link/verify?token=abc.def";

describe("magicLinkEmail", () => {
  it("keeps the Arabic subject", () => {
    expect(magicLinkEmail({ url }).subject).toBe("رابط الدخول إلى فسيلة");
  });

  it("puts the URL in the button href and again as visible text", () => {
    const { html } = magicLinkEmail({ url });
    expect(html).toContain(`href="${url}"`);
    // Present at least twice: once in the anchor href, once as selectable fallback text.
    const occurrences = html.split(url).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("isolates the URL on its own line in the plain-text body (bidi safety)", () => {
    expect(magicLinkEmail({ url }).text).toContain(`\n${url}\n`);
  });

  it("declares Arabic RTL on the document", () => {
    const { html } = magicLinkEmail({ url });
    expect(html).toMatch(/<html[^>]*dir="rtl"/);
    expect(html).toMatch(/<html[^>]*lang="ar"/);
  });

  it("ships no oklch() — email clients cannot parse it", () => {
    expect(magicLinkEmail({ url }).html).not.toContain("oklch(");
  });
});
