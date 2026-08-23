/**
 * Outbound email, behind one function.
 *
 * `sendEmail` is the only thing the auth layer knows about; choosing a transport
 * is this file and nothing else. The seam exists so the domain/provider decision
 * can be deferred — and now flipped — without the change leaking into the
 * sign-in flow.
 *
 * A magic-link provider needs SPF and DKIM on a domain you control: sending from
 * a borrowed subdomain is worse than not sending, because the links land in
 * spam and for a product whose only way in is an emailed link a spam-foldered
 * message is an account that cannot be reached. So the transport turns on only
 * when a real provider is configured — `RESEND_API_KEY` + `EMAIL_FROM` — and
 * otherwise stays the console (dev) or a loud guard (prod).
 */

export type Email = {
  to: string;
  subject: string;
  /** Plain text. The deliverability/spam-scoring alternative to the HTML body. */
  text: string;
  /** Optional HTML body. Resend sends it; the console transport ignores it. */
  html?: string;
};

export type EmailTransport = (email: Email) => Promise<void>;

/**
 * Writes the email to the server console.
 *
 * The magic link is printed on its own line, unwrapped and unadorned, because
 * the one thing a developer does with this output is copy the URL. Anything that
 * decorates the line — a box, a prefix, a truncation — makes it unselectable.
 */
const consoleTransport: EmailTransport = async (email) => {
  const rule = "─".repeat(72);
  console.info(
    [
      "",
      rule,
      `  البريد: ${email.to}`,
      `  الموضوع: ${email.subject}`,
      rule,
      email.text,
      rule,
      "",
    ].join("\n"),
  );
};

/**
 * Fails loudly rather than silently in production.
 *
 * If this transport is in use when `NODE_ENV` is `production`, every sign-in
 * would appear to succeed — Better Auth returns 200, the member sees "check
 * your email" — and no email would arrive. That failure is invisible from the
 * outside and indistinguishable from a slow mail server, so it must be
 * impossible to deploy unnoticed.
 */
const productionGuard: EmailTransport = async (email) => {
  throw new Error(
    `No email transport is configured, so the message to ${email.to} was not sent. ` +
      "Set RESEND_API_KEY and EMAIL_FROM (see apps/web/lib/email.ts) before deploying to production.",
  );
};

type ResendConfig = {
  apiKey: string;
  from: string;
  replyTo?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
};

/**
 * A thin transport over Resend's single send endpoint.
 *
 * Raw `fetch`, not the `resend` SDK: the whole surface is one POST, so a
 * dependency buys nothing and an injected `fetch` makes the wire contract
 * testable without a network. A non-2xx response throws, naming the recipient —
 * a dropped magic link is a locked door, and the guard's ethic (loud, never
 * silent) has to hold here too.
 */
export function createResendTransport(config: ResendConfig): EmailTransport {
  const doFetch = config.fetch ?? globalThis.fetch;
  return async (email) => {
    const response = await doFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        ...(email.html ? { html: email.html } : {}),
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Resend refused the message to ${email.to} (HTTP ${response.status}). The magic link was not delivered.`,
      );
    }
  };
}

/** The subset of the environment the transport choice depends on. */
type TransportEnv = {
  NODE_ENV?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
};

const present = (value: string | undefined): value is string => Boolean(value && value.trim());

/**
 * Chooses the transport from the environment alone, and reports whether a
 * message sent right now would actually reach an inbox.
 *
 * `deliverable` is derived from the choice, not declared beside it, so it cannot
 * drift: the day a real provider is configured it becomes true in the same
 * evaluation. `/dukhul` reads it to open or close sign-in — announcing "not yet"
 * costs Faseela far less than showing a visitor an unexplained error.
 *
 * Explicit Resend config wins regardless of `NODE_ENV`, so the real transport
 * can be smoke-tested locally. Otherwise: console in dev, loud guard in prod.
 */
export function selectTransport(env: TransportEnv): {
  transport: EmailTransport;
  deliverable: boolean;
} {
  if (present(env.RESEND_API_KEY) && present(env.EMAIL_FROM)) {
    return {
      transport: createResendTransport({
        apiKey: env.RESEND_API_KEY.trim(),
        from: env.EMAIL_FROM.trim(),
        replyTo: present(env.EMAIL_REPLY_TO) ? env.EMAIL_REPLY_TO.trim() : undefined,
      }),
      deliverable: true,
    };
  }
  if (env.NODE_ENV === "production") {
    return { transport: productionGuard, deliverable: false };
  }
  return { transport: consoleTransport, deliverable: true };
}

const selected = selectTransport(process.env);

export const sendEmail: EmailTransport = (email) => selected.transport(email);

/** Whether a message sent right now would reach a member's inbox. See selectTransport. */
export const emailIsDeliverable: boolean = selected.deliverable;
