import "server-only";

import { AwsClient } from "aws4fetch";

/**
 * Private object storage for what Members submit (spec §16–§20): the file that
 * accompanies a `review` Task's answer.
 *
 * Cloudflare R2, addressed through its S3-compatible API. Two things make this the
 * shape it is:
 *
 * 1. **Objects are private.** The bucket is never public; a file is reached only
 *    through a short-lived *presigned* URL this module mints. A Member's essay or
 *    photo is theirs and the reviewing Editor's, not the open web's.
 * 2. **The browser talks to R2 directly.** Uploads use a presigned PUT so the file
 *    never passes through our server — a Server Action mints the URL, the browser
 *    PUTs to it. That keeps large files off the serverless request path, which has
 *    a body-size ceiling this would otherwise hit.
 *
 * The keys and endpoint come from the environment. When they are absent — a local
 * checkout without R2 configured — `r2IsConfigured` is false and the submission UI
 * falls back to text only, exactly as `emailIsDeliverable` gates sign-in. File
 * upload is additive; a Member can always submit an answer without one.
 */

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

/**
 * Whether R2 is wired up. Read by the submission UI to decide whether to offer a
 * file field — false on a checkout that has not set the four R2 variables, so the
 * feature degrades to text rather than throwing.
 */
export const r2IsConfigured = Boolean(accountId && accessKeyId && secretAccessKey && bucket);

/** R2's S3 endpoint for this account. Path-style: `{endpoint}/{bucket}/{key}`. */
function endpoint(): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function client(): AwsClient {
  if (!r2IsConfigured) {
    throw new Error(
      "R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET",
    );
  }
  /** `region: "auto"` is R2's own value; the SigV4 signature still needs one. */
  return new AwsClient({
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    service: "s3",
    region: "auto",
  });
}

/** The URL of an object, before signing. Each key segment is encoded so an id
 * with reserved characters cannot break out of its path. */
function objectUrl(key: string): string {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `${endpoint()}/${bucket}/${path}`;
}

/**
 * The object key for one submission attempt's file.
 *
 * `submissions/{taskId}/{userId}/{uuid}.{ext}` — namespaced by Task and Member so
 * an Editor browsing storage can find a person's work, and carrying a fresh random
 * id per call so a resubmission after a return never overwrites the file the
 * previous attempt was judged on (§26). The extension is sanitised to a short
 * alphanumeric run; the id, not the name, is what makes the key unique.
 */
export function submissionMediaKey(taskId: string, userId: string, filename: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(filename);
  const ext = match ? `.${match[1]!.toLowerCase()}` : "";
  return `submissions/${taskId}/${userId}/${crypto.randomUUID()}${ext}`;
}

/**
 * The object key for a content piece's image/poster (§3 Feed media).
 *
 * `content/{contentId}/{uuid}.{ext}` — namespaced by the content id, with a fresh
 * random id per upload so replacing an image never overwrites the old object mid-use.
 * Unlike a submission, content media is authored by staff and shown on the public
 * Feed; it still lives in the same private bucket and is served through a presigned
 * GET (the home is `force-dynamic`, so a per-request short-lived URL is fine).
 */
export function contentMediaKey(contentId: string, filename: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(filename);
  const ext = match ? `.${match[1]!.toLowerCase()}` : "";
  return `content/${contentId}/${crypto.randomUUID()}${ext}`;
}

/**
 * Sign an object URL as a presigned query for one method, valid for `expiresIn`
 * seconds. Content-type is deliberately never bound into the signature: it would
 * force the client to send a byte-exact match, a common source of opaque 403s, for
 * no security we need on a key we already control.
 */
async function presign(key: string, method: "PUT" | "GET", expiresIn: number): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  const signed = await client().sign(url, { method, aws: { signQuery: true } });
  return signed.url;
}

/**
 * A presigned URL the browser can PUT a file to, valid for `expiresIn` seconds
 * (five minutes by default — long enough to upload, short enough that a leaked URL
 * is stale almost at once).
 */
export function presignPutUrl(key: string, expiresIn = 300): Promise<string> {
  return presign(key, "PUT", expiresIn);
}

/**
 * A presigned URL for reading an object — how an Editor views a Member's file
 * without the bucket being public. Short-lived by default for the same reason: the
 * link is minted when the review screen loads and is not meant to outlive it.
 */
export function presignGetUrl(key: string, expiresIn = 300): Promise<string> {
  return presign(key, "GET", expiresIn);
}
