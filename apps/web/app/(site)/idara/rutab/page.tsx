import type { Metadata } from "next";
import Link from "next/link";

import { tierThresholds } from "@faseela/db";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { Nav } from "../../components/nav";
import { TierRow } from "./tier-row";

/**
 * The tier ladder editor (§46, admin-only). Thresholds are data, not code — editing
 * one re-tiers every Member on their next read (ADR 0024), so this is where the
 * exact §45–47 values land whenever they are confirmed.
 */
export const metadata: Metadata = {
  title: "الرتب — لوحة التحكم",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function IdaraRutab() {
  const admin = await requireAdmin();
  const tiers = await tierThresholds(db);

  return (
    <>
      <Nav current="/idara" signedIn memberName={admin.name} />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <Link
            href="/idara"
            className="text-body-sm mb-10 inline-block font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
          >
            <span aria-hidden="true">→</span> لوحة التحكم
          </Link>

          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-medium text-[var(--ink)]">
            الرتب
          </h1>
          <p className="text-body-sm mt-4 max-w-xl text-[var(--ink-muted)]">
            حدود النقاط لكل رتبة. تعديل الحد يُعيد ترتيب الأعضاء فوراً دون ترحيل.
          </p>

          <div className="hairline rule-draw mt-10" />
          <ul className="mt-4 max-w-2xl">
            {tiers.map((t) => (
              <TierRow key={t.key} tier={{ key: t.key, name: t.name, minPoints: t.minPoints }} />
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
