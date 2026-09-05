"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  cancelReviewDraft,
  requestUploadUrl,
  saveReviewDraft,
  submitReviewWork,
  type ReviewActionState,
} from "./review-actions";
import { buttonClass } from "../components/ui";

/**
 * The Member's side of a `review` Task (spec §16–§21).
 *
 * One panel for the whole lifecycle, because the Member returns to the same place
 * whatever state their work is in. What it shows is driven by `state` read on the
 * server, not by anything held here — so a reload, a second device, or an Editor's
 * decision between visits always renders the truth:
 *
 * - no submission / `draft` / `cancelled` → a compose form (auto-saving, §21)
 * - `returned` → the Editor's note, then the form to revise and resubmit (§24)
 * - `pending` → waiting, no form: the work is with an Editor
 * - `accepted` → done
 * - `rejected` → terminal, with the reason
 *
 * Kept to the smallest client bundle that can express a mutation with feedback,
 * the same concession ADR 0011 makes for the attest button: `useTransition`, a few
 * `useState`, and no client-side validation — the server owns every rule.
 */

type SubmissionState =
  "draft" | "pending" | "returned" | "accepted" | "rejected" | "cancelled" | null;

const AUTOSAVE_IDLE_MS = 1500;

export function ReviewPanel({
  taskId,
  trackSlug,
  state,
  initialBody,
  initialMediaKey,
  initialContentId,
  contentChoices,
  reviewNote,
  r2Enabled,
}: {
  taskId: string;
  trackSlug: string;
  state: SubmissionState;
  initialBody: string;
  initialMediaKey: string | null;
  /** §15 path 2 — the content this work is about; only for §19-scoped Tasks. */
  initialContentId: string | null;
  contentChoices: { id: string; title: string }[];
  reviewNote: string | null;
  r2Enabled: boolean;
}) {
  const composing =
    state === null || state === "draft" || state === "returned" || state === "cancelled";

  if (state === "pending") {
    return (
      <p className="text-body-sm inline-flex min-h-11 items-center font-semibold text-[var(--ink-muted)]">
        <span aria-hidden="true">⏳</span> عملك قيد المراجعة.
      </p>
    );
  }

  if (state === "accepted") {
    return (
      <p className="text-body-sm inline-flex min-h-11 items-center font-semibold text-[var(--accent)]">
        <span aria-hidden="true">✓</span> قُبل عملك، ونُقّطت المهمة.
      </p>
    );
  }

  if (state === "rejected") {
    return (
      <div>
        <p className="text-caption font-semibold text-[var(--ink-muted)]">
          <span aria-hidden="true">—</span> لم يُقبل عمل هذه المهمة.
        </p>
        {reviewNote ? (
          <p className="text-caption mt-2 max-w-sm text-[var(--ink-muted)]">
            ملاحظة المراجع: {reviewNote}
          </p>
        ) : null}
      </div>
    );
  }

  if (!composing) return null;

  return (
    <ComposeForm
      taskId={taskId}
      trackSlug={trackSlug}
      state={state}
      initialBody={initialBody}
      initialMediaKey={initialMediaKey}
      initialContentId={initialContentId}
      contentChoices={contentChoices}
      reviewNote={reviewNote}
      r2Enabled={r2Enabled}
    />
  );
}

