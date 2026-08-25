"use client";

import { useState, useTransition } from "react";

import { updateTierAction, type ActionState } from "../admin-actions";

/**
 * Edit one tier's threshold and name (§46, admin-only). Threshold and name save in
 * one atomic action — never a threshold that lands while the rename fails. Because
 * tiers are derived on read, saving re-tiers every Member on their next visit — no
 * migration.
 */
export function TierRow({ tier }: { tier: { key: string; name: string; minPoints: number } }) {
  const [name, setName] = useState(tier.name);
  const [minPoints, setMinPoints] = useState(tier.minPoints);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  function save() {
    start(async () => setResult(await updateTierAction(tier.key, { name, minPoints })));
  }

  const input =
    "text-body-sm rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50";

  return (
    <li className="flex flex-wrap items-end gap-3 border-b border-[var(--hairline)] py-4">
      <label className="text-caption text-[var(--ink-muted)]">
        الاسم
        <input dir="rtl" value={name} disabled={pending} onChange={(e) => setName(e.target.value)} className={`${input} mt-1 block w-40`} />
      </label>
      <label className="text-caption text-[var(--ink-muted)]">
        الحد الأدنى للنقاط
        <input
          type="number"
          inputMode="numeric"
          min={0}
          dir="ltr"
          value={minPoints}
          disabled={pending}
          onChange={(e) => setMinPoints(Number(e.target.value))}
          className={`${input} mt-1 block w-28 text-left`}
        />
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="text-body-sm rounded-md border border-[var(--border)] px-4 py-1.5 font-semibold text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50"
      >
        {pending ? "…" : "احفظ"}
      </button>
      <span
        aria-live="polite"
        role={result?.status === "error" ? "alert" : undefined}
        className="text-caption text-[var(--ink-muted)]"
      >
        {result?.status === "error" ? result.message : result?.status === "ok" ? "✓" : ""}
      </span>
    </li>
  );
}
