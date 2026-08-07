import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { emailIsDeliverable } from "@/lib/email";
import { Nav } from "../components/nav";
import { SignInForm } from "./sign-in-form";

/**
 * Sign in. One field, one button, no password.
 *
 * The route is `/dukhul` rather than `/login` because every other public path on
 * this site is Arabic-derived, and a lone English segment in an otherwise Arabic
 * URL structure reads as machinery showing through.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تسجيل الدخول — مبادرة فسيلة",
  description: "سجّل دخولك إلى فسيلة برابط يُرسل إلى بريدك، دون كلمة سرّ.",
  /**
   * Kept out of search results. This page has nothing to offer a search visitor,
   * and indexing it means the sign-in form can outrank the Track it was meant to
   * lead back to.
   */
  robots: { index: false, follow: true },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;

  /**
   * An already-signed-in Member has nothing to do here, so they are sent onward
   * rather than shown a form that would issue a second session.
   */
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect(safeCallback(callbackURL));

  return (
    <>
      <Nav />
      <main>
        <section className="gutter flex min-h-[70vh] items-center py-16">
          <div className="reveal w-full max-w-md">
            <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
              تسجيل الدخول
            </h1>
            <p className="text-lede mt-5 text-[var(--ink-muted)]">
              أدخل بريدك الإلكتروني، ونرسل إليك رابطاً تدخل به مباشرة. لا كلمة سرّ، ولا حساب جديد.
            </p>

            <div className="hairline rule-draw mt-10 mb-10" />

            {emailIsDeliverable ? (
              <SignInForm callbackURL={safeCallback(callbackURL)} />
            ) : (
              <NotYetOpen />
            )}
          </div>
        </section>
      </main>
    </>
  );
}

/**
 * Shown in place of the form when no email provider is configured.
 *
 * The alternative was to render the form anyway and let it fail. That would be
 * dishonest in a specific and damaging way: the error surfaces after the visitor
 * has typed their address and pressed the button, at which point it reads as a
 * rejection of *them*. Saying so before they type costs nothing and keeps the
 * promise of the page truthful.
 *
 * It deliberately does not explain the cause. "No SPF record on the domain" is our
 * problem, not a member's, and infrastructure detail on a public page reads as an
 * apology for the product rather than a statement about a date.
 */
function NotYetOpen() {
  return (
    <div className="rounded-md border border-[var(--border)] p-6">
      <p className="text-body-lg font-medium text-[var(--ink)]">التسجيل لم يُفتح بعد.</p>
      <p className="text-body-sm mt-3 leading-[1.7] text-[var(--ink-muted)]">
        نُعِدّ الآن ما يلزم لإرسال روابط الدخول إلى بريدك. إلى أن يكتمل ذلك، يمكنك تصفّح المسارات
        والمهامّ ولوحة النقاط دون تسجيل.
      </p>
      <Link
        href="/masarat"
        className="text-body-sm mt-6 inline-block font-semibold text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70"
      >
        تصفّح المسارات
      </Link>
    </div>
  );
}

/**
 * Reduce a caller-supplied `callbackURL` to a same-site path.
 *
 * This is an open-redirect guard, and it is not theoretical: the parameter is
 * attacker-controllable, it is handed to Better Auth, and Better Auth puts it in
 * an email the Member is being told to trust. Without this, a link to
 * `/dukhul?callbackURL=https://evil.example` produces a genuine Faseela magic
 * link that lands the Member on somebody else's site, already authenticated.
 *
 * Allow-listing the shape rather than blocking bad values: it must start with a
 * single `/` and not `//`, which excludes both absolute URLs and protocol-relative
 * ones. `\` is rejected too, because some clients normalise it to `/`.
 */
function safeCallback(raw: string | undefined): string {
  if (!raw) return "/masarat";
  if (!raw.startsWith("/")) return "/masarat";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/masarat";
  if (raw.includes("\\")) return "/masarat";
  return raw;
}
