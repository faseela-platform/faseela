"use client";

import { useState, useTransition } from "react";

import { createTrackAction, type ActionState } from "./track-actions";

/**
 * Create a Track (admin-only, §34). A new Track always starts as a draft — it does
 * not appear on `/masarat` until published from its own page. The slug is Latin
 * (`dir="ltr"`); title and summary are Arabic (`dir="rtl"`). Rules are the server's;
 * this gathers input and shows the outcome.
 */
export function CreateTrackForm() {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  function submit() {
    start(async () => {
      const r = await createTrackAction({ slug: slug.trim(), title: title.trim(), summary: summary.trim() });
      setResult(r);
      if (r.status === "ok") {
        setSlug("");
        setTitle("");
        setSummary("");
      }
    });
  }

  const input =
    "text-body-sm w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50";
  const isError = result?.status === "error";

  return (
    <div className="max-w-xl rounded-md border border-[var(--border)] px-6 py-5">
      <p className="text-caption mb-4 font-semibold text-[var(--ink-muted)]">مسار جديد</p>

      <label htmlFor="new-track-title" className="text-caption mb-1 block text-[var(--ink-muted)]">العنوان</label>
      <input id="new-track-title" dir="rtl" value={title} disabled={pending} onChange={(e) => setTitle(e.target.value)} className={`${input} mb-3`} />

      <label htmlFor="new-track-summary" className="text-caption mb-1 block text-[var(--ink-muted)]">الوصف</label>
      <textarea id="new-track-summary" dir="rtl" rows={2} value={summary} disabled={pending} onChange={(e) => setSummary(e.target.value)} className={`${input} mb-3`} />

      <label htmlFor="new-track-slug" className="text-caption mb-1 block text-[var(--ink-muted)]">المُعرّف (لاتيني)</label>
      <input
        id="new-track-slug"
        dir="ltr"
        placeholder="reading-groups"
        value={slug}
        disabled={pending}
        onChange={(e) => setSlug(e.target.value)}
        className={`${input} text-left`}
      />

      <button
        type="button"
        disabled={pending || !title.trim() || !slug.trim()}
        onClick={submit}
        className="text-body-sm mt-4 rounded-md bg-[var(--brand)] px-5 py-2 font-semibold text-[var(--surface)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "جارٍ الإنشاء…" : "أنشئ المسار"}
      </button>

      <p
        aria-live="polite"
        role={isError ? "alert" : undefined}
        className="text-caption mt-3 min-h-[1.25em] text-[var(--ink-muted)]"
      >
        {result?.message ?? null}
      </p>
    </div>
  );
}
