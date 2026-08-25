"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createServiceRequest, type ServiceRequestType } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Contacting Faseela (spec §37), as a Server Action.
 *
 * This is the application's only write that does not require an account — §37 admits
 * «الزائر والمستخدم», and a form that demanded a login would defeat its purpose. That
 * makes it the one surface an anonymous internet can push rows into, so it carries
 * guards the rest of the app doesn't need:
 *
 * - a **honeypot** field a real person never sees and never fills;
 * - a **hashed origin** for the per-hour rate limit in `createServiceRequest`;
 * - field caps and validation, which live in `@faseela/db` so any future caller (a
 *   mobile endpoint) inherits them rather than re-implementing them here.
 *
 * A Server Action rather than a route handler, deliberately: Next checks the request
 * origin for actions, which costs an unauthenticated `/api` POST nothing to forge.
 */
export type ContactState = { status: "sent" | "error"; message: string };

const SENT: ContactState = {
  status: "sent",
  message: "وصلتنا رسالتك، شكراً لك. سنتواصل معك عند الحاجة.",
};

/**
 * A stable, non-reversible tag for one sender, used only to count how often that
 * origin writes. The address itself is never stored.
 *
 * Two details are load-bearing, and both are about not trusting the client:
 *
 * 1. **Which header.** `x-forwarded-for` is a *client-supplied* header that a proxy
 *    appends to; taking its first hop means anyone can rotate a fake address per
 *    request and never be limited. `x-vercel-forwarded-for` is set by the platform
 *    itself and cannot be spoofed from outside, so it is preferred; the last hop of
 *    `x-forwarded-for` is the fallback, because whatever proxy is actually in front
 *    of us appended it — the earlier entries are the ones a caller controls.
 * 2. **The salt must exist.** Hashing an IPv4 address with a *known* salt is
 *    reversible by brute force in minutes — the whole space is 2³² — which would turn
 *    this column into a plaintext log of who visited. A missing secret is therefore a
 *    fault, not something to paper over with a default.
 */
async function originHash(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const lastHop = forwarded?.split(",").at(-1)?.trim() || null;
  const ip = h.get("x-vercel-forwarded-for")?.trim() || h.get("x-real-ip")?.trim() || lastHop;
  if (!ip) return null;

  const salt = process.env.BETTER_AUTH_SECRET;
  if (!salt) {
    throw new Error("BETTER_AUTH_SECRET is not set; refusing to hash origins with a known salt.");
  }
  return createHash("sha256").update(`service-request:${ip}:${salt}`).digest("hex");
}

export async function submitServiceRequestAction(input: {
  requestType: ServiceRequestType;
  name: string;
  email: string;
  phone: string;
  body: string;
  /**
   * The honeypot. Deliberately *not* named `website`/`email`/`company`: those are
   * exactly what a password manager autofills, which would silently swallow a real
   * person's message. A fax number is plausible enough for a bot to fill and nothing
   * a browser volunteers.
   */
  fax?: string;
}): Promise<ContactState> {
  const trapped = Boolean(input.fax && input.fax.trim() !== "");

  /** Attach the sender's account when they happen to be signed in — §37's «المستخدم». */
  const session = await auth.api.getSession({ headers: await headers() });

  /**
   * A filled honeypot means a script, not a person. Answer exactly as success does —
   * telling a bot it was detected only teaches whoever wrote it to try again — and
   * drop out only *after* the session read above, so the two paths take similar work
   * and the response time is not itself a tell.
   */
  if (trapped) return SENT;

  const result = await createServiceRequest(db, {
    requestType: input.requestType,
    name: input.name,
    email: input.email,
    phone: input.phone,
    body: input.body,
    userId: session?.user?.id ?? null,
    ipHash: await originHash(),
  });

  switch (result.status) {
    case "created":
      return SENT;
    case "rate-limited":
      return {
        status: "error",
        message: "وصلتنا عدة رسائل منك للتو. انتظر قليلاً قبل إرسال رسالة أخرى.",
      };
    case "invalid":
      /** One message for every validation outcome: the form states what it needs, and
       * echoing the submitted values back is how a contact form becomes a reflector. */
      return {
        status: "error",
        message: "تأكّد من الاسم والرسالة، ومن ترك بريد أو رقم هاتف للتواصل.",
      };
  }
}
