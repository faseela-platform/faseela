"use client";

import { useState } from "react";

import { signIn } from "@/lib/auth-client";
import { buttonClass } from "../components/ui";

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
          className={buttonClass("ghost", "sm", "-ms-4 mt-4")}
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

        /**
         * Three destinations ride inside the link. `callbackURL` is where the
         * Member was going. `errorCallbackURL` brings a used or expired link
         * back here with `?error=`, keeping the same return path so a retry
         * still lands where they meant to go — without it Better Auth bounces
         * to `callbackURL?error=…`, which shows nothing. `newUserCallbackURL`
         * sends a first-time account to the §5 step (name + phone) first, and
         * that step forwards to the original destination via `next`.
         */
        const returnTo = encodeURIComponent(callbackURL);
        const { error: authError } = await signIn.magicLink({
          email,
          callbackURL,
          errorCallbackURL: `/dukhul?callbackURL=${returnTo}`,
          newUserCallbackURL: `/akmil-hisabak?next=${returnTo}`,
        });

        if (authError) {
          setState("error");
          /**
           * The upstream message is English and often refers to internals. Members
           * read Arabic, and a raw error string in a second script is worse than
           * no detail at all.
           */
          setError(
            authError.status === 429
              ? "طلبات كثيرة لهذا البريد. انتظر قليلاً ثم حاول مجدداً."
              : "تعذّر إرسال الرابط. تأكّد من البريد وحاول مرة أخرى.",
          );
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
        autoFocus
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        dir="ltr"
        placeholder="name@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={state === "sending"}
        aria-invalid={state === "error"}
        aria-describedby={state === "error" ? "email-error" : undefined}
        className="text-body-lg min-h-[44px] w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-[var(--ink)] transition-colors duration-[130ms] ease-[var(--ease-hover)] placeholder:text-[var(--ink-muted)] focus:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:outline-none disabled:opacity-50"
      />

      <button
        type="submit"
        disabled={state === "sending" || email.length === 0}
        aria-busy={state === "sending"}
        className={buttonClass("primary", "md", "mt-6 w-full")}
      >
        {state === "sending" ? "جارٍ الإرسال…" : "أرسل رابط الدخول"}
      </button>

      {/*
       * `role="alert"` (implicitly assertive) so the failure is announced the
       * moment it appears; associated with the input via `aria-describedby` so a
       * screen-reader user hears why the field is invalid. Reserves its line so
       * the layout does not jump when the message arrives.
       */}
      <p
        id="email-error"
        role="alert"
        className="text-body-sm mt-4 min-h-[1.5em] text-[var(--ink-muted)]"
      >
        {error}
      </p>
    </form>
  );
}
