import { NextResponse } from 'next/server';

/**
 * Keeps the Payload admin panel unreachable in production until it is deliberately
 * opened.
 *
 * The problem this solves is a race, not a permission. Payload has no first user
 * until somebody creates one, and it offers a create-first-user screen to whoever
 * arrives first. On a public deployment that means the first visitor to find
 * `/admin` becomes the administrator of Faseela's CMS — able to publish, unpublish
 * and rewrite everything the initiative says in its own name. Nothing about the URL
 * is secret: it is the Payload default, and deployment platforms list routes.
 *
 * Winning the race by claiming the account quickly was the alternative. This removes
 * it instead, which is the difference between being careful and being safe.
 *
 * Opened by setting `ENABLE_ADMIN=true` in the deployment's environment, at which
 * point the first-user screen is reachable for as long as that value stays set.
 */

/**
 * Gated in production only. Locally `NODE_ENV` is `development` and the panel is
 * always available, because a gate that also blocks development gets disabled during
 * development and then forgotten — which is how a protection ends up shipped off.
 *
 * The value is trimmed because it arrives from whatever set it, and a trailing space is
 * invisible in a dashboard field. During verification `set ENABLE_ADMIN=true &&` on
 * Windows produced `"true "`, which failed a strict comparison and looked exactly
 * like a broken gate. The failure mode is benign here — the panel stays shut — but the
 * hour lost diagnosing it would not be, and on the day Abdullah opens the panel he
 * should not have to suspect his own typing.
 */
const gated =
  process.env.NODE_ENV === 'production' && process.env.ENABLE_ADMIN?.trim() !== 'true';

/**
 * Takes no request, deliberately. The gate applies to every path the matcher selects,
 * with no per-request exceptions — an allowance based on IP, header or cookie would be a
 * thing an attacker can forge, whereas a closed door is not.
 */
export function middleware() {
  if (!gated) return NextResponse.next();

  /**
   * 404 rather than 403.
   *
   * A 403 confirms that an admin panel exists at this path and is merely closed,
   * which tells an unauthenticated visitor exactly what to return for. A 404 is
   * indistinguishable from a route that was never built. Payload's own `not-found`
   * page is not used here: rendering it would boot Payload, which means connecting
   * to the database on behalf of a request we have already decided to refuse.
   */
  return new NextResponse(null, { status: 404 });
}

export const config = {
  /**
   * Both the panel and the API, because `/admin` alone would be a gate on the door
   * of an unlocked building. Payload's REST API can create the first user directly —
   * the admin screen is a client of that endpoint, not a guard in front of it — so
   * blocking only the UI leaves the actual vulnerability reachable by curl.
   *
   * The negative lookahead exempts `/api/auth/*`, which is Better Auth. Members
   * signing in is the opposite of the thing being restricted, and matching it would
   * 404 every sign-in request in production. Written as a pattern rather than an
   * early return in the handler so the middleware is never invoked for auth traffic
   * at all, which keeps sign-in off the critical path of this file entirely.
   */
  matcher: ['/admin', '/admin/:path*', '/api/((?!auth).*)'],
};
