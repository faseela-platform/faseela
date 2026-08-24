import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

/**
 * Every Better Auth endpoint, mounted at `/api/auth/*`, inside the `(site)` route
 * group alongside the member-facing pages it serves.
 */
export const { GET, POST } = toNextJsHandler(auth);
