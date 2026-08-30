import type { Metadata } from "next";

import { adminNotifications, unreadNotificationCount } from "@faseela/db";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { Nav } from "../../components/nav";
import { BackLink } from "../../components/ui";
import { NotifyComposer, NotifyRow } from "./notify-composer";

/**
 * Managing notifications from the dashboard — §38's «الإشعارات يجب أن تكون قابلة
 * للإدارة من لوحة التحكم». An admin composes and sends the initiative's broadcasts,
 * and can see the per-member events the platform raised on its own.
 */
export const metadata: Metadata = {
  title: "الإشعارات — لوحة التحكم",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

export default async function IdaraIshaarat() {
  const admin = await requireAdmin();
  const [items, unreadCount] = await Promise.all([
    adminNotifications(db),
    unreadNotificationCount(db, admin.id),
  ]);

  return (
    <>
      <Nav current="/idara" signedIn memberName={admin.name} unreadCount={unreadCount} />
      <main>
        <section className="gutter mx-auto max-w-[1440px] pt-10 pb-16 md:pb-24">
          <BackLink href="/idara">لوحة التحكم</BackLink>

          <h1
            data-reveal="0"
            className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-extrabold text-[var(--ink)]"
          >
            الإشعارات
          </h1>
          <p className="lede text-body-lg mt-4 max-w-xl text-[var(--ink-muted)]">
            أرسِل إعلاناً أو تحديثاً إلى جميع الأعضاء. الإشعارات المرتبطة بالمراجعة والنقاط يرسلها
            النظام تلقائياً، وتظهر هنا للاطّلاع.
          </p>

          <div className="mt-8">
            <NotifyComposer />
          </div>

          <div className="hairline mt-12" />
          {items.length === 0 ? (
            <p className="text-body-sm mt-8 text-[var(--ink-muted)]">لا إشعارات بعد.</p>
          ) : (
            <ul className="mt-4 max-w-3xl">
              {items.map((n) => (
                <NotifyRow
                  key={n.id}
                  item={{
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    body: n.body,
                    state: n.state,
                    isBroadcast: n.userId === null,
                    when: dateFmt.format(n.publishedAt ?? n.createdAt),
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
