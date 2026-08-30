import type { Metadata } from "next";
import Link from "next/link";

import { unreadNotificationCount } from "@faseela/db";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/require-track-access";
import { Nav } from "../components/nav";
import { PageHeader } from "../components/ui";

/**
 * The dashboard home (spec §34/§35). Staff-gated; a member gets a 404. An admin
 * sees every section, a supervisor only what their scope allows (Tracks). Not
 * linked from the public nav — staff reach it by URL, and the gate hides it.
 */
export const metadata: Metadata = {
  title: "لوحة التحكم — مبادرة فسيلة",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function IdaraHome() {
  const staff = await requireStaff();
  const unreadCount = await unreadNotificationCount(db, staff.id);
  const isAdmin = staff.role === "admin";

  const sections = [
    {
      href: "/idara/masarat",
      label: "المسارات والمهام",
      desc: "أنشئ المسارات والمهام وانشرها.",
      show: true,
    },
    {
      href: "/idara/muhtawa",
      label: "المحتوى",
      desc: "الأخبار والفعاليات والإنتاجات والإعلانات للصفحة الرئيسة.",
      show: true,
    },
    {
      href: "/muraja3a",
      label: "قائمة المراجعة",
      desc: "الأعمال المُرسَلة بانتظار قرارك.",
      show: true,
    },
    {
      href: "/idara/ishaarat",
      label: "الإشعارات",
      desc: "أرسِل إعلاناً أو تحديثاً إلى الأعضاء.",
      show: isAdmin,
    },
    {
      href: "/idara/tawasol",
      label: "رسائل التواصل",
      desc: "الاقتراحات والاستفسارات والملاحظات الواردة.",
      show: isAdmin,
    },
    {
      href: "/idara/aada",
      label: "الأعضاء والصلاحيات",
      desc: "الأدوار وتعيين مشرفي المسارات.",
      show: isAdmin,
    },
    { href: "/idara/rutab", label: "الرتب", desc: "حدود نقاط الرتب.", show: isAdmin },
  ].filter((s) => s.show);

  return (
    <>
      <Nav current="/idara" signedIn memberName={staff.name} unreadCount={unreadCount} />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-12 pb-16 md:pt-16 md:pb-24">
          <PageHeader
            eyebrow="لوحة التحكم"
            title={isAdmin ? "الإدارة المركزية" : "إدارة مساراتك"}
            lede={
              isAdmin
                ? "أنشئ المحتوى وأدره، عيّن المشرفين، وضبط الرتب."
                : "أدر المسارات المُسندة إليك: مهامها ومحتواها ومراجعة تسليماتها."
            }
          />

          {/* The sections as a card grid — each a whole-card link, because the card's
              only text IS its label and description. */}
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((s, i) => (
              <li key={s.href} data-reveal={String((i % 3) * 80)}>
                <Link
                  href={s.href}
                  className="group flex h-full min-h-[9rem] flex-col justify-between rounded-[var(--radius-card)] bg-[var(--surface-raised)] p-6 transition-[transform,box-shadow] duration-[150ms] ease-[var(--ease-out-expo)] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none"
                  style={{ boxShadow: "var(--card-shadow)" }}
                >
                  <div>
                    <p className="font-display text-card-title font-bold text-[var(--ink)] group-hover:text-[var(--brand)]">
                      {s.label}
                    </p>
                    <p className="text-body-sm mt-2 text-[var(--ink-muted)]">{s.desc}</p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="mt-4 inline-block self-end text-[var(--ink-muted)] transition-colors group-hover:text-[var(--brand)] ltr:rotate-180"
                  >
                    ←
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
