"use client";

import { useState, useTransition } from "react";

import {
  archiveTaskAction,
  createTaskAction,
  deleteTaskAction,
  publishTaskAction,
  updateTaskAction,
  type ActionState,
} from "../../track-actions";
import { Num } from "../../../components/num";
import { STATE_LABEL, type PublishState as State } from "../state-label";
import { buttonClass } from "../../../components/ui";

type Mode = "attest" | "review";
type Task = {
  id: string;
  title: string;
  instructions: string;
  mode: Mode;
  points: number;
  state: State;
};

const INPUT =
  "min-h-11 text-body-sm w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50";
const SMALL_BTN = buttonClass("ghost", "sm");

/** The Track's Tasks (§35): create new ones, and edit / publish / archive / delete each. */
export function TaskManager({ trackId, tasks }: { trackId: string; tasks: Task[] }) {
  return (
    <div>
      <CreateTaskForm trackId={trackId} />
      {tasks.length === 0 ? (
        <p className="text-body-sm mt-6 text-[var(--ink-muted)]">لا مهام في هذا المسار بعد.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateTaskForm({ trackId }: { trackId: string }) {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [mode, setMode] = useState<Mode>("review");
  const [points, setPoints] = useState(50);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  function submit() {
    start(async () => {
      const r = await createTaskAction(trackId, {
        title: title.trim(),
        instructions: instructions.trim(),
        mode,
        points,
      });
      setResult(r);
      if (r.status === "ok") {
        setTitle("");
        setInstructions("");
      }
    });
  }

  return (
    <div className="max-w-xl rounded-[var(--radius-card)] bg-[var(--surface-raised)] px-5 py-4 shadow-[var(--elevation-1)]">
      <p className="text-caption mb-3 font-semibold text-[var(--ink-muted)]">مهمة جديدة</p>
      <input
        dir="rtl"
        placeholder="عنوان المهمة"
        value={title}
        disabled={pending}
        onChange={(e) => setTitle(e.target.value)}
        className={`${INPUT} mb-2`}
      />
      <textarea
        dir="rtl"
        rows={2}
        placeholder="التعليمات"
        value={instructions}
        disabled={pending}
        onChange={(e) => setInstructions(e.target.value)}
        className={`${INPUT} mb-2`}
      />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-caption text-[var(--ink-muted)]">
          النوع
          <select
            dir="rtl"
            value={mode}
            disabled={pending}
            onChange={(e) => setMode(e.target.value as Mode)}
            className={`${INPUT} mt-1`}
          >
            <option value="review">بحاجة إلى مراجعة</option>
            <option value="attest">تأكيد ذاتي</option>
          </select>
        </label>
        <label className="text-caption text-[var(--ink-muted)]">
          النقاط
          <input
            type="number"
            inputMode="numeric"
            min={1}
            dir="ltr"
            value={points}
            disabled={pending}
            onChange={(e) => setPoints(Number(e.target.value))}
            className={`${INPUT} mt-1 w-24`}
          />
        </label>
        <button
          type="button"
          disabled={pending || !title.trim() || !instructions.trim()}
          onClick={submit}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "…" : "أضف"}
        </button>
      </div>
      <p
        aria-live="polite"
        role={result?.status === "error" ? "alert" : undefined}
        className="text-caption mt-2 min-h-[1.1em] text-[var(--ink-muted)]"
      >
        {result?.status === "ok" ? null : (result?.message ?? null)}
      </p>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [instructions, setInstructions] = useState(task.instructions);
  const [mode, setMode] = useState<Mode>(task.mode);
  const [points, setPoints] = useState(task.points);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  const run = (fn: () => Promise<ActionState>) => start(async () => setResult(await fn()));

  return (
    <li className="max-w-xl rounded-[var(--radius-card)] bg-[var(--surface-raised)] px-4 py-3 shadow-[var(--elevation-1)]">
      {editing ? (
        <div>
          <input
            dir="rtl"
            value={title}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
            className={`${INPUT} mb-2`}
          />
          <textarea
            dir="rtl"
            rows={2}
            value={instructions}
            disabled={pending}
            onChange={(e) => setInstructions(e.target.value)}
            className={`${INPUT} mb-2`}
          />
          <div className="flex flex-wrap items-end gap-3">
            <select
              dir="rtl"
              aria-label="نوع المهمة"
              value={mode}
              disabled={pending}
              onChange={(e) => setMode(e.target.value as Mode)}
              className={`${INPUT} w-40`}
            >
              <option value="review">بحاجة إلى مراجعة</option>
              <option value="attest">تأكيد ذاتي</option>
            </select>
            <input
              type="number"
              aria-label="النقاط"
              min={1}
              dir="ltr"
              value={points}
              disabled={pending}
              onChange={(e) => setPoints(Number(e.target.value))}
              className={`${INPUT} w-24`}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const r = await updateTaskAction(task.id, {
                    title: title.trim(),
                    instructions: instructions.trim(),
                    mode,
                    points,
                  });
                  if (r.status === "ok") setEditing(false);
                  return r;
                })
              }
              className={buttonClass("primary", "sm")}
            >
              {pending ? "…" : "احفظ"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(false)}
              className={SMALL_BTN}
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-body-sm font-medium text-[var(--ink)]">{task.title}</p>
            <p className="text-caption mt-1 text-[var(--ink-muted)]">
              {STATE_LABEL[task.state]} · <Num value={task.points} /> نقطة ·{" "}
              {task.mode === "review" ? "مراجعة" : "تأكيد"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(true)}
              className={SMALL_BTN}
            >
              عدّل
            </button>
            {task.state !== "published" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => publishTaskAction(task.id))}
                className={SMALL_BTN}
              >
                انشر
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => archiveTaskAction(task.id))}
                className={SMALL_BTN}
              >
                أرشف
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteTaskAction(task.id))}
              className={SMALL_BTN}
            >
              احذف
            </button>
          </div>
        </div>
      )}

      <p
        aria-live="polite"
        role={result?.status === "error" ? "alert" : undefined}
        className="text-caption mt-2 min-h-[1.1em] text-[var(--ink-muted)]"
      >
        {result?.status === "error" ? result.message : null}
      </p>
    </li>
  );
}
