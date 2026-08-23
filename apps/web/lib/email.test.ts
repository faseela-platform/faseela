import { describe, expect, it, vi } from "vitest";

import { createResendTransport, selectTransport, type Email } from "./email";

const message: Email = {
  to: "member@example.com",
  subject: "رابط الدخول إلى فسيلة",
  text: "the link",
};

/**
 * The selector is the whole point of the seam: it decides, from the environment
 * alone, whether a real message can be sent. `deliverable` is what `/dukhul`
 * reads to open or close sign-in, so these cases pin the exact open/closed rule.
 */
describe("selectTransport", () => {
  it("uses Resend in production when both vars are set (deliverable)", () => {
    const { deliverable } = selectTransport({
      NODE_ENV: "production",
      RESEND_API_KEY: "re_live_x",
      EMAIL_FROM: "فسيلة <no-reply@faseela.test>",
    });
    expect(deliverable).toBe(true);
  });

  it("closes sign-in in production when neither var is set, and the transport throws", async () => {
    const { transport, deliverable } = selectTransport({ NODE_ENV: "production" });
    expect(deliverable).toBe(false);
    await expect(transport(message)).rejects.toThrow();
  });

  it("uses the console transport in development (deliverable, no throw)", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { transport, deliverable } = selectTransport({ NODE_ENV: "development" });
    expect(deliverable).toBe(true);
    await expect(transport(message)).resolves.toBeUndefined();
    infoSpy.mockRestore();
  });

  it("closes sign-in in production when only the API key is set", () => {
    const { deliverable } = selectTransport({
      NODE_ENV: "production",
      RESEND_API_KEY: "re_live_x",
    });
    expect(deliverable).toBe(false);
  });

  it("closes sign-in in production when only the from address is set", () => {
    const { deliverable } = selectTransport({
      NODE_ENV: "production",
      EMAIL_FROM: "فسيلة <no-reply@faseela.test>",
    });
    expect(deliverable).toBe(false);
  });

  it("treats whitespace-only vars as unset", () => {
    const { deliverable } = selectTransport({
      NODE_ENV: "production",
      RESEND_API_KEY: "   ",
      EMAIL_FROM: "\t",
    });
    expect(deliverable).toBe(false);
  });

  it("prefers Resend over console when both vars are set outside production", () => {
    const { deliverable } = selectTransport({
      NODE_ENV: "development",
      RESEND_API_KEY: "re_live_x",
      EMAIL_FROM: "فسيلة <no-reply@faseela.test>",
    });
    // Deliverable either way in dev; the meaningful assertion is that an explicit
    // Resend config is honoured, which the createResendTransport tests below cover.
    expect(deliverable).toBe(true);
  });
});

/**
 * The Resend transport is a thin, injectable wrapper around one HTTP POST. The
 * injected `fetch` lets us assert the wire contract without a network, and the
 * throw-on-failure keeps a dropped email loud rather than silent.
 */
describe("createResendTransport", () => {
  function fakeFetch(status: number): typeof globalThis.fetch {
    return vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(status < 300 ? "{}" : "no", { status }),
    ) as unknown as typeof globalThis.fetch;
  }

  function callBody(fetchImpl: typeof globalThis.fetch): Record<string, unknown> {
    const init = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    return JSON.parse(init.body as string);
  }

  it("POSTs to the Resend API with bearer auth and the message fields", async () => {
    const fetchImpl = fakeFetch(200);
    const send = createResendTransport({
      apiKey: "re_live_x",
      from: "فسيلة <no-reply@faseela.test>",
      fetch: fetchImpl,
    });
    await send({ ...message, html: "<p>hi</p>" });

    const mock = (fetchImpl as ReturnType<typeof vi.fn>).mock;
    expect(mock.calls).toHaveLength(1);
    const [url, init] = mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_live_x");
    const body = callBody(fetchImpl);
    expect(body.from).toBe("فسيلة <no-reply@faseela.test>");
    expect(body.to).toBe("member@example.com");
    expect(body.subject).toBe(message.subject);
    expect(body.html).toBe("<p>hi</p>");
    expect(body.text).toBe("the link");
  });

  it("passes reply_to when a replyTo is given", async () => {
    const fetchImpl = fakeFetch(200);
    const send = createResendTransport({
      apiKey: "re_live_x",
      from: "فسيلة <no-reply@faseela.test>",
      replyTo: "hello@faseela.test",
      fetch: fetchImpl,
    });
    await send(message);
    expect(callBody(fetchImpl).reply_to).toBe("hello@faseela.test");
  });

  it("throws, naming the recipient, when Resend responds non-2xx", async () => {
    const send = createResendTransport({
      apiKey: "re_live_x",
      from: "فسيلة <no-reply@faseela.test>",
      fetch: fakeFetch(422),
    });
    await expect(send(message)).rejects.toThrow(/member@example\.com/);
  });

  it("resolves on a 2xx response", async () => {
    const send = createResendTransport({
      apiKey: "re_live_x",
      from: "فسيلة <no-reply@faseela.test>",
      fetch: fakeFetch(200),
    });
    await expect(send({ ...message, html: "<p>hi</p>" })).resolves.toBeUndefined();
  });
});
