"use client";

import { useState, useTransition } from "react";

import { Num } from "../components/num";
import { buttonClass } from "../components/ui";
import { attest, type AttestActionState } from "./actions";

/**
 * The button that completes an `attest` Task.
 *
 * This is the first client component on the public site, and that is a deliberate
 * concession rather than a drift. ADR 0011 keeps the site at zero client
 * JavaScript by doing all motion with CSS scroll timelines, and every page until
 * now has honoured it. Completing a Task cannot: it is a mutation with three
 * outcomes, and the Member needs to know which one happened without a full page
 * reload throwing them back to the top of a long Track.
 *
 * The bundle is kept to the smallest thing that can express that. `useTransition`
 * rather than a form library, one `useState` for the outcome, no client-side
 * validation — the server owns every rule, so there is nothing here to duplicate.
 *
 * ## Why the button disappears after success
 *
 * `completed` is terminal. `submission_task_user_unique` means the same Member
 * cannot complete the same Task twice, so leaving an enabled button would offer an
 * action guaranteed to be refused. The row becomes a statement instead.
 */
export function AttestButton({
  taskId,
  trackSlug,
  points,
  /** Server-rendered from `completedTaskIds`, so a returning Member sees the truth. */
  alreadyDone,
}: {
  taskId: string;
  trackSlug: string;
  points: number;
  alreadyDone: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AttestActionState | null>(null);

  const done =
    alreadyDone || result?.status === "completed" || result?.status === "already-completed";

  if (done) {
    return (
      <p className="text-body-sm inline-flex min-h-11 items-center font-semibold text-[var(--accent)]">
        {/*
         * A checkmark, marked decorative. The Arabic beside it already says the
         * Task is complete, and a screen reader announcing "heavy check mark"
         * before the sentence adds noise rather than meaning.
         */}
        <span aria-hidden="true">✓</span> مُنجزة
        {result?.status === "completed" ? (
          <>
            {" — أُضيفت "}
            <Num value={points} />
            {" نقطة."}
          </>
        ) : null}
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await attest(taskId, trackSlug));
          })
        }
        className={buttonClass("primary", "sm")}
      >
        {pending ? "جارٍ التأكيد…" : "أكّدت إنجازها"}
      </button>

      {/*
       * `aria-live` because the outcome appears without any navigation. Without it
       * a screen reader user taps the button and is told nothing at all — the most
       * common accessibility failure in Server Action UIs.
       *
       * `polite` rather than `assertive`: this is a confirmation, not an
       * interruption.
       */}
      <p aria-live="polite" className="text-caption mt-2 min-h-[1.5em] text-[var(--ink-muted)]">
        {result && result.status !== "completed" && result.status !== "already-completed"
          ? result.message
          : null}
      </p>
    </div>
  );
}
