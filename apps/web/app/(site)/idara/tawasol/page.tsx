import type { Metadata } from "next";
import Link from "next/link";

import { adminServiceRequests, type ServiceRequestStatus } from "@faseela/db";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { Nav } from "../../components/nav";
import { STATUS_LABEL } from "../../components/service-request-types";
import { RequestRow } from "./request-row";

/**
 * The §37 triage queue — everything people sent through `/tawasol`, newest first,
 * filterable by status. Admin-only (§34/§36): these are strangers' names and contact
 * details, and they belong to no Track, so no supervisor scope covers them.
 */
export const metadata: Metadata = {
  title: "التواصل — لوحة التحكم",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const FILTERS: { value: ServiceRequestStatus | "all"; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "new", label: STATUS_LABEL.new },
  { value: "in_progress", label: STATUS_LABEL.in_progress },
  { value: "handled", label: STATUS_LABEL.handled },
  { value: "archived", label: STATUS_LABEL.archived },
];

const dateFmt = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

export default async function IdaraTawasol({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const admin = await requireAdmin();
  const { status } = await searchParams;

  const active = FILTERS.some((f) => f.value === status)
    ? (status as ServiceRequestStatus | "all")
    : "all";
  const requests = await adminServiceRequests(
    db,
    active === "all" ? undefined : { status: active },
  );

  return (
    <>
      <Nav current="/idara" signedIn memberName={admin.name} />
      <main>
        <section className="gutter pt-12 pb-16 md:pb-24">
          <Link
            href="/idara"
            className="text-body-sm mb-10 inline-block font-medium text-[var(--ink-muted)] transition-colors duration-[130ms] ease-[var(--ease-hover)] hover:text-[var(--brand)]"
          >
            <span aria-hidden="true">→</span> لوحة التحكم
          </Link>

          <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.441rem)] leading-[1.42] font-medium text-[var(--ink)]">
            رسائل التواصل
          </h1>
          <p className="text-body-sm mt-4 max-w-xl text-[var(--ink-muted)]">
            الاقتراحات والاستفسارات والملاحظات التي وصلت عبر صفحة التواصل.
          </p>

          <nav className="mt-8 flex flex-wrap gap-2" aria-label="تصفية حسب الحالة">
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={f.value === "all" ? "/idara/tawasol" : `/idara/tawasol?status=${f.value}`}
                aria-current={active === f.value ? "page" : undefined}
                className={`text-caption rounded-full border px-4 py-1.5 font-semibold transition-colors duration-[130ms] ease-[var(--ease-hover)] ${
                  active === f.value
                    ? "border-[var(--brand)] text-[var(--brand)]"
                    : "border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </nav>

          <div className="hairline rule-draw mt-8" />

          {requests.length === 0 ? (
            <p className="text-body-sm mt-10 text-[var(--ink-muted)]">لا رسائل في هذه الحالة.</p>
          ) : (
            <ul className="mt-2 max-w-3xl">
              {requests.map((r) => (
                <RequestRow
                  key={r.id}
                  request={{
                    id: r.id,
                    requestType: r.requestType,
                    name: r.name,
                    email: r.email,
                    phone: r.phone,
                    body: r.body,
                    status: r.status,
                    createdAt: dateFmt.format(r.createdAt),
                    signedIn: r.userId !== null,
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
