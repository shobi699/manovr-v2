import { describe, it, expect } from "vitest";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user.schema";

describe("Part-Time Driver Validation & Business Logic (US1)", () => {
  it("defaults isPartTimeDriver to false when omitted in createUserSchema", () => {
    const result = createUserSchema.safeParse({
      firstName: "علی",
      lastName: "محمدی",
      orgPosition: "2", // مسئول
      shift: "1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPartTimeDriver).toBe(false);
    }
  });

  it("parses isPartTimeDriver as true when provided as boolean or 'on'/'true'", () => {
    const resultBool = createUserSchema.safeParse({
      firstName: "رضا",
      lastName: "حسینی",
      orgPosition: "5", // تکنسین
      shift: "2",
      isPartTimeDriver: true,
    });

    expect(resultBool.success).toBe(true);
    if (resultBool.success) {
      expect(resultBool.data.isPartTimeDriver).toBe(true);
    }

    const resultFormOn = createUserSchema.safeParse({
      firstName: "رضا",
      lastName: "حسینی",
      orgPosition: "5",
      shift: "2",
      isPartTimeDriver: "on", // HTML checkbox default value
    });

    expect(resultFormOn.success).toBe(true);
    if (resultFormOn.success) {
      expect(resultFormOn.data.isPartTimeDriver).toBe(true);
    }
  });

  it("accepts isPartTimeDriver in updateUserSchema", () => {
    const result = updateUserSchema.safeParse({
      id: 42,
      firstName: "مهدی",
      lastName: "کریمی",
      orgPosition: 4, // سایر
      shift: 3,
      isPartTimeDriver: "true",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPartTimeDriver).toBe(true);
    }
  });

  it("handles empty or false isPartTimeDriver in updateUserSchema", () => {
    const result = updateUserSchema.safeParse({
      id: 42,
      firstName: "مهدی",
      lastName: "کریمی",
      orgPosition: 4,
      shift: 3,
      isPartTimeDriver: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPartTimeDriver).toBe(false);
    }
  });
});
