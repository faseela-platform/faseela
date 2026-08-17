import type { ApiErr } from "@faseela/api-types";

/**
 * Seals the `/api/v1` namespace.
 *
 * Payload owns `/api/[...slug]`, so without this file an unknown path like
 * `/api/v1/junk` would fall through to Payload's catch-all and answer with
 * whatever Payload says — a CMS response leaking out of the mobile API's
 * namespace. `v1` is a static segment and beats `[...slug]` in Next's route
 * precedence (the same documented rule `/api/auth/*` relies on), so everything
 * under `/api/v1/*` resolves here or to a more specific `v1` route, never to
 * Payload.
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
