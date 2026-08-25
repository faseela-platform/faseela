import "server-only";

import { headers } from "next/headers";

import type { ApiErr, ApiOk } from "@faseela/api-types";

import { auth } from "@/lib/auth";

/**
 * The session behind an `/api/v1` request, or null. Reads Better Auth's session the
 * same way everywhere — a cookie for the web, an `Authorization: Bearer` token for
 * the mobile client (the `bearer` plugin makes `getSession` accept both). The caller
 * gets only the id and name it needs; the **id is the server's, never the body's**
 * (the invariant the web Server Actions hold — a client cannot act as another user).
 */
export async function apiSessionUser(): Promise<{ id: string; name: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ? { id: session.user.id, name: session.user.name } : null;
}

/** A `{ data }` success envelope as a JSON Response. */
export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data } satisfies ApiOk<T>, init);
}

/** An `{ error: { code, message } }` failure envelope with an HTTP status. */
export function err(code: ApiErr["error"]["code"], message: string, status: number): Response {
  return Response.json({ error: { code, message } } satisfies ApiErr, { status });
}
