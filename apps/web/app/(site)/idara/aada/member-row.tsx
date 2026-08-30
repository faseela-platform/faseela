"use client";

import { useState, useTransition } from "react";

import { setUserRoleAction, type ActionState } from "../admin-actions";

type Role = "member" | "editor" | "admin";

/**
 * One member's admin row (§34): change their role. A role is granted here, never
 * earned (ADR 0023). Applied on change, with the outcome announced.
 */
export function MemberRow({
  member,
}: {
  member: { id: string; name: string; email: string; role: Role; points: number };
}) {
  const [role, setRole] = useState<Role>(member.role);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  function change(next: Role) {
    setRole(next);
    start(async () => setResult(await setUserRoleAction(member.id, next)));
  }

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--hairline)] py-4">
      <div>
        <p className="text-body-sm font-medium text-[var(--ink)]">{member.name?.trim() || "عضو"}</p>
        <p className="text-caption mt-1 text-[var(--ink-muted)]" dir="ltr">
          {member.email} · {member.points} pts
        </p>
      </div>
      <div className="flex items-center gap-3">
        <select
          dir="rtl"
          aria-label="دور العضو"
          value={role}
          disabled={pending}
          onChange={(e) => change(e.target.value as Role)}
          className="text-body-sm min-h-11 rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50"
        >
          <option value="member">عضو</option>
          <option value="editor">محرّر</option>
          <option value="admin">إدارة</option>
        </select>
        <span
          aria-live="polite"
          role={result?.status === "error" ? "alert" : undefined}
          className="text-caption min-w-[4rem] text-[var(--ink-muted)]"
        >
          {pending
            ? "…"
            : result?.status === "error"
              ? result.message
              : result?.status === "ok"
                ? "✓"
                : ""}
        </span>
      </div>
    </li>
  );
}
