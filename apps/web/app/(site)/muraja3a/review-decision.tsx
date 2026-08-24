"use client";

import { useState, useTransition } from "react";

import { acceptReview, type DecisionState, rejectReview, returnReview } from "./decision-actions";

/**
 * The Editor's verdict on the pending attempt (spec §25): accept with a graded
 * value, return with a note to revise, or reject with a reason.
 *
 * Accept and the two note-carrying verdicts are separated visually because they
 * are different kinds of act — one mints Points, the others send work back — and
 * because the note is required for a return or a reject but meaningless for an
 * accept. The server re-validates every rule; this only gathers the input.
 */
export function ReviewDecision({
  submissionId,
  maxPoints,
}: {
  submissionId: string;
  maxPoints: number;
}) {
  const [points, setPoints] = useState(maxPoints);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DecisionState | null>(null);

  const run = (fn: () => Promise<DecisionState>) =>
    startTransition(async () => setResult(await fn()));

  const noteId = `review-note-${submissionId}`;

  return (
    <div>
      {/* Accept — the only verdict that mints, and the only one that takes a value. */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor={`points-${submissionId}`}
            className="text-caption mb-2 block font-semibold text-[var(--ink-muted)]"
          >
            النقاط (حتى {maxPoints})
          </label>
          <input
            id={`points-${submissionId}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={maxPoints}
            dir="ltr"
            value={points}
            disabled={pending}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="text-body-sm w-28 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => acceptReview(submissionId, points))}
          className="text-body-sm rounded-md bg-[var(--brand)] px-5 py-2 font-semibold text-[var(--surface)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "…" : "اقبل العمل"}
        </button>
      </div>

      {/* Return / reject — both carry a note, so they share one field. */}
      <div className="mt-8">
        <label
          htmlFor={noteId}
          className="text-caption mb-2 block font-semibold text-[var(--ink-muted)]"
        >
          ملاحظة للعضو (للإعادة أو الرفض)
        </label>
        <textarea
          id={noteId}
          dir="rtl"
          rows={3}
          value={note}
          disabled={pending}
          onChange={(e) => setNote(e.target.value)}
          placeholder="وضّح المطلوب أو سبب الرفض…"
          className="text-body-sm w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50"
        />
        <div className="mt-3 flex flex-wrap gap-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => returnReview(submissionId, note))}
            className="text-body-sm rounded-md border border-[var(--border)] px-5 py-2 font-semibold text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            أعِد للتحسين
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => rejectReview(submissionId, note))}
            className="text-body-sm rounded-md border border-[var(--border)] px-5 py-2 font-semibold text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            ارفض نهائياً
          </button>
        </div>
      </div>

      <p aria-live="polite" className="text-body-sm mt-4 min-h-[1.5em] text-[var(--ink-muted)]">
        {result && result.status === "refused" ? result.message : null}
      </p>
    </div>
  );
}
