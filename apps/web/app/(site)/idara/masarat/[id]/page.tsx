import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { adminMemberList, adminTrack, supervisorsOfTrack } from "@faseela/db";

import { db } from "@/lib/db";
import { requireTrackAccess } from "@/lib/require-track-access";
import { Nav } from "../../../components/nav";
import { SupervisorPanel } from "./supervisor-panel";
import { TaskManager } from "./task-manager";
import { TrackEditor } from "./track-editor";

/**
 * Edit one Track (§34/§35): its fields and state, its Tasks, and — for an admin —
 * its supervisors. Gated by `requireTrackAccess`, so a supervisor cannot open a
 * Track they do not run by editing the URL (§36).
 */
export const metadata: Metadata = {
  title: "تحرير مسار — لوحة التحكم",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function IdaraTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireTrackAccess(id);

  const track = await adminTrack(db, id);
  if (!track) notFound();

  const isAdmin = staff.role === "admin";
  const supervisors = isAdmin ? await supervisorsOfTrack(db, id) : [];
  const assignable = isAdmin
    ? (await adminMemberList(db))
        .filter((m) => (m.role === "editor" || m.role === "admin") && !supervisors.some((s) => s.userId === m.id))
        .map((m) => ({ id: m.id, name: m.name }))
    : [];

  return (
    <>
      <Nav current="/idara" signedIn memberName={staff.name} />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <Link
            href="/idara/masarat"
            className="text-body-sm mb-10 inline-block font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
          >
            <span aria-hidden="true">→</span> كل المسارات
          </Link>

          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-medium text-[var(--ink)]">
            {track.title}
          </h1>

          <div className="mt-8">
            <TrackEditor
              trackId={id}
              initial={{ title: track.title, summary: track.summary, slug: track.slug, state: track.state }}
            />
          </div>

          <div className="hairline rule-draw mt-12" />
          <h2 className="text-caption mt-10 mb-6 font-semibold text-[var(--ink-muted)]">المهام</h2>
          <TaskManager
            trackId={id}
            tasks={track.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              instructions: t.instructions,
              mode: t.mode,
              points: t.points,
              state: t.state,
            }))}
          />

          {isAdmin ? (
            <>
              <div className="hairline rule-draw mt-12" />
              <h2 className="text-caption mt-10 mb-6 font-semibold text-[var(--ink-muted)]">المشرفون</h2>
              <SupervisorPanel
                trackId={id}
                supervisors={supervisors.map((s) => ({ id: s.userId, name: s.name }))}
                assignable={assignable}
              />
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}
