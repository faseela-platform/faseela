import type { ApiErr } from "@faseela/api-types";

/**
 * Seals the `/api/v1` namespace.
 *
 * Without this catch-all an unknown path like `/api/v1/junk` would fall through
 * to Next's default handler and answer with an HTML 404 — a response a mobile
 * client parsing JSON cannot read. This guarantees every path under `/api/v1/*`
 * resolves to a `v1` route or to this route's JSON error envelope, so the mobile
 * API only ever speaks the one shape the Expo app expects.
 *
 * Every method, not just GET: the API is read-only, so a POST to a real
 * endpoint is exactly as unknown as a GET to a misspelled one, and both get
 * the same JSON 404 envelope a mobile client already knows how to read.
 */
function notFound() {
  const body = {
    error: { code: "not_found", message: "No such endpoint." },
  } satisfies ApiErr;
  return Response.json(body, { status: 404 });
}

export {
  notFound as GET,
  notFound as POST,
  notFound as PUT,
  notFound as DELETE,
  notFound as PATCH,
};
