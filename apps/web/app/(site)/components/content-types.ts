import type { ContentType } from "@faseela/db";

/**
 * The Arabic name of each content type (§33). Shared vocabulary: it is shown on the
 * public Feed and in the authoring forms alike, so it lives with the shared
 * components rather than under `/idara`. Order is the authoring dropdown order.
 */
export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  announcement: "إعلان",
  event: "فعالية",
  product: "إنتاج",
  news: "خبر",
  cultural: "مادة ثقافية",
  app_update: "تحديث التطبيق",
};

export const CONTENT_TYPES = Object.keys(CONTENT_TYPE_LABEL) as ContentType[];

export type { ContentType };
