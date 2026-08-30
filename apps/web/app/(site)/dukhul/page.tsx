import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { signInErrorMessage } from "@/lib/auth-errors";
import { emailIsDeliverable } from "@/lib/email";
import { safeInternalPath } from "@/lib/safe-path";
import { Mark } from "../components/mark";
import { Nav } from "../components/nav";
import { buttonClass, Card } from "../components/ui";
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
  searchParams: Promise<{ callbackURL?: string; error?: string }>;
}) {
  const { callbackURL, error } = await searchParams;

  /**
   * An already-signed-in Member has nothing to do here, so they are sent onward
   * rather than shown a form that would issue a second session.
   */
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect(safeInternalPath(callbackURL));

  /**
   * A magic link that failed to verify lands back here with `?error=` (the form
   * asks for that via `errorCallbackURL`). Without this notice the failure is a
   * silent dead end: the Member clicked the link, got the sign-in page again,
   * and has no idea whether to wait, retry, or give up.
   */
  const notice = signInErrorMessage(error);

  return (
    <>
      {/* Server truth: a session here would already have redirected, so the nav need not ask the client. */}
      <Nav signedIn={false} />
      <main>
        <section className="gutter mx-auto flex min-h-[70vh] max-w-[1440px] items-center py-16">
          <Card reveal={0} className="w-full max-w-md p-8">
            <Mark size={56} idPrefix="signin-mark" />
            <h1 className="font-display mt-5 text-[clamp(1.75rem,3.6vw,2.441rem)] leading-[1.42] font-extrabold text-[var(--ink)]">
              تسجيل الدخول
            </h1>
            <p className="lede text-body mt-3 text-[var(--ink-muted)]">
              أدخل بريدك الإلكتروني، ونرسل إليك رابطاً تدخل به مباشرة. لا كلمة سرّ، ولا حساب جديد.
            </p>

            {notice ? (
              /*
               * `role="alert"` so it is announced on arrival; a bordered block rather
               * than muted text because this is the answer to "why am I back here",
               * and it must read before the form does.
               */
              <p
                role="alert"
                className="text-body-sm mt-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[color-mix(in_oklch,var(--brand)_6%,transparent)] px-4 py-3 leading-[1.7] font-medium text-[var(--ink)]"
              >
                {notice}
              </p>
            ) : null}

            <div className="mt-8">
              {emailIsDeliverable ? (
                <SignInForm callbackURL={safeInternalPath(callbackURL)} />
              ) : (
                <NotYetOpen />
              )}
            </div>
          </Card>
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
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] p-5">
      <p className="text-body-lg font-medium text-[var(--ink)]">التسجيل لم يُفتح بعد.</p>
      <p className="text-body-sm mt-3 leading-[1.7] text-[var(--ink-muted)]">
        نُعِدّ الآن ما يلزم لإرسال روابط الدخول إلى بريدك. إلى أن يكتمل ذلك، يمكنك تصفّح المسارات
        والمهامّ ولوحة النقاط دون تسجيل.
      </p>
      <Link href="/masarat" className={buttonClass("secondary", "sm", "mt-5")}>
        تصفّح المسارات
      </Link>
    </div>
  );
}
