import type { CollectionConfig } from 'payload';

/**
 * The media library. Slug `media`, which collides with nothing in `@faseela/db`.
 *
 * Sizes are named for the slots that exist in the design rather than by pixel
 * dimensions, because a slot's size can change and a name like `thumbnail_400`
 * then lies. Every size is WebP: the performance floor for this project is a
 * mid-range Android on Lebanese mobile data, where the difference between a
 * 900 KB JPEG and a 120 KB WebP is whether the page arrives.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: { ar: 'ملف', en: 'Media' },
    plural: { ar: 'الوسائط', en: 'Media' },
  },
  access: {
    /** Media is referenced by public pages, so reading it must be public. */
    read: () => true,
  },
  upload: {
    imageSizes: [
      { name: 'card', width: 720, height: undefined, formatOptions: { format: 'webp' } },
      { name: 'feature', width: 1440, height: undefined, formatOptions: { format: 'webp' } },
    ],
    /**
     * Cropping and focal point are left on: Arabic editorial layouts are
     * asymmetric, and a face that reads correctly in a left-aligned Latin crop
     * often lands under text in an RTL one.
     */
    focalPoint: true,
    crop: true,
    mimeTypes: ['image/*', 'application/pdf'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: { ar: 'الوصف البديل', en: 'Alt text' },
      admin: {
        description: {
          ar: 'وصف قصير بالعربية لما تُظهره الصورة، لقارئات الشاشة.',
          en: 'A short Arabic description of what the image shows, for screen readers.',
        },
      },
    },
    {
      name: 'credit',
      type: 'text',
      label: { ar: 'المصدر', en: 'Credit' },
    },
  ],
};
