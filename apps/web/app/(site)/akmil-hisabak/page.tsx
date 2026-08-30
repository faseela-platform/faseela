import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isProfileComplete, memberProfile } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeInternalPath } from "@/lib/safe-path";
import { Mark } from "../components/mark";
import { Nav } from "../components/nav";
import { Card } from "../components/ui";
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
        <section className="gutter mx-auto flex min-h-[70vh] max-w-[1440px] items-center py-16">
          <Card reveal={0} className="w-full max-w-md p-8">
            <Mark size={56} idPrefix="complete-mark" />
            <h1 className="font-display mt-5 text-[clamp(1.75rem,3.6vw,2.441rem)] leading-[1.42] font-extrabold text-[var(--ink)]">
              أكمل حسابك
            </h1>
            <p className="lede text-body mt-3 text-[var(--ink-muted)]">
              خطوة أخيرة قبل أن تبدأ: أخبرنا باسمك ورقم هاتفك. نستخدمهما للتواصل معك وعرض اسمك على
              اللوحة.
            </p>

            <div className="mt-8">
              <CompleteAccountForm next={safeInternalPath(next)} />
            </div>
          </Card>
        </section>
      </main>
    </>
  );
}
