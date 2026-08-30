import type { Metadata } from "next";
import { headers } from "next/headers";

import { SERVICE_REQUEST_MAX, unreadNotificationCount } from "@faseela/db";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Nav } from "../components/nav";
import { Card, PageHeader } from "../components/ui";
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
  /** For the nav bell (§38); a visitor has nothing unread. */
  const unreadCount = session?.user ? await unreadNotificationCount(db, session.user.id) : 0;

  return (
    <>
      <Nav
        current="/tawasol"
        signedIn={Boolean(session?.user)}
        memberName={session?.user?.name ?? null}
        unreadCount={unreadCount}
      />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-12 pb-16 md:pt-16 md:pb-24">
          <PageHeader
            eyebrow="التواصل"
            title="تواصل معنا"
            lede="اقتراح تريد مشاركته، استفسار يشغلك، ملاحظة على المبادرة أو على التطبيق — اكتب لنا وسنقرأ رسالتك."
          />

          <Card reveal={80} className="mt-10 max-w-2xl">
            {/* The caps come from the database module, so the form shows exactly the
                limits the server will hold it to — one source of truth, passed down
                rather than imported into the browser bundle. */}
            <ContactForm max={SERVICE_REQUEST_MAX} />
          </Card>
        </section>
      </main>
    </>
  );
}
