import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { adminContentItem, adminTracks, canManageTrackScope } from "@faseela/db";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/require-track-access";
import { presignGetUrl, r2IsConfigured } from "@/lib/r2";
import { Nav } from "../../../components/nav";
import { ContentEditor } from "./content-editor";

/**
 * Edit one content piece (§33). Gated on the piece's scope (§36): a supervisor may
 * open only their Tracks' content, and track-less general content is admin-only — a
 * 404 for anyone else, enforced here on the server, not by hiding the link.
 */
export const metadata: Metadata = {
  title: "تحرير محتوى — لوحة التحكم",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function IdaraContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff();

  const item = await adminContentItem(db, id);
  if (!item) notFound();

  const allowed = item.trackId
    ? canManageTrackScope(staff.role, staff.supervisedTrackIds, item.trackId)
    : staff.role === "admin";
  if (!allowed) notFound();

  const isAdmin = staff.role === "admin";
  const tracks = await adminTracks(db, isAdmin ? undefined : { supervisorId: staff.id });

  /** A short-lived read URL to preview the current image; the page is force-dynamic
   * so a fresh presigned URL each render is fine. */
  const mediaUrl = item.mediaKey && r2IsConfigured ? await presignGetUrl(item.mediaKey) : null;

  return (
    <>
      <Nav current="/idara" signedIn memberName={staff.name} />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <Link
            href="/idara/muhtawa"
            className="text-body-sm mb-10 inline-block font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
          >
            <span aria-hidden="true">→</span> كل المحتوى
          </Link>

          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-medium text-[var(--ink)]">
            {item.title}
          </h1>

          <div className="mt-8">
            <ContentEditor
              contentId={id}
              canTrackless={isAdmin}
              tracks={tracks.map((t) => ({ id: t.id, title: t.title }))}
              mediaUrl={mediaUrl}
              uploadAvailable={r2IsConfigured}
              initial={{
                type: item.type,
                title: item.title,
                body: item.body,
                trackId: item.trackId,
                source: item.source,
                classification: item.classification,
                linkUrl: item.linkUrl,
                eventAt: item.eventAt ? item.eventAt.toISOString().slice(0, 16) : "",
                eventPlace: item.eventPlace,
                mediaKey: item.mediaKey,
                state: item.state,
              }}
            />
          </div>
        </section>
      </main>
    </>
  );
}
