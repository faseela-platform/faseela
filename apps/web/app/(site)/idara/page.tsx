import type { Metadata } from "next";
import Link from "next/link";

import { requireStaff } from "@/lib/require-track-access";
import { Nav } from "../components/nav";

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
  const isAdmin = staff.role === "admin";

  const sections = [
    { href: "/idara/masarat", label: "المسارات والمهام", desc: "أنشئ المسارات والمهام وانشرها.", show: true },
    { href: "/idara/muhtawa", label: "المحتوى", desc: "الأخبار والفعاليات والإنتاجات والإعلانات للصفحة الرئيسة.", show: true },
    { href: "/idara/tawasol", label: "رسائل التواصل", desc: "الاقتراحات والاستفسارات والملاحظات الواردة.", show: isAdmin },
    { href: "/idara/aada", label: "الأعضاء والصلاحيات", desc: "الأدوار وتعيين مشرفي المسارات.", show: isAdmin },
    { href: "/idara/rutab", label: "الرتب", desc: "حدود نقاط الرتب.", show: isAdmin },
  ].filter((s) => s.show);

  return (
    <>
      <Nav current="/idara" signedIn memberName={staff.name} />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <div className="reveal max-w-3xl">
            <p className="text-caption mb-4 font-semibold text-[var(--ink-muted)]">لوحة التحكم</p>
            <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
              {isAdmin ? "الإدارة المركزية" : "إدارة مساراتك"}
            </h1>
            <p className="text-lede mt-6 max-w-xl text-[var(--ink-muted)]">
              {isAdmin
                ? "أنشئ المحتوى وأدره، عيّن المشرفين، وضبط الرتب."
                : "أدر المسارات المُسندة إليك: مهامها ومحتواها ومراجعة تسليماتها."}
            </p>
          </div>

          <div className="hairline rule-draw mt-12" />

          <ol className="reveal-stagger mt-8 max-w-3xl">
            {sections.map((s, i) => (
              <li key={s.href} style={{ ["--i" as string]: i }}>
                <Link
                  href={s.href}
                  className="group flex items-baseline justify-between gap-4 border-b border-[var(--hairline)] py-6 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[color-mix(in_oklch,var(--brand)_5%,transparent)]"
                >
                  <div>
                    <p className="text-body-lg font-medium text-[var(--ink)] group-hover:text-[var(--brand)]">
                      {s.label}
                    </p>
                    <p className="text-body-sm mt-1 text-[var(--ink-muted)]">{s.desc}</p>
                  </div>
                  <span aria-hidden="true" className="text-[var(--ink-faint)] group-hover:text-[var(--brand)]">
                    ←
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
