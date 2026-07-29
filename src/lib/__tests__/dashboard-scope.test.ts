import { describe, it, expect } from "vitest";
import {
  LAYOUT_SCOPES,
  isValidLayoutScope,
  isSharedLayoutScope,
} from "@/lib/dashboard-layout";

describe("dashboard layout scopes", () => {
  it("defines exact expected layout scopes", () => {
    expect(LAYOUT_SCOPES).toEqual(["user", "role", "default"]);
  });

  it("validates layout scope inputs strictly", () => {
    expect(isValidLayoutScope("user")).toBe(true);
    expect(isValidLayoutScope("role")).toBe(true);
    expect(isValidLayoutScope("default")).toBe(true);

    expect(isValidLayoutScope("global")).toBe(false);
    expect(isValidLayoutScope("USER")).toBe(false);
    expect(isValidLayoutScope("")).toBe(false);
    expect(isValidLayoutScope(null)).toBe(false);
    expect(isValidLayoutScope(undefined)).toBe(false);
  });

  it("identifies shared layout scopes correctly", () => {
    expect(isSharedLayoutScope("user")).toBe(false);
    expect(isSharedLayoutScope("role")).toBe(true);
    expect(isSharedLayoutScope("default")).toBe(true);
  });
});
