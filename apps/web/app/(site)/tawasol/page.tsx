import type { Metadata } from "next";
import { headers } from "next/headers";

import { SERVICE_REQUEST_MAX } from "@faseela/db";

import { auth } from "@/lib/auth";
import { Nav } from "../components/nav";
import { ContactForm } from "./contact-form";

/**
 * التواصل مع فسيلة (spec §37) — «طريق بسيط للتواصل مع الإدارة/المشرفين».
 *
 * Open to everyone: §37 names «الزائر والمستخدم» in the same breath, so this page has
 * no gate. It is deliberately one-way — the spec is explicit that v1 needs no chat
 * («لا نحتاج نظام محادثات اجتماعي كامل») — a message arrives, and the team answers
 * through whatever contact the sender left.
 *
 * Dynamic, not static: the page reads the session only so the nav can greet a
 * signed-in member (the form itself works either way).
 */
export const metadata: Metadata = {
  title: "تواصل معنا — مبادرة فسيلة",
  description: "أرسِل اقتراحاً أو استفساراً أو ملاحظة إلى فريق مبادرة فسيلة.",
};

export const dynamic = "force-dynamic";

export default async function TawasolPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <>
      <Nav
        current="/tawasol"
        signedIn={Boolean(session?.user)}
        memberName={session?.user?.name ?? null}
      />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <div className="reveal max-w-2xl">
            <p className="text-caption mb-4 font-semibold text-[var(--ink-muted)]">التواصل</p>
            <h1 className="font-display text-[clamp(1.9rem,4.2vw,3.052rem)] leading-[1.42] font-medium text-[var(--ink)]">
              تواصل معنا
            </h1>
            <p className="text-lede mt-6 text-[var(--ink-muted)]">
              اقتراح تريد مشاركته، استفسار يشغلك، ملاحظة على المبادرة أو على التطبيق — اكتب لنا
              وسنقرأ رسالتك.
            </p>
          </div>

          <div className="hairline rule-draw mt-12" />

          <div className="mt-10">
            {/* The caps come from the database module, so the form shows exactly the
                limits the server will hold it to — one source of truth, passed down
                rather than imported into the browser bundle. */}
            <ContactForm max={SERVICE_REQUEST_MAX} />
          </div>
        </section>
      </main>
    </>
  );
}
