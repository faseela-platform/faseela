"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { BroadcastType } from "@faseela/db";

import {
  archiveNotificationAction,
  createNotificationAction,
  deleteNotificationAction,
  publishNotificationAction,
  unpublishNotificationAction,
  type NotifyState,
} from "./actions";
import { buttonClass } from "../../components/ui";

const TYPE_LABEL: Record<BroadcastType, string> = {
  announcement: "إعلان أو فعالية",
  app_update: "تحديث في التطبيق",
};
const TYPES = Object.keys(TYPE_LABEL) as BroadcastType[];

const input =
  "text-body-sm min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50";
const label = "text-caption mb-1.5 block font-medium text-[var(--ink-muted)]";

/** Compose a broadcast. It is saved as a draft — sending is a separate, deliberate act. */
export function NotifyComposer() {
  const router = useRouter();
  const [type, setType] = useState<BroadcastType>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<NotifyState | null>(null);

  function submit() {
    start(async () => {
      const r = await createNotificationAction({ type, title, body });
      setResult(r);
      if (r.status === "ok") {
        setTitle("");
        setBody("");
        router.refresh();
      }
    });
  }

  return (
    <form
      className="grid max-w-xl gap-4 rounded-[var(--radius-card)] bg-[var(--surface-raised)] p-5 shadow-[var(--card-shadow)]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className="text-body-lg font-medium text-[var(--ink)]">إشعار جديد</h2>

      <div>
        <label className={label} htmlFor="n-type">
          النوع
        </label>
        <select
          id="n-type"
          dir="rtl"
          value={type}
          disabled={pending}
          onChange={(e) => setType(e.target.value as BroadcastType)}
          className={input}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={label} htmlFor="n-title">
          العنوان
        </label>
        <input
          id="n-title"
          dir="rtl"
          value={title}
          maxLength={120}
          disabled={pending}
          onChange={(e) => setTitle(e.target.value)}
          className={input}
        />
      </div>

      <div>
        <label className={label} htmlFor="n-body">
          النص
        </label>
        <textarea
          id="n-body"
          dir="rtl"
          rows={4}
          value={body}
          maxLength={1000}
          disabled={pending}
          onChange={(e) => setBody(e.target.value)}
          className={input}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending || title.trim() === "" || body.trim() === ""}
          aria-busy={pending}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "…" : "احفظ كمسودة"}
        </button>
        <span
          aria-live="polite"
          role={result?.status === "error" ? "alert" : undefined}
          className="text-caption text-[var(--ink-muted)]"
        >
          {result?.message ?? ""}
        </span>
      </div>
    </form>
  );
}

/** One notification in the admin list, with the controls its state allows. */
export function NotifyRow({
  item,
}: {
  item: {
    id: string;
    type: string;
    title: string;
    body: string;
    state: "draft" | "published" | "archived";
    isBroadcast: boolean;
    when: string;
  };
}) {
  const router = useRouter();
  const [state, setState] = useState(item.state);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<NotifyState | null>(null);

  function run(action: () => Promise<NotifyState>, next?: typeof state) {
    start(async () => {
      const r = await action();
      setResult(r);
      if (r.status === "ok" && next) setState(next);
      router.refresh();
    });
  }

  const btn = buttonClass("ghost", "sm");

  const STATE_LABEL = { draft: "مسودة", published: "مُرسَل", archived: "مؤرشف" } as const;

  return (
    <li className="border-b border-[var(--hairline)] py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-sm font-medium text-[var(--ink)]">{item.title}</p>
          <p className="text-caption mt-1 text-[var(--ink-muted)]">
            {STATE_LABEL[state]} · {item.isBroadcast ? "للجميع" : "لعضو"} · {item.when}
          </p>
        </div>

        {/* Only broadcasts are editable: an event notification records something that
            happened, and rewriting it would make it a lie. */}
        {item.isBroadcast ? (
          <div className="flex flex-wrap items-center gap-2">
            {state !== "published" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => publishNotificationAction(item.id), "published")}
                className={btn}
              >
                أرسِل
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => unpublishNotificationAction(item.id), "draft")}
                className={btn}
              >
                اسحب
              </button>
            )}
            {state !== "archived" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => archiveNotificationAction(item.id), "archived")}
                className={btn}
              >
                أرشِف
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteNotificationAction(item.id))}
              className={btn}
            >
              احذف
            </button>
          </div>
        ) : null}
      </div>

      <p className="text-body-sm mt-2 max-w-2xl text-[var(--ink-muted)]">{item.body}</p>
      <span
        aria-live="polite"
        role={result?.status === "error" ? "alert" : undefined}
        className="text-caption text-[var(--ink-muted)]"
      >
        {result?.status === "error" ? result.message : ""}
      </span>
    </li>
  );
}
