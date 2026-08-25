import type { Metadata } from "next";
import Link from "next/link";

import { adminTracks } from "@faseela/db";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/require-track-access";
import { Nav } from "../../components/nav";
import { Num } from "../../components/num";
import { CreateTrackForm } from "../create-track-form";
import { STATE_LABEL } from "./state-label";

/**
 * The Track list (§34/§35). An admin sees every Track (any state); a supervisor
 * sees only the Tracks they are assigned. Creating is admin-only. Each row leads to
 * the Track's editor.
 */
export const metadata: Metadata = {
  title: "المسارات — لوحة التحكم",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function IdaraMasarat() {
  const staff = await requireStaff();
  const tracks = await adminTracks(db, staff.role === "admin" ? undefined : { supervisorId: staff.id });

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
            المسارات
          </h1>

          {staff.role === "admin" ? (
            <div className="mt-8">
              <CreateTrackForm />
            </div>
          ) : null}

          <div className="hairline rule-draw mt-12" />

          {tracks.length === 0 ? (
            <p className="text-body-lg mt-10 max-w-lg text-[var(--ink-muted)]">
              {staff.role === "admin" ? "لا مسارات بعد. أنشئ أول مسار أعلاه." : "لا مسارات مُسندة إليك."}
            </p>
          ) : (
            <ol className="reveal-stagger mt-8 max-w-3xl">
              {tracks.map((t, i) => (
                <li key={t.id} style={{ ["--i" as string]: i }}>
                  <Link
                    href={`/idara/masarat/${t.id}`}
                    className="group flex items-baseline justify-between gap-4 border-b border-[var(--hairline)] py-5 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[color-mix(in_oklch,var(--brand)_5%,transparent)]"
                  >
                    <div>
                      <p className="text-body-lg font-medium text-[var(--ink)] group-hover:text-[var(--brand)]">
                        {t.title}
                      </p>
                      <p className="text-caption mt-1 text-[var(--ink-muted)]">
                        {STATE_LABEL[t.state]} · <Num value={t.taskCount} /> مهمة
                      </p>
                    </div>
                    <span aria-hidden="true" className="text-[var(--ink-faint)] group-hover:text-[var(--brand)]">
                      ←
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
