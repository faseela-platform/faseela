"use client";

import { useState } from "react";

import { signIn } from "@/lib/auth-client";

/**
 * The magic-link request form.
 *
 * A Client Component calling `signIn.magicLink` directly, rather than a Server
 * Action. That is not the usual preference in this codebase, and the reason is
 * specific: Better Auth rejects requests without a matching `Origin` header with
 * `INVALID_ORIGIN_OR_NULL_ORIGIN`, and a `fetch` from the browser sets that header
 * for us. Routing the same call through a Server Action means constructing the
 * origin by hand on the server and getting it wrong in exactly the environments
 * where it matters, which is how CSRF protection ends up disabled by accident.
 */
export function SignInForm({ callbackURL }: { callbackURL: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * The confirmation deliberately does not say whether the address is registered.
   *
   * Telling an anonymous visitor "no such member" turns the sign-in form into a
   * membership oracle: anyone could test addresses to learn who belongs to
   * Faseela. For an initiative in Lebanon that is a safety question, not just a
   * privacy one. The same sentence is shown either way.
   */
  if (state === "sent") {
    return (
      <div aria-live="polite">
        <p className="text-body-lg font-medium text-[var(--ink)]">تحقّق من بريدك.</p>
        <p className="text-body-sm mt-3 text-[var(--ink-muted)]">
          إن كان هذا البريد مسجّلاً عندنا، فقد أرسلنا إليه رابط الدخول. ينتهي الرابط بعد عشر دقائق،
          ويُستخدم مرة واحدة.
        </p>
        <button
          type="button"
          onClick={() => {
            setState("idle");
            setError(null);
          }}
          className="text-body-sm mt-6 font-semibold text-[var(--brand)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-70"
        >
          استخدم بريداً آخر
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setState("sending");
        setError(null);

        const { error: authError } = await signIn.magicLink({ email, callbackURL });

        if (authError) {
          setState("error");
          /**
           * The upstream message is English and often refers to internals. Members
           * read Arabic, and a raw error string in a second script is worse than
           * no detail at all.
           */
          setError("تعذّر إرسال الرابط. تأكّد من البريد وحاول مرة أخرى.");
          return;
        }

        setState("sent");
      }}
    >
      <label htmlFor="email" className="text-body-sm mb-3 block font-medium text-[var(--ink)]">
        البريد الإلكتروني
      </label>

      {/*
       * `dir="ltr"` on the input alone, inside an RTL page.
       *
       * Email addresses are Latin text. Left in the page's RTL direction, the bidi
       * algorithm moves the cursor to the right edge and displays a trailing dot or
       * hyphen at the wrong end — so `member@site.co` can render as `.member@site`
       * while the stored value is correct. Members conclude the field is broken and
       * retype the address. `text-left` matches the alignment to the direction.
       */}
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        dir="ltr"
        placeholder="name@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={state === "sending"}
        className="text-body-lg w-full rounded-md border border-[var(--border)] bg-transparent px-4 py-3 text-left text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] placeholder:text-[var(--ink-faint)] focus:border-[var(--brand)] focus:outline-none disabled:opacity-50"
      />

      <button
        type="submit"
        disabled={state === "sending" || email.length === 0}
        className="text-body-lg mt-6 w-full rounded-md bg-[var(--brand)] px-6 py-3 font-semibold text-[var(--surface)] transition-opacity duration-[130ms] ease-[var(--ease-hover)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "sending" ? "جارٍ الإرسال…" : "أرسل رابط الدخول"}
      </button>

      <p aria-live="polite" className="text-body-sm mt-4 min-h-[1.5em] text-[var(--ink-muted)]">
        {error}
      </p>
    </form>
  );
}
