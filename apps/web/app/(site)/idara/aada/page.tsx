import type { Metadata } from "next";
import Link from "next/link";

import { adminMemberList } from "@faseela/db";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { Nav } from "../../components/nav";
import { MemberRow } from "./member-row";

/**
 * Members and their roles (§34, admin-only). Roles are set here; assigning a
 * supervisor to a Track is done from that Track's own page.
 */
export const metadata: Metadata = {
  title: "الأعضاء — لوحة التحكم",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function IdaraAada() {
  const admin = await requireAdmin();
  const members = await adminMemberList(db);

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
            الأعضاء والصلاحيات
          </h1>
          <p className="text-body-sm mt-4 max-w-xl text-[var(--ink-muted)]">
            غيّر أدوار الأعضاء. تعيين مشرفي المسارات يتم من صفحة كل مسار.
          </p>

          <div className="hairline rule-draw mt-10" />
          <ul className="mt-4 max-w-3xl">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
