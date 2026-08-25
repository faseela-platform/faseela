import type { Metadata } from "next";
import Link from "next/link";

import { adminContentItems, adminTracks } from "@faseela/db";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/require-track-access";
import { Nav } from "../../components/nav";
import { STATE_LABEL } from "../masarat/state-label";
import { CreateContentForm } from "./create-content-form";
import { CONTENT_TYPE_LABEL } from "./content-types";

/**
 * The content authoring list (§33/§34/§35). An admin sees and creates all content,
 * including track-less general content; an editor sees and creates only their
 * Tracks' content. Each row leads to that piece's editor.
 */
export const metadata: Metadata = {
  title: "المحتوى — لوحة التحكم",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function IdaraMuhtawa() {
  const staff = await requireStaff();
  const isAdmin = staff.role === "admin";
  const scope = isAdmin ? undefined : { supervisorId: staff.id };

  const [items, tracks] = await Promise.all([
    adminContentItems(db, scope),
    adminTracks(db, scope),
  ]);

  return (
    <>
      <Nav current="/idara" signedIn memberName={staff.name} />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <Link
            href="/idara"
            className="text-body-sm mb-10 inline-block font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
          >
            <span aria-hidden="true">→</span> لوحة التحكم
          </Link>

          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-medium text-[var(--ink)]">
            المحتوى
          </h1>
          <p className="text-body-sm mt-4 max-w-xl text-[var(--ink-muted)]">
            الأخبار والفعاليات والإنتاجات والإعلانات التي تظهر في الصفحة الرئيسة.
          </p>

          <div className="mt-8">
            <CreateContentForm
              tracks={tracks.map((t) => ({ id: t.id, title: t.title }))}
              canCreateTrackless={isAdmin}
            />
          </div>

          <div className="hairline rule-draw mt-12" />
          {items.length === 0 ? (
            <p className="text-body-sm mt-8 text-[var(--ink-muted)]">لا محتوى بعد.</p>
          ) : (
            <ul className="mt-4 max-w-3xl">
              {items.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/idara/muhtawa/${c.id}`}
                    className="group flex items-baseline justify-between gap-4 border-b border-[var(--hairline)] py-4 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[color-mix(in_oklch,var(--brand)_5%,transparent)]"
                  >
                    <div>
                      <p className="text-body-sm font-medium text-[var(--ink)] group-hover:text-[var(--brand)]">
                        {c.title}
                      </p>
                      <p className="text-caption mt-1 text-[var(--ink-faint)]">
                        {CONTENT_TYPE_LABEL[c.type]} · {STATE_LABEL[c.state]}
                        {c.trackTitle ? ` · ${c.trackTitle}` : " · عام"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
