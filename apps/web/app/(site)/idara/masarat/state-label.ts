/**
 * The Arabic name of a publish state, shared by every `masarat` surface so a Track
 * and a Task read the same and a new state is retitled in one place. Both entities
 * use the same three states (`content.ts`).
 */
export type PublishState = "draft" | "published" | "archived";

export const STATE_LABEL: Record<PublishState, string> = {
  draft: "مسودة",
  published: "منشور",
  archived: "مؤرشف",
};
