import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth';

/**
 * Every Better Auth endpoint, mounted at `/api/auth/*`.
 *
 * This lives inside the `(site)` route group, which puts it in the same app as
 * the member-facing pages while Payload's own catch-all sits at
 * `/api/[...slug]` inside `(payload)`. Two catch-alls under `/api` coexist
 * because Next.js resolves the more specific segment first: `auth` is a static
 * segment and beats `[...slug]`. That ordering is a documented routing rule, not
 * an accident of file order, but it is asserted in `scripts/verify-routes.mjs`
 * anyway — if a Payload upgrade ever widened its route, sign-in would break in a
 * way that looks like an auth bug rather than a routing collision.
 */
export const { GET, POST } = toNextJsHandler(auth);
