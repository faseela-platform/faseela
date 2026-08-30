/**
 * The Arabic sentence /dukhul shows when a magic link fails to verify.
 *
 * Better Auth redirects a failed `/magic-link/verify` to the `errorCallbackURL`
 * the form asked for, with `?error=<CODE>` appended. Left unmapped, the Member
 * lands on the sign-in page with no explanation and concludes the site is
 * broken — the link they clicked ten minutes ago simply did nothing. Every
 * code becomes a sentence that says what happened and what to do next, and a
 * code we have never seen still becomes a sentence rather than the raw token.
 *
 * `INVALID_TOKEN` is what Better Auth sends for both a used and a malformed
 * token (tokens are consumed atomically on first use), so its sentence covers
 * "used before". `EXPIRED_TOKEN` is kept as its own case because the copy
 * should not claim the link was used when it was not.
 *
 * Pure and tested (auth-errors.test.ts).
 */
const MESSAGES: Record<string, string> = {
  INVALID_TOKEN: "انتهت صلاحية الرابط أو استُخدم من قبل. اطلب رابطاً جديداً.",
  EXPIRED_TOKEN: "انتهت صلاحية الرابط. اطلب رابطاً جديداً.",
};

const FALLBACK = "تعذّر تسجيل الدخول بهذا الرابط. اطلب رابطاً جديداً.";

export function signInErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code.toUpperCase()] ?? FALLBACK;
}
