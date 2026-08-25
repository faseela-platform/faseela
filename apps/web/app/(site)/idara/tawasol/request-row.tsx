"use client";

import { useState, useTransition } from "react";

import type { ServiceRequestStatus, ServiceRequestType } from "@faseela/db";

import { KIND_LABEL, STATUSES, STATUS_LABEL } from "../../components/service-request-types";
import { setRequestStatusAction, type TriageState } from "./actions";

/**
 * One message in the triage queue: what was sent, who sent it and how to answer
 * them, and a status the admin moves as they work it. The body is shown in full —
 * a contact list that hides the message makes you open every row to triage.
 */
export function RequestRow({
  request,
}: {
  request: {
    id: string;
    requestType: ServiceRequestType;
    name: string;
    email: string | null;
    phone: string | null;
    body: string;
    status: ServiceRequestStatus;
    createdAt: string;
    signedIn: boolean;
  };
}) {
  const [status, setStatus] = useState<ServiceRequestStatus>(request.status);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TriageState | null>(null);

  function change(next: ServiceRequestStatus) {
    setStatus(next);
    start(async () => setResult(await setRequestStatusAction(request.id, next)));
  }

  return (
    <li className="border-b border-[var(--hairline)] py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-body-sm font-medium text-[var(--ink)]">
            {request.name}
            <span className="text-caption mr-2 font-normal text-[var(--brand)]">
              {KIND_LABEL[request.requestType]}
            </span>
            {request.signedIn ? (
              <span className="text-caption mr-2 font-normal text-[var(--ink-faint)]">عضو</span>
            ) : null}
          </p>
          <p className="text-caption mt-1 text-[var(--ink-faint)]" dir="ltr">
            {[request.email, request.phone].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            dir="rtl"
            value={status}
            disabled={pending}
            onChange={(e) => change(e.target.value as ServiceRequestStatus)}
            aria-label="حالة الرسالة"
            className="text-body-sm rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <span
            aria-live="polite"
            role={result?.status === "error" ? "alert" : undefined}
            className="text-caption min-w-[3rem] text-[var(--ink-muted)]"
          >
            {pending ? "…" : result?.status === "error" ? result.message : result ? "✓" : ""}
          </span>
        </div>
      </div>

      <p className="text-body-sm mt-3 max-w-2xl whitespace-pre-wrap text-[var(--ink-muted)]">
        {request.body}
      </p>
      <p className="text-caption mt-2 text-[var(--ink-faint)]">{request.createdAt}</p>
    </li>
  );
}
