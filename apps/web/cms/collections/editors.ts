import type { CollectionConfig } from 'payload';

/**
 * Who may sign into the admin panel.
 *
 * Slug is `editors`, not `users` — and that is not a stylistic choice. Payload
 * supplies a default `users` collection when none is given, and a collection
 * slugged `users` would map to a `users` table. `@faseela/db` already owns a
 * singular `user` table for Members via Better Auth. Even with `schemaName`
 * isolating Payload, the names are kept apart so that a failure of that
 * isolation is survivable rather than catastrophic (ADR 0014).
 *
 * Editors and Members are also genuinely different populations: an Editor is
 * Faseela staff with a password, a Member is a young person with a magic link
 * and a Point balance. Conflating them would mean every Member row carries admin
 * access fields, and every permission check has to remember to exclude them.
 */
export const Editors: CollectionConfig = {
  slug: 'editors',
  labels: {
    singular: { ar: 'محرِّر', en: 'Editor' },
    plural: { ar: 'المحرِّرون', en: 'Editors' },
  },
  auth: true,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
  },
  access: {
    /**
     * Only an administrator may create or delete an Editor. Without this, the
     * first editor could invite anyone, and Payload's default for an auth
     * collection is more permissive than a content team needs.
     */
    create: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
    update: ({ req, id }) =>
      req.user?.role === 'admin' || req.user?.id === id,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { ar: 'الاسم', en: 'Name' },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      label: { ar: 'الصلاحية', en: 'Role' },
      options: [
        { label: { ar: 'مدير', en: 'Administrator' }, value: 'admin' },
        { label: { ar: 'محرِّر', en: 'Editor' }, value: 'editor' },
      ],
      access: {
        /** An Editor must not be able to promote themselves. */
        update: ({ req }) => req.user?.role === 'admin',
      },
    },
  ],
};
