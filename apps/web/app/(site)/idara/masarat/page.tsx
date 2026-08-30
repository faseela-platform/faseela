import type { Metadata } from "next";
import Link from "next/link";

import { adminTracks, unreadNotificationCount } from "@faseela/db";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/require-track-access";
import { Nav } from "../../components/nav";
import { BackLink } from "../../components/ui";
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
  const unreadCount = await unreadNotificationCount(db, staff.id);
  const tracks = await adminTracks(
    db,
    staff.role === "admin" ? undefined : { supervisorId: staff.id },
  );

  return (
    <>
      <Nav current="/idara" signedIn memberName={staff.name} unreadCount={unreadCount} />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-10 pb-16 md:pb-24">
          <BackLink href="/idara">لوحة التحكم</BackLink>

          <h1
            data-reveal="0"
            className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-extrabold text-[var(--ink)]"
          >
            المسارات
          </h1>

          {staff.role === "admin" ? (
            <div className="mt-8">
              <CreateTrackForm />
            </div>
          ) : null}

          <div className="hairline mt-12" />

          {tracks.length === 0 ? (
            <p className="text-body-lg mt-10 max-w-lg text-[var(--ink-muted)]">
              {staff.role === "admin"
                ? "لا مسارات بعد. أنشئ أول مسار أعلاه."
                : "لا مسارات مُسندة إليك."}
            </p>
          ) : (
            <ol className="mt-8 max-w-3xl">
              {tracks.map((t, i) => (
                <li key={t.id} data-reveal={String(Math.min(i, 4) * 60)}>
                  <Link
                    href={`/idara/masarat/${t.id}`}
                    className="group flex min-h-14 items-center justify-between gap-4 border-b border-[var(--hairline)] px-3 py-5 transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:bg-[color-mix(in_oklch,var(--brand)_5%,transparent)]"
                  >
                    <div>
                      <p className="text-body-lg font-medium text-[var(--ink)] group-hover:text-[var(--brand)]">
                        {t.title}
                      </p>
                      <p className="text-caption mt-1 text-[var(--ink-muted)]">
                        {STATE_LABEL[t.state]} · <Num value={t.taskCount} /> مهمة
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="inline-block text-[var(--ink-muted)] group-hover:text-[var(--brand)] ltr:rotate-180"
                    >
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
