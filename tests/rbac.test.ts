import { describe, it, expect } from "vitest";
import { canAccessModule, moduleForPath, parseModuleAccess } from "@/lib/rbac";

describe("canAccessModule", () => {
  it("ADMIN always has access, regardless of moduleAccess", () => {
    expect(canAccessModule("ADMIN", "leads", { leads: false })).toBe(true);
    expect(canAccessModule("ADMIN", "settings")).toBe(true);
  });

  it("COUNSELOR has default access to a module with no override", () => {
    expect(canAccessModule("COUNSELOR", "leads", {})).toBe(true);
    expect(canAccessModule("COUNSELOR", "leads", null)).toBe(true);
  });

  it("COUNSELOR is blocked from a module explicitly set to false", () => {
    expect(canAccessModule("COUNSELOR", "reports", { reports: false })).toBe(false);
  });

  it("an unrelated module override doesn't affect other modules", () => {
    expect(canAccessModule("COUNSELOR", "leads", { reports: false })).toBe(true);
  });

  it("no role (unauthenticated) is always denied", () => {
    expect(canAccessModule(null, "leads")).toBe(false);
  });

  it("COUNSELOR/READONLY never gets Settings", () => {
    expect(canAccessModule("COUNSELOR", "settings")).toBe(false);
    expect(canAccessModule("READONLY", "settings")).toBe(false);
  });
});

describe("moduleForPath", () => {
  it("maps known module paths", () => {
    expect(moduleForPath("/leads")).toBe("leads");
    expect(moduleForPath("/leads/abc123")).toBe("leads");
    expect(moduleForPath("/students")).toBe("students");
  });

  it("returns null for paths with no module (e.g. settings, home)", () => {
    expect(moduleForPath("/settings")).toBe(null);
    expect(moduleForPath("/")).toBe(null);
  });
});

describe("parseModuleAccess", () => {
  it("parses a JSON string", () => {
    expect(parseModuleAccess('{"leads":false}')).toEqual({ leads: false });
  });

  it("passes through an already-parsed object", () => {
    expect(parseModuleAccess({ leads: false })).toEqual({ leads: false });
  });

  it("returns {} for null/invalid input", () => {
    expect(parseModuleAccess(null)).toEqual({});
    expect(parseModuleAccess("not json")).toEqual({});
  });
});