function ComposeForm({
  taskId,
  trackSlug,
  state,
  initialBody,
  initialMediaKey,
  initialContentId,
  contentChoices,
  reviewNote,
  r2Enabled,
}: {
  taskId: string;
  trackSlug: string;
  state: SubmissionState;
  initialBody: string;
  initialMediaKey: string | null;
  initialContentId: string | null;
  contentChoices: { id: string; title: string }[];
  reviewNote: string | null;
  r2Enabled: boolean;
}) {
  const [body, setBody] = useState(initialBody);
  const [mediaKey, setMediaKey] = useState<string | null>(initialMediaKey);
  const [contentId, setContentId] = useState<string | null>(initialContentId);
  const [fileName, setFileName] = useState<string | null>(initialMediaKey ? "ملف مرفق" : null);

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReviewActionState | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /**
   * The §5 gate, when it fires from the autosave or the file picker: shown as a
   * link rather than acted on, because neither of those is a moment a Member
   * chose to leave the page (see review-actions.ts).
   */
  const [gate, setGate] = useState<{ message: string; href: string } | null>(null);

  const fieldId = `review-body-${taskId}`;
  const isRevision = state === "returned";

  /**
   * Auto-save (§21). A debounce, not a save per keystroke: the draft is written
   * once the Member pauses, so the field they are typing in is never re-rendered
   * from under them. Skipped on the very first render (nothing has changed yet).
   */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (body.trim() === "" && !mediaKey) return;
    const id = setTimeout(() => {
      void saveReviewDraft(taskId, trackSlug, { body, mediaKey, contentId }).then((r) => {
        if (r.status === "draft-saved") {
          setSavedNote(true);
          setTimeout(() => setSavedNote(false), 2000);
        } else if (r.status === "profile-incomplete" && r.href) {
          setGate({ message: r.message, href: r.href });
        }
      });
    }, AUTOSAVE_IDLE_MS);
    return () => clearTimeout(id);
  }, [body, mediaKey, contentId, taskId, trackSlug]);

  async function onFile(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const ticket = await requestUploadUrl(taskId, trackSlug, file.name);
      if (!ticket.ok) {
        if (ticket.href) setGate({ message: ticket.message, href: ticket.href });
        else setUploadError(ticket.message);
        return;
      }
      const put = await fetch(ticket.url, { method: "PUT", body: file });
      if (!put.ok) {
        setUploadError("تعذّر رفع الملف. حاول مرة أخرى.");
        return;
      }
      setMediaKey(ticket.key);
      setFileName(file.name);
    } catch {
      setUploadError("تعذّر رفع الملف. حاول مرة أخرى.");
    } finally {
      setUploading(false);
    }
  }

  function onSubmit() {
    startTransition(async () => {
      setResult(await submitReviewWork(taskId, trackSlug, { body, mediaKey, contentId }));
    });
  }

  function onCancel() {
    startTransition(async () => {
      setResult(await cancelReviewDraft(taskId, trackSlug));
    });
  }

  return (
    <div>
      {/*
       * The Editor's note on a returned Submission, shown before the form so the
       * Member reads what to change before they start changing it (§24).
       */}
      {isRevision && reviewNote ? (
        <div className="mb-4 rounded-[var(--radius-btn)] bg-[color-mix(in_oklch,var(--gold-hi)_14%,transparent)] px-4 py-3">
          <p className="text-caption font-semibold text-[var(--ink)]">أُعيد عملك للتحسين</p>
          <p className="text-body-sm mt-1 text-[var(--ink-muted)]">{reviewNote}</p>
        </div>
      ) : null}

      {gate ? (
        <p
          role="alert"
          className="text-body-sm mb-4 rounded-[var(--radius-btn)] bg-[color-mix(in_oklch,var(--gold-hi)_14%,transparent)] px-4 py-3 text-[var(--ink)]"
        >
          {gate.message}{" "}
          <a
            href={gate.href}
            className="font-semibold text-[var(--brand)] underline underline-offset-4"
          >
            أكمل حسابك
          </a>
        </p>
      ) : null}

      {/* §15 path 2: which content this work is about — a plain select, server-validated. */}
      {contentChoices.length > 0 ? (
        <div className="mb-4">
          <label
            htmlFor={`review-content-${taskId}`}
            className="text-caption mb-2 block font-semibold text-[var(--ink-muted)]"
          >
            المحتوى الذي تعمل عليه
          </label>
          <select
            id={`review-content-${taskId}`}
            value={contentId ?? ""}
            onChange={(e) => setContentId(e.target.value || null)}
            className="text-body-sm min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--hairline)] bg-[var(--surface)] px-3 text-[var(--ink)]"
          >
            <option value="">— اختر —</option>
            {contentChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <label
        htmlFor={fieldId}
        className="text-caption mb-2 block font-semibold text-[var(--ink-muted)]"
      >
        {isRevision ? "عدّل إجابتك" : "إجابتك"}
      </label>
      <textarea
        id={fieldId}
        dir="rtl"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={pending}
        placeholder="اكتب إجابتك هنا…"
        className="text-body-sm w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50"
      />

      {/*
       * File upload, only when R2 is configured (see lib/r2.ts). When it is not,
       * the field is simply absent — a Member can always submit text — rather than
       * shown broken.
       */}
      {r2Enabled ? (
        <div className="mt-3">
          {fileName ? (
            <p className="text-caption text-[var(--ink-muted)]">
              <span aria-hidden="true">📎</span> {fileName}{" "}
              <button
                type="button"
                onClick={() => {
                  setMediaKey(null);
                  setFileName(null);
                }}
                disabled={pending}
                className="ms-2 font-semibold text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70 disabled:opacity-50"
              >
                إزالة
              </button>
            </p>
          ) : (
            <label className="text-caption inline-flex cursor-pointer items-center font-semibold text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]">
              <span aria-hidden="true" className="me-1">
                📎
              </span>
              {uploading ? "جارٍ الرفع…" : "أرفق ملفاً (اختياري)"}
              <input
                type="file"
                className="sr-only"
                disabled={pending || uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {uploadError ? (
            <p role="alert" className="text-caption mt-1 text-[var(--ink)]">
              {uploadError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          disabled={pending || uploading}
          onClick={onSubmit}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "جارٍ الإرسال…" : isRevision ? "أعد الإرسال" : "أرسل للمراجعة"}
        </button>

        {state === "draft" ? (
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className={buttonClass("ghost", "sm")}
          >
            أغلق المسودة
          </button>
        ) : null}

        {/* The auto-save indicator (§21) — reassurance, not a control. */}
        <span
          aria-hidden={!savedNote}
          className={`text-caption text-[var(--ink-muted)] transition-opacity duration-300 ${
            savedNote ? "opacity-100" : "opacity-0"
          }`}
        >
          حُفظت المسودة
        </span>
      </div>

      {/*
       * `aria-live` so a screen-reader Member hears the outcome, which appears
       * without any navigation. `polite` — a confirmation, not an interruption.
       */}
      <p aria-live="polite" className="text-caption mt-2 min-h-[1.5em] text-[var(--ink-muted)]">
        {result && result.status !== "submitted" && result.status !== "draft-saved"
          ? result.message
          : null}
      </p>
    </div>
  );
}
