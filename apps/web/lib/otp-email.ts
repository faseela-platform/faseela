/**
 * The one-time sign-in code email — the mobile on-ramp (§1/§5). A six-digit code the
 * Member types into the app, chosen over an emailed link because a link cannot
 * reliably deep-link back into an Expo app (the `@better-auth/expo` client handles
 * OAuth's in-app browser, not a cold inbound deep link). The web keeps its magic
 * link; this is only sent for mobile `sign-in` OTPs.
 *
 * Same client-safe rules as `magic-link-email.ts`: inline styles, sRGB hex (never
 * `oklch()`, which Outlook renders black), Arabic RTL, and the code repeated in the
 * plain-text part so a client that strips HTML still shows it. The code sits `dir=ltr`
 * on its own line so the bidi algorithm cannot reorder its digits.
 */

// Brand palette — sRGB hex mirrors of packages/tokens OKLCH (never ship oklch() to email):
const BRAND = "#30917f"; // seedling-500
const SURFACE = "#f7fbfa"; // paper-50
const CARD = "#ffffff";
const INK = "#0b0e0d"; // paper-950
const MUTED = "#767978"; // paper-500
const BORDER = "#c1c5c4"; // paper-200

const FONT_STACK = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";

export function otpEmail({ otp }: { otp: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "رمز الدخول إلى فسيلة";

  const text = [
    "أهلًا بك في فسيلة،",
    "",
    "رمز الدخول الخاص بك هو:",
    "",
    otp,
    "",
    "أدخِل هذا الرمز في التطبيق. ينتهي بعد عشر دقائق ويُستخدم مرة واحدة فقط.",
    "إن لم تكن أنت من طلبه، تجاهل هذه الرسالة.",
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
                <p style="margin:0 0 20px; font-size:16px; color:${INK}; line-height:1.75;">
                  رمز الدخول الخاص بك — أدخِله في التطبيق:
                </p>
                <p dir="ltr" style="margin:0 0 28px; padding:16px; background:${SURFACE}; border:1px solid ${BORDER}; border-radius:10px; font-family:${FONT_STACK}; font-size:34px; font-weight:700; letter-spacing:8px; color:${BRAND}; text-align:center;">
                  ${otp}
                </p>
                <hr style="border:none; border-top:1px solid ${BORDER}; margin:0 0 20px;" />
                <p style="margin:0; font-size:13px; color:${MUTED}; line-height:1.7;">
                  ينتهي هذا الرمز بعد عشر دقائق، ويُستخدم مرة واحدة فقط. إن لم تكن أنت من طلبه، تجاهل هذه الرسالة.
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
