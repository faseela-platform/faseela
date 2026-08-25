"use client";

import { useState, useTransition } from "react";

import {
  archiveTrackAction,
  publishTrackAction,
  unpublishTrackAction,
  updateTrackAction,
  type ActionState,
} from "../../track-actions";
import { STATE_LABEL, type PublishState as State } from "../state-label";

/**
 * Edit a Track's fields and move it between states. Publishing is what makes the
 * Track appear on `/masarat`; the state comes from the server prop so it stays true
 * after each action revalidates.
 */
export function TrackEditor({
  trackId,
  initial,
}: {
  trackId: string;
  initial: { title: string; summary: string; slug: string; state: State };
}) {
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [slug, setSlug] = useState(initial.slug);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  const run = (fn: () => Promise<ActionState>) => start(async () => setResult(await fn()));

  const input =
    "text-body-sm w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50";
  const stateBtn =
    "text-body-sm rounded-md border border-[var(--border)] px-4 py-2 font-semibold text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="max-w-xl">
      <p className="text-caption mb-2 text-[var(--ink-muted)]">
        الحالة: <span className="font-semibold text-[var(--ink)]">{STATE_LABEL[initial.state]}</span>
      </p>

      <label htmlFor="track-title" className="text-caption mb-1 block text-[var(--ink-muted)]">العنوان</label>
      <input id="track-title" dir="rtl" value={title} disabled={pending} onChange={(e) => setTitle(e.target.value)} className={`${input} mb-3`} />

      <label htmlFor="track-summary" className="text-caption mb-1 block text-[var(--ink-muted)]">الوصف</label>
      <textarea id="track-summary" dir="rtl" rows={2} value={summary} disabled={pending} onChange={(e) => setSummary(e.target.value)} className={`${input} mb-3`} />

      <label htmlFor="track-slug" className="text-caption mb-1 block text-[var(--ink-muted)]">المُعرّف (لاتيني)</label>
      <input id="track-slug" dir="ltr" value={slug} disabled={pending} onChange={(e) => setSlug(e.target.value)} className={`${input} text-left`} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => updateTrackAction(trackId, { title: title.trim(), summary: summary.trim(), slug: slug.trim() }))}
          className="text-body-sm rounded-md bg-[var(--brand)] px-5 py-2 font-semibold text-[var(--surface)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "…" : "احفظ"}
        </button>

        {initial.state !== "published" ? (
          <button type="button" disabled={pending} onClick={() => run(() => publishTrackAction(trackId))} className={stateBtn}>
            انشر
          </button>
        ) : null}
        {initial.state !== "draft" ? (
          <button type="button" disabled={pending} onClick={() => run(() => unpublishTrackAction(trackId))} className={stateBtn}>
            أعِد إلى مسودة
          </button>
        ) : null}
        {initial.state !== "archived" ? (
          <button type="button" disabled={pending} onClick={() => run(() => archiveTrackAction(trackId))} className={stateBtn}>
            أرشف
          </button>
        ) : null}
      </div>

      <p
        aria-live="polite"
        role={result?.status === "error" ? "alert" : undefined}
        className="text-caption mt-3 min-h-[1.25em] text-[var(--ink-muted)]"
      >
        {result?.message ?? null}
      </p>
    </div>
  );
}
