import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isProfileComplete, memberProfile } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeInternalPath } from "@/lib/safe-path";
import { Nav } from "../components/nav";
import { CompleteAccountForm } from "./complete-account-form";

/**
 * "Complete your account" — the §5 step that collects the name and phone a
 * magic-link sign-in never asked for. Reached the first time a signed-in Member
 * tries to do something that earns Points; skippable only by supplying the data.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "أكمل حسابك — مبادرة فسيلة",
  description: "أضف اسمك ورقم هاتفك لإكمال حسابك في فسيلة.",
  robots: { index: false, follow: true },
};

export default async function CompleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  const session = await auth.api.getSession({ headers: await headers() });
  // Not signed in: there is no account to complete. Send them to sign in first.
  if (!session?.user) redirect("/dukhul");

  // Already complete: nothing to do here, so forward to the destination.
  const profile = await memberProfile(db, session.user.id);
  if (isProfileComplete(profile)) redirect(safeInternalPath(next));

  return (
    <>
      <Nav signedIn memberName={session.user.name} />
      <main>
        <section className="gutter flex min-h-[70vh] items-center py-16">
          <div className="reveal w-full max-w-md">
            <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
              أكمل حسابك
            </h1>
            <p className="text-lede mt-5 text-[var(--ink-muted)]">
              خطوة أخيرة قبل أن تبدأ: أخبرنا باسمك ورقم هاتفك. نستخدمهما للتواصل معك وعرض اسمك على
              اللوحة.
            </p>

            <div className="hairline rule-draw mt-10 mb-10" />

            <CompleteAccountForm next={safeInternalPath(next)} />
          </div>
        </section>
      </main>
    </>
  );
}
