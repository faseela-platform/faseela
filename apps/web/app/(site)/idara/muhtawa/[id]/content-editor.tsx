"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  archiveContentAction,
  deleteContentAction,
  publishContentAction,
  requestContentUpload,
  unpublishContentAction,
  updateContentAction,
  type ContentActionState,
} from "../content-actions";
import { CONTENT_TYPES, CONTENT_TYPE_LABEL, type ContentType } from "../content-types";
import { STATE_LABEL, type PublishState } from "../../masarat/state-label";
import { buttonClass } from "../../../components/ui";

type Initial = {
  type: ContentType;
  title: string;
  body: string;
  trackId: string | null;
  source: string | null;
  bodyId: string | null;
  classification: string | null;
  linkUrl: string | null;
  eventAt: string;
  eventPlace: string | null;
  mediaKey: string | null;
  state: PublishState;
};

/**
 * Edit a content piece's fields, move it between states, attach an image, or delete
 * it. Publishing is what puts it on the home Feed; the state comes from the server
 * and is tracked here so the controls stay honest after each action.
 */
export function ContentEditor({
  contentId,
  canTrackless,
  tracks,
  bodies,
  mediaUrl,
  uploadAvailable,
  initial,
}: {
  contentId: string;
  canTrackless: boolean;
  tracks: { id: string; title: string }[];
  /** §32 — the برامج/هيئات a general piece can speak for. */
  bodies: { id: string; name: string }[];
  mediaUrl: string | null;
  uploadAvailable: boolean;
  initial: Initial;
}) {
  const router = useRouter();
  const [type, setType] = useState<ContentType>(initial.type);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [trackId, setTrackId] = useState(initial.trackId ?? "");
  const [source, setSource] = useState(initial.source ?? "");
  const [classification, setClassification] = useState(initial.classification ?? "");
  const [bodyId, setBodyId] = useState<string>(initial.bodyId ?? "");
  const [linkUrl, setLinkUrl] = useState(initial.linkUrl ?? "");
  const [eventAt, setEventAt] = useState(initial.eventAt);
  const [eventPlace, setEventPlace] = useState(initial.eventPlace ?? "");
  const [state, setState] = useState<PublishState>(initial.state);
  const [hasImage, setHasImage] = useState(Boolean(initial.mediaKey));
  const fileRef = useRef<HTMLInputElement>(null);

  const [pending, start] = useTransition();
  const [result, setResult] = useState<ContentActionState | null>(null);

  function save() {
    start(async () => {
      setResult(
        await updateContentAction(contentId, {
          type,
          title,
          body,
          trackId: trackId || null,
          source,
          bodyId: bodyId || null,
          classification,
          linkUrl,
          eventAt: eventAt || null,
          eventPlace,
        }),
      );
    });
  }

  function move(action: () => Promise<ContentActionState>, next: PublishState) {
    start(async () => {
      const r = await action();
      setResult(r);
      if (r.status === "ok") setState(next);
    });
  }

  function remove() {
    start(async () => {
      const r = await deleteContentAction(contentId);
      if (r.status === "ok") router.push("/idara/muhtawa");
      else setResult(r);
    });
  }

  function upload(file: File) {
    start(async () => {
      const ticket = await requestContentUpload(contentId, file.name);
      if (!ticket.ok) {
        setResult({ status: "error", message: ticket.message });
        return;
      }
      const put = await fetch(ticket.url, { method: "PUT", body: file });
      if (!put.ok) {
        setResult({ status: "error", message: "تعذّر رفع الصورة." });
        return;
      }
      const r = await updateContentAction(contentId, { mediaKey: ticket.key });
      setResult(r.status === "ok" ? { status: "ok", message: "رُفعت الصورة." } : r);
      if (r.status === "ok") setHasImage(true);
    });
  }

  const input =
    "min-h-11 text-body-sm w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50";
  const label = "text-caption mb-1 block text-[var(--ink-muted)]";
  const stateBtn = buttonClass("ghost", "sm");

  return (
    <div className="max-w-xl">
      <p className="text-caption mb-6 text-[var(--ink-muted)]">
        الحالة: <span className="font-semibold text-[var(--ink)]">{STATE_LABEL[state]}</span>
      </p>

      <div className="grid gap-4">
        <div>
          <label className={label} htmlFor="e-type">
            النوع
          </label>
          <select
            id="e-type"
            dir="rtl"
            value={type}
            disabled={pending}
            onChange={(e) => setType(e.target.value as ContentType)}
            className={input}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="e-title">
            العنوان
          </label>
          <input
            id="e-title"
            dir="rtl"
            value={title}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
            className={input}
          />
        </div>

        <div>
          <label className={label} htmlFor="e-body">
            النص
          </label>
          <textarea
            id="e-body"
            dir="rtl"
            rows={5}
            value={body}
            disabled={pending}
            onChange={(e) => setBody(e.target.value)}
            className={input}
          />
        </div>

        <div>
          <label className={label} htmlFor="e-track">
            المسار
          </label>
          <select
            id="e-track"
            dir="rtl"
            value={trackId}
            disabled={pending}
            onChange={(e) => setTrackId(e.target.value)}
            className={input}
          >
            {canTrackless ? <option value="">عام (بلا مسار)</option> : null}
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="e-source">
              المصدر
            </label>
            <input
              id="e-source"
              dir="rtl"
              value={source}
              disabled={pending}
              onChange={(e) => setSource(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label} htmlFor="e-class">
              التصنيف
            </label>
            <input
              id="e-class"
              dir="rtl"
              value={classification}
              disabled={pending}
              onChange={(e) => setClassification(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label} htmlFor="e-body-id">
              الجهة (برنامج/هيئة §32)
            </label>
            <select
              id="e-body-id"
              value={bodyId}
              disabled={pending}
              onChange={(e) => setBodyId(e.target.value)}
              className={input}
            >
              <option value="">— بلا جهة —</option>
              {bodies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="e-link">
            رابط خارجي (اختياري)
          </label>
          <input
            id="e-link"
            dir="ltr"
            value={linkUrl}
            disabled={pending}
            onChange={(e) => setLinkUrl(e.target.value)}
            className={`${input} text-left`}
            placeholder="https://"
          />
        </div>

        {type === "event" ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="e-when">
                موعد الفعالية
              </label>
              <input
                id="e-when"
                type="datetime-local"
                dir="ltr"
                value={eventAt}
                disabled={pending}
                onChange={(e) => setEventAt(e.target.value)}
                className={`${input} text-left`}
              />
            </div>
            <div>
              <label className={label} htmlFor="e-where">
                المكان
              </label>
              <input
                id="e-where"
                dir="rtl"
                value={eventPlace}
                disabled={pending}
                onChange={(e) => setEventPlace(e.target.value)}
                className={input}
              />
            </div>
          </div>
        ) : null}

        <div>
          <span className={label}>الصورة</span>
          {mediaUrl ? (
            <Image
              src={mediaUrl}
              alt=""
              width={320}
              height={180}
              unoptimized
              className="mb-2 max-h-40 w-auto rounded-[var(--radius-btn)] border border-[var(--hairline)] object-contain"
            />
          ) : null}
          {uploadAvailable ? (
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              disabled={pending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
              className="text-caption block min-h-11 w-full text-[var(--ink-muted)] file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-[var(--ink)]"
            />
          ) : (
            <p className="text-caption text-[var(--ink-muted)]">رفع الصور غير مُفعّل بعد.</p>
          )}
          {hasImage && !mediaUrl ? (
            <p className="text-caption mt-1 text-[var(--ink-muted)]">
              صورة مرفقة — ستظهر بعد الحفظ.
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className={buttonClass("primary", "sm")}
          >
            {pending ? "…" : "احفظ"}
          </button>
          <span
            aria-live="polite"
            role={result?.status === "error" ? "alert" : undefined}
            className="text-caption text-[var(--ink-muted)]"
          >
            {result?.message ?? ""}
          </span>
        </div>

        <div className="hairline mt-4" />
        <div className="flex flex-wrap items-center gap-3">
          {state !== "published" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => move(() => publishContentAction(contentId), "published")}
              className={stateBtn}
            >
              انشر
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => move(() => unpublishContentAction(contentId), "draft")}
              className={stateBtn}
            >
              أعِد إلى مسودة
            </button>
          )}
          {state !== "archived" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => move(() => archiveContentAction(contentId), "archived")}
              className={stateBtn}
            >
              أرشِف
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className={buttonClass("danger", "sm")}
          >
            احذف
          </button>
        </div>
      </div>
    </div>
  );
}
