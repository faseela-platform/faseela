"use client";

import { useState, useTransition } from "react";

import type { ServiceRequestType } from "@faseela/db";

import { KINDS, KIND_LABEL } from "../components/service-request-types";
import { buttonClass } from "../components/ui";
import { submitServiceRequestAction, type ContactState } from "./actions";

/**
 * The field ceilings, handed down by the server page rather than imported here.
 * `@faseela/db` is a *server* package — importing a runtime value from it into a
 * client component pulls node-postgres into the browser bundle — so the one source of
 * truth stays in the database module and travels as a prop.
 */
export type FieldMax = { name: number; email: number; phone: number; body: number };

/**
 * The contact form (§37). Open to visitors and members alike — no account needed, and
 * a signed-in sender is recognised on the server without being asked who they are.
 */
export function ContactForm({ max }: { max: FieldMax }) {
  const [requestType, setRequestType] = useState<ServiceRequestType>("suggestion");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  /** The honeypot: off-screen, out of the tab order, and never filled by a person. */
  const [fax, setFax] = useState("");

  const [pending, start] = useTransition();
  const [result, setResult] = useState<ContactState | null>(null);

  function submit() {
    start(async () => {
      const r = await submitServiceRequestAction({ requestType, name, email, phone, body, fax });
      setResult(r);
      if (r.status === "sent") {
        setName("");
        setEmail("");
        setPhone("");
        setBody("");
      }
    });
  }

  /** `min-h-11` = 44px: the floor for a touch target, which `py-2.5` alone misses by a
   * pixel on the select at mobile widths. */
  const input =
    "text-body-sm min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] focus-visible:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none disabled:opacity-50";
  const label = "text-caption mb-1.5 block font-medium text-[var(--ink-muted)]";

  if (result?.status === "sent") {
    return (
      <div className="max-w-xl rounded-[var(--radius-card)] bg-[color-mix(in_oklch,var(--brand)_8%,transparent)] p-6">
        <p className="text-body-lg font-bold text-[var(--ink)]">{result.message}</p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className={buttonClass("ghost", "sm", "-ms-4 mt-3")}
        >
          أرسِل رسالة أخرى
        </button>
      </div>
    );
  }

  return (
    <form
      className="grid max-w-xl gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <label className={label} htmlFor="c-kind">
          نوع الرسالة
        </label>
        <select
          id="c-kind"
          dir="rtl"
          value={requestType}
          disabled={pending}
          onChange={(e) => setRequestType(e.target.value as ServiceRequestType)}
          className={input}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={label} htmlFor="c-name">
          الاسم
        </label>
        <input
          id="c-name"
          dir="rtl"
          value={name}
          maxLength={max.name}
          autoComplete="name"
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          className={input}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="c-email">
            البريد الإلكتروني
          </label>
          <input
            id="c-email"
            type="email"
            dir="ltr"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            maxLength={max.email}
            autoComplete="email"
            disabled={pending}
            onChange={(e) => setEmail(e.target.value)}
            className={`${input} text-left`}
          />
        </div>
        <div>
          <label className={label} htmlFor="c-phone">
            رقم الهاتف
          </label>
          <input
            id="c-phone"
            type="tel"
            dir="ltr"
            inputMode="tel"
            value={phone}
            maxLength={max.phone}
            autoComplete="tel"
            disabled={pending}
            onChange={(e) => setPhone(e.target.value)}
            className={`${input} text-left`}
          />
        </div>
      </div>
      <p className="text-caption -mt-3 text-[var(--ink-muted)]">
        اترك بريداً أو رقماً واحداً على الأقل لنتمكّن من الرد.
      </p>

      <div>
        <label className={label} htmlFor="c-body">
          الرسالة
        </label>
        <textarea
          id="c-body"
          dir="rtl"
          rows={6}
          value={body}
          maxLength={max.body}
          disabled={pending}
          onChange={(e) => setBody(e.target.value)}
          className={input}
        />
      </div>

      {/*
        The honeypot. Hidden from sight and from the tab order and announced to no
        one — a person cannot fill it, so anything that does is a script. `-start` not
        `-left`: the offset must follow the writing direction, and this page is RTL.
      */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-fax">Fax</label>
        <input
          id="c-fax"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={fax}
          onChange={(e) => setFax(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={buttonClass("primary", "sm")}
        >
          {pending ? "جارٍ الإرسال…" : "أرسِل"}
        </button>
        <span
          aria-live="polite"
          role={result?.status === "error" ? "alert" : undefined}
          className="text-body-sm text-[var(--ink-muted)]"
        >
          {result?.status === "error" ? result.message : ""}
        </span>
      </div>
    </form>
  );
}
