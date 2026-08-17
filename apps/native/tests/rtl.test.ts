import { describe, expect, it } from "vitest";

import { arabicDigits, row } from "../lib/rtl";

/**
 * When the OS has applied RTL (`I18nManager.isRTL === true`), React Native
 * already lays `row` out right-to-left — reversing it would undo the fix. The
 * reversal is only for the window where RTL has NOT been applied (first Expo Go
 * load before the manifest keys take effect).
 */
describe("row", () => {
  it("keeps plain row when RTL is already applied", () => {
    expect(row(true)).toEqual({ flexDirection: "row" });
  });

  it("reverses the row when RTL is not applied", () => {
    expect(row(false)).toEqual({ flexDirection: "row-reverse" });
  });
});

/** Arabic-Indic digits via ar-EG — the numerals a Faseela reader expects. */
describe("arabicDigits", () => {
  it("formats zero", () => {
    expect(arabicDigits(0)).toBe("٠");
  });

  it("formats a single digit", () => {
    expect(arabicDigits(5)).toBe("٥");
  });

  it("formats a multi-digit number", () => {
    expect(arabicDigits(120)).toBe("١٢٠");
  });

  it("groups thousands with the Arabic separator", () => {
    expect(arabicDigits(1234)).toBe("١٬٢٣٤");
  });
});
