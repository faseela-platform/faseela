"use server";

import { revalidatePath } from "next/cache";

import {
  archiveContentItem,
  contentTrackId,
  createContentItem,
  deleteContentItem,
  publishContentItem,
  unpublishContentItem,
  updateContentItem,
  type ContentInput,
  type ContentType,
} from "@faseela/db";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { requireTrackAccess } from "@/lib/require-track-access";
import { contentMediaKey, presignPutUrl, r2IsConfigured } from "@/lib/r2";

/**
 * Authoring the content entity (§33) as Server Actions. Authority is re-checked on
 * the server (§36): track-scoped content by the Track's supervisor
 * (`requireTrackAccess`), track-less general content by an Admin only
 * (`requireAdmin`). The id of the author comes from the session, never the form.
 * Rules live in `@faseela/db`; this authenticates, scopes, translates, revalidates.
 */
export type ContentActionState = { status: "ok" | "error"; message: string; id?: string };

/** The form's fields — `eventAt` arrives as a datetime-local string, parsed here. */
export type ContentFormInput = {
  type: ContentType;
  title: string;
  body: string;
  trackId?: string | null;
  source?: string | null;
  bodyId?: string | null;
  classification?: string | null;
  linkUrl?: string | null;
  eventAt?: string | null;
  eventPlace?: string | null;
  mediaKey?: string | null;
};

const clean = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};

function toContentInput(f: ContentFormInput): ContentInput {
  return {
    type: f.type,
    title: f.title,
    body: f.body,
    trackId: clean(f.trackId),
    source: clean(f.source),
    bodyId: f.bodyId ?? null,
    classification: clean(f.classification),
    linkUrl: clean(f.linkUrl),
    eventPlace: clean(f.eventPlace),
    eventAt: f.eventAt ? new Date(f.eventAt) : null,
    mediaKey: clean(f.mediaKey),
  };
}

/**
 * A *partial* patch: only fields actually present in the form are mapped, so a
 * targeted update (e.g. attaching an image with `{ mediaKey }`) leaves every other
 * column untouched. `toContentInput` above cannot do this — it flattens a missing
 * field to `null`, which for an update would *clear* the column, not skip it.
 */
function toContentPatch(f: Partial<ContentFormInput>): Partial<ContentInput> {
  const patch: Partial<ContentInput> = {};
  if (f.type !== undefined) patch.type = f.type;
  if (f.title !== undefined) patch.title = f.title;
  if (f.body !== undefined) patch.body = f.body;
  if (f.trackId !== undefined) patch.trackId = clean(f.trackId);
  if (f.source !== undefined) patch.source = clean(f.source);
  if (f.bodyId !== undefined) patch.bodyId = f.bodyId;
  if (f.classification !== undefined) patch.classification = clean(f.classification);
  if (f.linkUrl !== undefined) patch.linkUrl = clean(f.linkUrl);
  if (f.eventPlace !== undefined) patch.eventPlace = clean(f.eventPlace);
  if (f.eventAt !== undefined) patch.eventAt = f.eventAt ? new Date(f.eventAt) : null;
  if (f.mediaKey !== undefined) patch.mediaKey = clean(f.mediaKey);
  return patch;
}

function revalidate(id?: string) {
  revalidatePath("/idara/muhtawa");
  if (id) revalidatePath(`/idara/muhtawa/${id}`);
  /** Published content lands on the home Feed. */
  revalidatePath("/mustajaddat");
}

/**
 * Resolve a content piece's scope and gate on it, or refuse. Track-scoped content
 * needs access to its Track; track-less content is admin-only. Returns an error
 * state only when the content is missing — an out-of-scope caller is thrown a 404
 * by the gate, exactly as the Task actions behave.
 */
async function gateContent(contentId: string): Promise<ContentActionState | null> {
  const loc = await contentTrackId(db, contentId);
  if (!loc) return { status: "error", message: "المحتوى غير موجود." };
  if (loc.trackId) await requireTrackAccess(loc.trackId);
  else await requireAdmin();
  return null;
}

