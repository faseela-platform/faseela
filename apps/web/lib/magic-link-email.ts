/**
 * The magic-link email — the one message Faseela sends, and the entire on-ramp
 * to the platform. Built here as a pure `{ subject, text, html }` so it is
 * snapshot-testable without a mail client and carries no dependency.
 *
 * Constraints that shaped it (see magic-link-email.test.ts):
 * - **RTL Arabic.** `dir="rtl" lang="ar"` on the document; the copy is Arabic.
 * - **The URL survives.** It is a real `<a href>` button *and* printed below as
 *   selectable text, because clients mangle buttons and a member who copies a
 *   broken link is locked out. In the plain-text part the URL sits alone on its
 *   line so the bidi algorithm cannot reorder its trailing characters.
 * - **No `oklch()`.** The brand tokens are OKLCH, which Outlook and older Gmail
 *   render as black or drop. Colours are the precomputed sRGB hex of the tokens,
 *   with the OKLCH source in a comment for provenance.
 * - **Web fonts are optional.** Cairo is requested, but the fallback stack must
 *   read well in Arabic on its own, since many clients strip `@import`.
 */

// Brand palette — sRGB hex mirrors of packages/tokens OKLCH (never ship oklch() to email):
const BRAND = "#30917f"; // seedling-500  oklch(0.595 0.093 178.3)
const SURFACE = "#f7fbfa"; // paper-50     oklch(0.985 0.004 178.3)
const CARD = "#ffffff";
const INK = "#0b0e0d"; // paper-950     oklch(0.16 0.006 178.3)
const MUTED = "#767978"; // paper-500     oklch(0.573 0.004 178.3)
const BORDER = "#c1c5c4"; // paper-200     oklch(0.82 0.004 178.3)

const FONT_STACK = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";

export function magicLinkEmail({ url }: { url: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "رابط الدخول إلى فسيلة";

  const text = [
    "أهلًا بك في فسيلة،",
    "",
    "اضغط على الرابط التالي لتسجيل الدخول:",
    "",
    url,
    "",
    "ينتهي هذا الرابط بعد عشر دقائق، ويُستخدم مرة واحدة فقط.",
    "إن لم تكن أنت من طلب هذا الرابط، تجاهل هذه الرسالة.",
  ].join("\n");

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${subject}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
      body { margin: 0; padding: 0; background: ${SURFACE}; }
      a { color: ${BRAND}; }
    </style>
  </head>
  <body style="margin:0; padding:0; background:${SURFACE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SURFACE};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px; max-width:100%; background:${CARD}; border:1px solid ${BORDER}; border-radius:16px;">
            <tr>
              <td style="padding:36px 32px; font-family:${FONT_STACK}; text-align:right;">
                <p style="margin:0 0 4px; font-size:22px; font-weight:700; color:${BRAND}; line-height:1.5;">فسيلة</p>
                <p style="margin:0 0 20px; font-size:18px; font-weight:600; color:${INK}; line-height:1.6;">أهلًا بك،</p>
                <p style="margin:0 0 28px; font-size:16px; color:${INK}; line-height:1.75;">
                  اضغط على الزر التالي لتسجيل الدخول إلى فسيلة.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                  <tr>
                    <td style="border-radius:10px; background:${BRAND};">
                      <a href="${url}" style="display:inline-block; padding:14px 32px; font-family:${FONT_STACK}; font-size:16px; font-weight:700; color:${SURFACE}; text-decoration:none; border-radius:10px;">
                        الدخول إلى فسيلة
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px; font-size:13px; color:${MUTED}; line-height:1.7;">
                  إن لم يعمل الزر، انسخ هذا الرابط والصقه في المتصفح:
                </p>
                <p dir="ltr" style="margin:0 0 28px; font-size:13px; color:${MUTED}; line-height:1.7; word-break:break-all; text-align:left;">
                  ${url}
                </p>
                <hr style="border:none; border-top:1px solid ${BORDER}; margin:0 0 20px;" />
                <p style="margin:0; font-size:13px; color:${MUTED}; line-height:1.7;">
                  ينتهي هذا الرابط بعد عشر دقائق، ويُستخدم مرة واحدة فقط. إن لم تكن أنت من طلبه، تجاهل هذه الرسالة.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
