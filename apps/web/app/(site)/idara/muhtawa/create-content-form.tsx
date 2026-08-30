"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createContentAction, type ContentActionState } from "./content-actions";
import { CONTENT_TYPES, CONTENT_TYPE_LABEL, type ContentType } from "./content-types";
import { buttonClass } from "../../components/ui";

/**
 * Create a content piece as a draft, then land on its editor to add media and
 * publish. An Admin may create track-less general content ("عام"); an editor must
 * choose one of their Tracks — the server enforces this, the form just reflects it.
 */
export function CreateContentForm({
  tracks,
  canCreateTrackless,
}: {
  tracks: { id: string; title: string }[];
  canCreateTrackless: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<ContentType>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [trackId, setTrackId] = useState<string>(canCreateTrackless ? "" : (tracks[0]?.id ?? ""));
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ContentActionState | null>(null);

  function submit() {
    start(async () => {
      const r = await createContentAction({ type, title, body, trackId: trackId || null });
      setResult(r);
      if (r.status === "ok" && r.id) router.push(`/idara/muhtawa/${r.id}`);
    });
  }

  const input =
    "min-h-11 text-body-sm w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50";
  const label = "text-caption mb-1 block text-[var(--ink-muted)]";

  return (
    <div className="max-w-xl rounded-lg border border-[var(--hairline)] p-5">
      <h2 className="text-body-lg mb-4 font-medium text-[var(--ink)]">محتوى جديد</h2>
      <div className="grid gap-4">
        <div>
          <label className={label} htmlFor="c-type">
            النوع
          </label>
          <select
            id="c-type"
            dir="rtl"
            value={type}
            disabled={pending}
            onChange={(e) => setType(e.target.value as ContentType)}
            className={input}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="c-title">
            العنوان
          </label>
          <input
            id="c-title"
            dir="rtl"
            value={title}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
            className={input}
          />
        </div>

        <div>
          <label className={label} htmlFor="c-body">
            النص
          </label>
          <textarea
            id="c-body"
            dir="rtl"
            rows={4}
            value={body}
            disabled={pending}
            onChange={(e) => setBody(e.target.value)}
            className={input}
          />
        </div>

        <div>
          <label className={label} htmlFor="c-track">
            المسار
          </label>
          <select
            id="c-track"
            dir="rtl"
            value={trackId}
            disabled={pending}
            onChange={(e) => setTrackId(e.target.value)}
            className={input}
          >
            {canCreateTrackless ? <option value="">عام (بلا مسار)</option> : null}
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending || title.trim() === "" || body.trim() === ""}
            onClick={submit}
            className={buttonClass("primary", "sm")}
          >
            {pending ? "…" : "أنشئ مسودة"}
          </button>
          <span
            aria-live="polite"
            role={result?.status === "error" ? "alert" : undefined}
            className="text-caption text-[var(--ink-muted)]"
          >
            {result?.status === "error" ? result.message : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
