import { magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * The browser-side auth client. Safe to import from Client Components — it holds
 * no secret and talks to `/api/auth/*` over fetch.
 *
 * Imported from `better-auth/react` rather than `better-auth/client` so that
 * `useSession` is a real reactive hook: the client keeps session state in a
 * nanostore and re-renders subscribers when it changes. Without that, signing in
 * would update the server's view but leave the header showing a signed-out state
 * until a manual refresh.
 *
 * The client plugin list must mirror the server's for the typed methods to
 * exist. `magicLinkClient()` is what makes `authClient.signIn.magicLink`
 * type-check; omitting it produces a runtime 404 against an endpoint the server
 * does in fact expose.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;
