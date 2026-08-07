/**
 * Outbound email, behind one function.
 *
 * Faseela has no domain yet, and a magic-link provider cannot be configured
 * without one: Resend and every comparable service require SPF and DKIM records
 * on a domain you control. Sending from a borrowed subdomain is worse than not
 * sending — the links land in Gmail's spam folder, and for a product whose only
 * way in is an emailed link, a spam-foldered email is an account that cannot be
 * accessed at all.
 *
 * So this is a seam, not a stub. `sendEmail` is the only thing the auth layer
 * knows about; swapping the console transport for a real one is this file and
 * nothing else. The seam exists precisely so that the decision can be deferred
 * without the deferral leaking into the sign-in flow.
 */

export type Email = {
  to: string;
  subject: string;
  /** Plain text. Arabic content — no HTML template yet, and none needed to test the flow. */
  text: string;
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
  const rule = '─'.repeat(72);
  console.info(
    [
      '',
      rule,
      `  البريد: ${email.to}`,
      `  الموضوع: ${email.subject}`,
      rule,
      email.text,
      rule,
      '',
    ].join('\n'),
  );
};

/**
 * Fails loudly rather than silently in production.
 *
 * If this file is still using the console transport when `NODE_ENV` is
 * `production`, every sign-in attempt would appear to succeed — Better Auth
 * returns 200, the member sees "check your email" — and no email would ever
 * arrive. That failure is invisible from the outside and indistinguishable from
 * a slow mail server, so it must be impossible to deploy.
 */
const productionGuard: EmailTransport = async (email) => {
  throw new Error(
    `No email transport is configured, so the message to ${email.to} was not sent. ` +
      'Faseela has no domain yet; configure a provider in apps/web/lib/email.ts ' +
      'before deploying to production.',
  );
};

const transport: EmailTransport =
  process.env.NODE_ENV === 'production' ? productionGuard : consoleTransport;

export const sendEmail: EmailTransport = (email) => transport(email);

/**
 * Whether a message sent right now would actually reach a member's inbox.
 *
 * The guard above makes an unconfigured production deploy fail loudly, which is
 * correct for the server but useless to a visitor: they would fill in the form,
 * press the button, and receive an error that reads as though *their* address were
 * the problem. Deployed with no transport, that is the entire sign-in experience.
 *
 * So the sign-in page reads this and says plainly that entry is not open yet.
 * Announcing the limitation costs Faseela far less than appearing broken, and a
 * visitor told "not yet" comes back, whereas a visitor shown an unexplained error
 * concludes the platform does not work.
 *
 * It is derived from the transport rather than declared separately, so it cannot
 * drift: the day a real provider is configured, this becomes true in the same edit.
 */
export const emailIsDeliverable: boolean = transport !== productionGuard;
