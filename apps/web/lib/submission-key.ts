/**
 * What a Member may claim as their uploaded file (spec §16–§20, §26).
 *
 * Pure, so it can be tested without R2 and imported by both the key minter in
 * `r2.ts` and the Server Actions that accept a `mediaKey` back from the browser.
 * The browser is the one that sends the key, and a key is a pointer an Editor
 * will open: if any string were accepted, a Member could point their submission
 * at another Member's file, or at an object outside `submissions/` altogether.
 *
 * Guarded by submission-key.test.ts.
 */

/**
 * Extensions a submission may carry. What Members actually hand in: a photo of
 * planted trees, a scanned essay, a short clip. Anything a browser would
 * *execute* when the presigned GET renders it — html, svg, js — is excluded on
 * purpose, and so is everything not on the list: the policy is an allow-list.
 */
export const SUBMISSION_EXTENSIONS: readonly string[] = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "gif",
  "pdf",
  "doc",
  "docx",
  "txt",
  "mp3",
  "m4a",
  "mp4",
  "mov",
];

/**
 * The lower-cased extension of `filename` if it is allowed, else null. The
 * whole extension is matched — `a.pdf.html` is html, not pdf.
 */
export function submissionExtension(filename: string): string | null {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(filename);
  if (!match) return null;
  const ext = match[1]!.toLowerCase();
  return SUBMISSION_EXTENSIONS.includes(ext) ? ext : null;
}

/** The `{uuid}.{ext}` file segment `submissionMediaKey` mints — nothing else. */
const FILE_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.([a-z0-9]{1,8})$/;

function isPlainSegment(segment: string): boolean {
  return segment !== "" && segment !== "." && segment !== ".." && !segment.includes("/");
}

/**
 * True only for `submissions/{taskId}/{userId}/{uuid}.{ext}` with *this* task,
 * *this* member, and an allowed extension. Exactly four segments: a fifth (or
 * a `..`) is a path the server never minted.
 */
export function isOwnSubmissionKey(key: string, taskId: string, userId: string): boolean {
  if (!isPlainSegment(taskId) || !isPlainSegment(userId)) return false;
  const parts = key.split("/");
  if (parts.length !== 4) return false;
  const [root, task, user, file] = parts as [string, string, string, string];
  if (root !== "submissions" || task !== taskId || user !== userId) return false;
  const match = FILE_SEGMENT.exec(file);
  if (!match) return false;
  return SUBMISSION_EXTENSIONS.includes(match[1]!);
}

/**
 * Ten megabytes. The presigned PUT cannot bind a size (see `r2.ts`), so the
 * bound is enforced when the Member submits: the object is HEADed and refused
 * above this. Large enough for a phone photo or a scanned essay, small enough
 * that the bucket cannot be used as free storage.
 */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** Whether a reported object size is acceptable. Unknown or empty is not. */
export function isWithinUploadCap(bytes: number | null): boolean {
  if (bytes === null || !Number.isFinite(bytes)) return false;
  return bytes > 0 && bytes <= UPLOAD_MAX_BYTES;
}
