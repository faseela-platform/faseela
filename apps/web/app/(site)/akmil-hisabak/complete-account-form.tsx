"use client";

import { useState, useTransition } from "react";

import { completeAccount } from "./actions";

/**
 * Collects the §5 account data a Member did not give at sign-in: a full name and
 * a phone number. Rendered once, after the magic link has verified the email —
 * so this is profile, not authentication, and the two are kept apart.
 *
 * A Client Component for the same reason the sign-in form is: it holds the
 * in-place validation state and the busy state, and calls the Server Action
 * through a transition so the page navigates itself on success.
 */
export function CompleteAccountForm({ next }: { next: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          // On success the action redirects (throws), so control does not return.
          const result = await completeAccount({ name, phone, next });
          if (result?.error) setError(result.error);
        });
      }}
    >
      <label htmlFor="name" className="text-body-sm mb-3 block font-medium text-[var(--ink)]">
        الاسم الكامل
      </label>
      <input
        id="name"
        name="name"
        type="text"
        required
        autoFocus
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={pending}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "profile-error" : undefined}
        className="text-body-lg min-h-[44px] w-full rounded-md border border-[var(--border)] bg-transparent px-4 py-3 text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none disabled:opacity-50"
      />

      <label htmlFor="phone" className="text-body-sm mt-6 mb-3 block font-medium text-[var(--ink)]">
        رقم الهاتف
      </label>
      {/*
       * `dir="ltr"` + `text-left`, like the email field: a phone number is Latin
       * digits and the page is RTL, so left in the page direction the leading
       * `+` and country code render at the wrong end.
       */}
      <input
        id="phone"
        name="phone"
        type="tel"
        required
        inputMode="tel"
        autoComplete="tel"
        dir="ltr"
        placeholder="+961 …"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        disabled={pending}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "profile-error" : undefined}
        className="text-body-lg min-h-[44px] w-full rounded-md border border-[var(--border)] bg-transparent px-4 py-3 text-left text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none disabled:opacity-50"
      />
      <p className="text-body-sm mt-2 text-[var(--ink-muted)]">
        رقم هاتفك هو وسيلة التواصل الأساسية. لن نتحقّق منه الآن.
      </p>

      <button
        type="submit"
        disabled={pending || name.trim().length === 0 || phone.trim().length === 0}
        aria-busy={pending}
        className="text-body-lg mt-8 min-h-[44px] w-full rounded-md bg-[var(--brand)] px-6 py-3 font-semibold text-[var(--surface)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "جارٍ الحفظ…" : "متابعة"}
      </button>

      <p
        id="profile-error"
        role="alert"
        className="text-body-sm mt-4 min-h-[1.5em] text-[var(--ink-muted)]"
      >
        {error}
      </p>
    </form>
  );
}
