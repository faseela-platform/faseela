import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { ar } from '@payloadcms/translations/languages/ar';
import { en } from '@payloadcms/translations/languages/en';
import { buildConfig } from 'payload';
import sharp from 'sharp';

import { Announcements } from './cms/collections/announcements';
import { Editors } from './cms/collections/editors';
import { Media } from './cms/collections/media';
import { Pages } from './cms/collections/pages';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Payload owns editorial content. It does not own Members, Tracks, Tasks,
 * Submissions, Seasons or the Point ledger — those belong to `@faseela/db` and
 * carry invariants Payload has no way to honour (ADR 0014).
 *
 * The two share one Neon database, which is only safe because of `schemaName`
 * below. Payload's own documentation states plainly that "by default, Payload
 * drops the current database schema" — with the default `public`, a Payload
 * migration is capable of dropping all nine of our tables.
 */
export default buildConfig({
  admin: {
    user: Editors.slug,
    meta: {
      titleSuffix: ' — لوحة فسيلة',
    },
  },

  /**
   * Arabic is the default and English is kept as a fallback.
   *
   * Not for the Editors' comfort but for their correctness: Payload's admin sets
   * `dir` from the active locale, so choosing `ar` is what makes the field
   * editors themselves RTL. An Editor typing an Arabic Task title into an LTR
   * input sees punctuation jump to the wrong end of the line and will "fix" it
   * with characters that then ship to Members.
   *
   * English stays available because some contributors may not read Arabic UI
   * chrome, and losing an Editor is worse than a mixed-language admin.
   */
  i18n: {
    supportedLanguages: { ar, en },
    fallbackLanguage: 'ar',
  },

  collections: [Editors, Pages, Announcements, Media],

  editor: lexicalEditor(),

  secret: process.env.PAYLOAD_SECRET || '',

  typescript: {
    outputFile: path.resolve(dirname, 'cms/payload-types.ts'),
  },

  db: postgresAdapter({
    /**
     * The load-bearing line in this file. Payload gets its own Postgres schema,
     * so its migrations operate in a namespace that physically cannot contain
     * `user`, `point_award` or any other table of ours.
     *
     * Marked experimental by Payload. The exposure if it misbehaves is that
     * Payload creates tables in `public` instead — which is why collection slugs
     * below still avoid every one of our table names. Two independent defences,
     * because the consequence of one failing is losing the ledger.
     */
    schemaName: 'payload',

    /**
     * Payload enables Drizzle's `db push` in development by default. ADR 0014
     * bans push outright: it diffs a schema and applies the difference without
     * producing a file, so there is nothing to review, nothing to replay on
     * another environment, and no record of what changed. Migrations only.
     */
    push: false,

    migrationDir: path.resolve(dirname, 'cms/migrations'),

    /**
     * The unpooled host, deliberately. Payload runs DDL, and DDL needs session
     * state — advisory locks and a stable connection across statements — which
     * PgBouncer in transaction mode cannot provide. Pointing this at the pooler
     * produces failures that look like intermittent network flakes.
     */
    pool: {
      connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    },
  }),

  sharp,
});
