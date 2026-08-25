"use client";

import { useState, useTransition } from "react";

import { assignSupervisorAction, removeSupervisorAction, type ActionState } from "../../admin-actions";

type Editor = { id: string; name: string };

/**
 * Assign or remove supervisors of this Track (admin-only, §35). Supervisors are
 * chosen from staff (editors/admins); assigning one scopes their access to this
 * Track. Admin-only — the page renders this component only for an admin.
 */
export function SupervisorPanel({
  trackId,
  supervisors,
  assignable,
}: {
  trackId: string;
  supervisors: Editor[];
  assignable: Editor[];
}) {
  const [selected, setSelected] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const run = (fn: () => Promise<ActionState>) => start(async () => setResult(await fn()));

  return (
    <div className="max-w-xl">
      {supervisors.length === 0 ? (
        <p className="text-body-sm text-[var(--ink-muted)]">لا مشرفين على هذا المسار بعد.</p>
      ) : (
        <ul className="space-y-2">
          {supervisors.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-3">
              <span className="text-body-sm text-[var(--ink)]">{s.name}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeSupervisorAction(trackId, s.id))}
                className="text-caption font-semibold text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--ink)] disabled:opacity-50"
              >
                اسحب الإشراف
              </button>
            </li>
          ))}
        </ul>
      )}

      {assignable.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            dir="rtl"
            value={selected}
            disabled={pending}
            onChange={(e) => setSelected(e.target.value)}
            className="text-body-sm rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50"
          >
            <option value="">اختر عضواً…</option>
            {assignable.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !selected}
            onClick={() => run(async () => {
              const r = await assignSupervisorAction(trackId, selected);
              if (r.status === "ok") setSelected("");
              return r;
            })}
            className="text-body-sm rounded-md border border-[var(--border)] px-4 py-2 font-semibold text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50"
          >
            عيّن مشرفاً
          </button>
        </div>
      ) : null}

      <p aria-live="polite" role={result?.status === "error" ? "alert" : undefined} className="text-caption mt-2 min-h-[1.1em] text-[var(--ink-muted)]">
        {result?.status === "error" ? result.message : null}
      </p>
    </div>
  );
}
