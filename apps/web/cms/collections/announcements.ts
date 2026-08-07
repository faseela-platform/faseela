import type { CollectionConfig } from 'payload';

/**
 * Announcements — the dated stream Faseela publishes to Members.
 *
 * This is what remains of the Feed after channel ingestion was withdrawn (ADR
 * 0013). Nothing is aggregated from Instagram or elsewhere; every item here was
 * written by a person in this admin panel. That is a smaller product than the
 * original plan and an honest one: five deliberate announcements a month beats a
 * scraper that breaks silently.
 */
export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: {
    singular: { ar: 'إعلان', en: 'Announcement' },
    plural: { ar: 'الإعلانات', en: 'Announcements' },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt', '_status'],
  },
  /**
   * Newest first, matching how the stream is read. A collection-level option,
   * not an admin one — it governs the API's default order too, so the site and
   * the admin list agree without either restating it.
   */
  defaultSort: '-publishedAt',
  access: {
    read: () => true,
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: { ar: 'العنوان', en: 'Title' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      label: { ar: 'تاريخ النشر', en: 'Published at' },
      admin: {
        /**
         * Editable rather than derived from the publish action, because an
         * announcement often describes an event on a date other than the day
         * someone got round to writing it up.
         */
        date: { pickerAppearance: 'dayAndTime' },
        position: 'sidebar',
      },
      defaultValue: () => new Date().toISOString(),
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
      label: { ar: 'النص', en: 'Body' },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: { ar: 'صورة', en: 'Image' },
    },
    {
      /**
       * A URL rather than a relationship to `track`. Tracks live in
       * `@faseela/db`, and a Payload relationship would require Payload to own
       * that table — the exact coupling ADR 0014 forbids. A slug the announcement
       * points at costs one broken-link risk and buys total independence.
       */
      name: 'trackSlug',
      type: 'text',
      label: { ar: 'مسار مرتبط', en: 'Related track (slug)' },
      admin: {
        position: 'sidebar',
        description: {
          ar: 'مسار المسار المرتبط، إن وُجد. مثال: qiraa-2026',
          en: 'Slug of a related Track, if any. Example: qiraa-2026',
        },
      },
    },
  ],
};
