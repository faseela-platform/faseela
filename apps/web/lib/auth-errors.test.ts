import { describe, expect, it } from "vitest";

import { signInErrorMessage } from "./auth-errors";

/**
 * Better Auth bounces a failed magic-link verification to `errorCallbackURL`
 * with `?error=<CODE>`. The code is English and internal; the Member reads
 * Arabic. This is the one place that translation happens, so /dukhul never
 * shows a raw code and never shows nothing.
 */
describe("signInErrorMessage", () => {
  it("explains a used or invalid link and asks for a new one", () => {
    expect(signInErrorMessage("INVALID_TOKEN")).toBe(
      "انتهت صلاحية الرابط أو استُخدم من قبل. اطلب رابطاً جديداً.",
    );
  });
  it("explains an expired link and asks for a new one", () => {
    expect(signInErrorMessage("EXPIRED_TOKEN")).toBe("انتهت صلاحية الرابط. اطلب رابطاً جديداً.");
  });
  it("gives a generic Arabic sentence for a code it does not know", () => {
    expect(signInErrorMessage("SOMETHING_ELSE")).toBe(
      "تعذّر تسجيل الدخول بهذا الرابط. اطلب رابطاً جديداً.",
    );
  });
  it("is case-insensitive about the code", () => {
    expect(signInErrorMessage("invalid_token")).toBe(signInErrorMessage("INVALID_TOKEN"));
  });
  it("returns null when there is no error, so the page shows no notice", () => {
    expect(signInErrorMessage(undefined)).toBeNull();
    expect(signInErrorMessage("")).toBeNull();
  });
});
