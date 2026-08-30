import type { Metadata } from "next";

import { adminMemberList, unreadNotificationCount } from "@faseela/db";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { Nav } from "../../components/nav";
import { BackLink } from "../../components/ui";
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
  const [members, unreadCount] = await Promise.all([
    adminMemberList(db),
    unreadNotificationCount(db, admin.id),
  ]);

  return (
    <>
      <Nav current="/idara" signedIn memberName={admin.name} unreadCount={unreadCount} />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-10 pb-16 md:pb-24">
          <BackLink href="/idara">لوحة التحكم</BackLink>

          <h1
            data-reveal="0"
            className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-extrabold text-[var(--ink)]"
          >
            الأعضاء والصلاحيات
          </h1>
          <p className="lede text-body-lg mt-4 max-w-xl text-[var(--ink-muted)]">
            غيّر أدوار الأعضاء. تعيين مشرفي المسارات يتم من صفحة كل مسار.
          </p>

          <div className="hairline mt-10" />
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
