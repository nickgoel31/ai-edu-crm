import { describe, it, expect } from "vitest";
import { normalizePhoneNumber, getPhoneSearchVariations } from "@/lib/dedup";

describe("normalizePhoneNumber", () => {
  it("strips spaces, dashes, and parens", () => {
    expect(normalizePhoneNumber("+91 98201-23456")).toBe("+919820123456");
  });

  it("converts a leading 00 international prefix to +", () => {
    expect(normalizePhoneNumber("0091 98201 23456")).toBe("+919820123456");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizePhoneNumber("")).toBe("");
  });

  it("leaves a bare 10-digit local number unchanged", () => {
    expect(normalizePhoneNumber("9820123456")).toBe("9820123456");
  });
});

describe("getPhoneSearchVariations", () => {
  it("generates +91/91/local variations for a 10-digit Indian number", () => {
    const variations = getPhoneSearchVariations("9820123456");
    expect(variations).toContain("9820123456");
    expect(variations).toContain("+919820123456");
    expect(variations).toContain("919820123456");
  });

  it("normalizes a full +91-prefixed number back to the same variation set", () => {
    const a = getPhoneSearchVariations("+91 98201 23456");
    const b = getPhoneSearchVariations("9820123456");
    expect(a).toEqual(expect.arrayContaining(b));
  });

  it("returns an empty array for empty input", () => {
    expect(getPhoneSearchVariations("")).toEqual([]);
  });
});
