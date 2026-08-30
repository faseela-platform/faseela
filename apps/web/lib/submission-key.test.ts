import { describe, expect, it } from "vitest";

import {
  isOwnSubmissionKey,
  isWithinUploadCap,
  submissionExtension,
  UPLOAD_MAX_BYTES,
} from "./submission-key";

/**
 * `mediaKey` arrives from the browser and is stored as the pointer to a Member's
 * file. Without this guard a Member could submit any object key — another
 * Member's file, or a key outside `submissions/` — and an Editor would open it
 * as theirs. The key must be exactly the shape `submissionMediaKey` mints for
 * this Task and this Member.
 */
const TASK = "11111111-1111-4111-8111-111111111111";
const USER = "m_9f2c1a";
const FILE = "0d4f6b3e-2c1a-4b7e-9a1f-3c5d7e9f1b2d.pdf";

describe("isOwnSubmissionKey", () => {
  it("accepts a key minted for this task and member", () => {
    expect(isOwnSubmissionKey(`submissions/${TASK}/${USER}/${FILE}`, TASK, USER)).toBe(true);
  });

  it("accepts every allowed extension", () => {
    for (const ext of ["jpg", "jpeg", "png", "webp", "heic", "pdf", "docx", "mp4"]) {
      const file = `0d4f6b3e-2c1a-4b7e-9a1f-3c5d7e9f1b2d.${ext}`;
      expect(isOwnSubmissionKey(`submissions/${TASK}/${USER}/${file}`, TASK, USER)).toBe(true);
    }
  });

  it("refuses another member's key", () => {
    expect(isOwnSubmissionKey(`submissions/${TASK}/m_other/${FILE}`, TASK, USER)).toBe(false);
  });

  it("refuses a key for another task", () => {
    const other = "22222222-2222-4222-8222-222222222222";
    expect(isOwnSubmissionKey(`submissions/${other}/${USER}/${FILE}`, TASK, USER)).toBe(false);
  });

  it("refuses a key outside the submissions namespace", () => {
    expect(isOwnSubmissionKey(`content/${TASK}/${USER}/${FILE}`, TASK, USER)).toBe(false);
    expect(isOwnSubmissionKey(`${TASK}/${USER}/${FILE}`, TASK, USER)).toBe(false);
  });

  it("refuses path traversal and extra segments", () => {
    expect(isOwnSubmissionKey(`submissions/${TASK}/${USER}/../${FILE}`, TASK, USER)).toBe(false);
    expect(isOwnSubmissionKey(`submissions/${TASK}/${USER}/x/${FILE}`, TASK, USER)).toBe(false);
    expect(isOwnSubmissionKey(`submissions/${TASK}/${USER}/`, TASK, USER)).toBe(false);
    expect(isOwnSubmissionKey(`submissions/${TASK}/${USER}`, TASK, USER)).toBe(false);
  });

  it("refuses a member or task id that is itself a path segment trick", () => {
    expect(isOwnSubmissionKey(`submissions/../../${FILE}`, "..", "..")).toBe(false);
    expect(isOwnSubmissionKey(`submissions///${FILE}`, "", "")).toBe(false);
  });

  it("refuses an unsafe or missing extension", () => {
    for (const bad of ["a.html", "a.svg", "a.exe", "a.js", "a", "a.pdf.html", "a.PDF"]) {
      const file = bad.replace(/^a/, "0d4f6b3e-2c1a-4b7e-9a1f-3c5d7e9f1b2d");
      expect(isOwnSubmissionKey(`submissions/${TASK}/${USER}/${file}`, TASK, USER)).toBe(false);
    }
  });

  it("refuses a file name that is not the uuid the server minted", () => {
    expect(isOwnSubmissionKey(`submissions/${TASK}/${USER}/report.pdf`, TASK, USER)).toBe(false);
  });
});

/** The extension policy is one list, shared by minting and validation. */
describe("submissionExtension", () => {
  it("returns the lower-cased extension of an allowed file", () => {
    expect(submissionExtension("مقال.PDF")).toBe("pdf");
    expect(submissionExtension("photo.jpeg")).toBe("jpeg");
  });
  it("returns null for a disallowed or missing extension", () => {
    expect(submissionExtension("page.html")).toBeNull();
    expect(submissionExtension("script.svg")).toBeNull();
    expect(submissionExtension("noext")).toBeNull();
    expect(submissionExtension("")).toBeNull();
  });
});

/** 10 MB is the cap; the presigned PUT cannot bind size, so submit checks it. */
describe("isWithinUploadCap", () => {
  it("is 10 MB", () => {
    expect(UPLOAD_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
  it("accepts up to and including the cap and refuses above or unknown", () => {
    expect(isWithinUploadCap(1)).toBe(true);
    expect(isWithinUploadCap(UPLOAD_MAX_BYTES)).toBe(true);
    expect(isWithinUploadCap(UPLOAD_MAX_BYTES + 1)).toBe(false);
    expect(isWithinUploadCap(0)).toBe(false);
    expect(isWithinUploadCap(null)).toBe(false);
    expect(isWithinUploadCap(Number.NaN)).toBe(false);
  });
});
