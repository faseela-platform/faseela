import { createClient } from "@faseela/db";

/**
 * One database client for the whole app process.
 *
 * A module-level singleton rather than a client per request. `createClient`
 * opens a `pg.Pool` capped at 5 connections, and Neon's free tier caps
 * connections globally — a client constructed inside a page would open a new
 * pool on every render, exhaust the cap under trivial load, and fail in a way
 * that looks like a Neon outage rather than our bug.
 *
 * Next.js's dev server re-evaluates modules on every hot reload, so the instance
 * is cached on `globalThis` to survive that. Without this, an afternoon of edits
 * leaks a pool per reload until Neon refuses new connections.
 */
const globalForDb = globalThis as unknown as {
  faseelaDb?: ReturnType<typeof createClient>;
};

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    /**
     * Thrown, not defaulted. A missing connection string in production must stop
     * the request loudly — falling back to a local URL would make a
     * misconfigured deploy serve an empty site that looks like a content
     * problem.
     */
    throw new Error("DATABASE_URL is not set");
  }
  return createClient(url);
}

export const db = globalForDb.faseelaDb ?? connect();

if (process.env.NODE_ENV !== "production") {
  globalForDb.faseelaDb = db;
}