export async function createContentAction(f: ContentFormInput): Promise<ContentActionState> {
  /** Track-less content is admin-only; content for a Track needs that Track's scope. */
  const staff = f.trackId ? await requireTrackAccess(f.trackId) : await requireAdmin();

  const r = await createContentItem(db, { ...toContentInput(f), createdBy: staff.id });
  switch (r.status) {
    case "created":
      revalidate(r.id);
      return { status: "ok", message: "أُنشئ المحتوى كمسودة.", id: r.id };
    case "invalid":
      return { status: "error", message: "العنوان والنص مطلوبان." };
    case "track-not-found":
      return { status: "error", message: "المسار غير موجود." };
    case "task-not-found":
      return { status: "error", message: "المهمة غير موجودة." };
  }
}

export async function updateContentAction(
  id: string,
  f: Partial<ContentFormInput>,
): Promise<ContentActionState> {
  /** Gate on where the content *is* (its current scope). */
  const gate = await gateContent(id);
  if (gate) return gate;

  const patch = toContentPatch(f);

  /**
   * Re-gate on where the content is being *moved* (§36). Resolving only the current
   * scope would let a supervisor reassign their own piece to another Track — or to
   * track-less general content, which is admin-only — by posting a `trackId` the
   * hidden form field never offers. Track-less requires admin; a Track requires that
   * Track's access. The gate throws a 404 for anyone out of scope.
   */
  if (patch.trackId !== undefined) {
    if (patch.trackId === null) await requireAdmin();
    else await requireTrackAccess(patch.trackId);
  }

  const r = await updateContentItem(db, id, patch);
  switch (r.status) {
    case "updated":
      revalidate(id);
      return { status: "ok", message: "حُفظ المحتوى." };
    case "invalid":
      return { status: "error", message: "العنوان والنص مطلوبان." };
    case "track-not-found":
      return { status: "error", message: "المسار غير موجود." };
    case "task-not-found":
      return { status: "error", message: "المهمة غير موجودة." };
    case "not-found":
      return { status: "error", message: "المحتوى غير موجود." };
  }
}

export async function publishContentAction(id: string): Promise<ContentActionState> {
  const gate = await gateContent(id);
  if (gate) return gate;
  await publishContentItem(db, id);
  revalidate(id);
  return { status: "ok", message: "نُشر المحتوى." };
}

export async function unpublishContentAction(id: string): Promise<ContentActionState> {
  const gate = await gateContent(id);
  if (gate) return gate;
  await unpublishContentItem(db, id);
  revalidate(id);
  return { status: "ok", message: "أُعيد المحتوى إلى مسودة." };
}

export async function archiveContentAction(id: string): Promise<ContentActionState> {
  const gate = await gateContent(id);
  if (gate) return gate;
  await archiveContentItem(db, id);
  revalidate(id);
  return { status: "ok", message: "أُرشف المحتوى." };
}

export async function deleteContentAction(id: string): Promise<ContentActionState> {
  const gate = await gateContent(id);
  if (gate) return gate;
  await deleteContentItem(db, id);
  revalidate();
  return { status: "ok", message: "حُذف المحتوى." };
}

export type ContentUploadTicket =
  { ok: true; url: string; key: string } | { ok: false; message: string };

/**
 * Mint a presigned PUT URL so the browser uploads a content image straight to R2.
 * Gated to the staff who manage this content; the object key is namespaced by the
 * content id. The editor form holds the returned key and saves it as `mediaKey`.
 */
export async function requestContentUpload(
  contentId: string,
  filename: string,
): Promise<ContentUploadTicket> {
  /** The gate already required a live session and the right scope for this content. */
  const gate = await gateContent(contentId);
  if (gate) return { ok: false, message: gate.message };
  if (!r2IsConfigured) return { ok: false, message: "رفع الصور غير متاح حالياً." };

  const key = contentMediaKey(contentId, filename);
  const url = await presignPutUrl(key);
  return { ok: true, url, key };
}
