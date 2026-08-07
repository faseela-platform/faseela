import type { CollectionConfig } from 'payload';

/**
 * Standing editorial pages — «من نحن», «تواصل معنا» and the like.
 *
 * Deliberately not the landing page. `/` is hand-built (ADR 0011) because its
 * value is in choreography that no field editor can express: a scroll-driven
 * timeline, a three-part hero sequence, hairline rules aligned to a baseline
 * grid. Exposing it as CMS blocks would let an Editor accidentally dismantle the
 * one page built to a Phenomenon-grade brief.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: {
    singular: { ar: 'صفحة', en: 'Page' },
    plural: { ar: 'الصفحات', en: 'Pages' },
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  /**
   * Drafts on, with autosave off. Faseela's editors are volunteers writing in
   * bursts; a draft that is never published is far better than a half-finished
   * paragraph appearing live. Autosave is off because it would write a version
   * row on every keystroke pause, and Neon's free tier has 0.5 GB.
   */
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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: { ar: 'المسار', en: 'Slug' },
      admin: {
        description: {
          ar: 'بالحروف اللاتينية الصغيرة والشرطات، مثل: about-us',
          en: 'Lowercase Latin letters and hyphens, e.g. about-us',
        },
      },
      /**
       * Latin, not Arabic, and this is the one place Arabic is not the default.
       * An Arabic slug percent-encodes to something like `%D9%85%D9%86-%D9%86...`,
       * which is unreadable in a shared link, breaks when copied through chat
       * apps that mangle encoding, and is hostile to analytics. The visible title
       * is Arabic; the URL is a machine identifier.
       */
      validate: (value: unknown) =>
        typeof value === 'string' && /^[a-z0-9-]+$/.test(value)
          ? true
          : 'يجب أن يتكوّن المسار من حروف لاتينية صغيرة وأرقام وشرطات فقط.',
    },
    {
      name: 'summary',
      type: 'textarea',
      label: { ar: 'مقدّمة', en: 'Summary' },
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
      label: { ar: 'النص', en: 'Body' },
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      label: { ar: 'صورة الغلاف', en: 'Cover image' },
    },
  ],
};
