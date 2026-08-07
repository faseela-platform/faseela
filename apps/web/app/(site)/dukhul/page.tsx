import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
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

            <SignInForm callbackURL={safeCallback(callbackURL)} />
          </div>
        </section>
      </main>
    </>
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
