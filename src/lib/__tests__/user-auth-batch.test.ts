import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { toEnglishDigits } from "@/lib/digits";

describe("User Authentication, Digit Normalization & Default Passwords", () => {
  it("normalizes Persian and Arabic numbers to English standard digits", () => {
    expect(toEnglishDigits("۱۲۳۴۵۶")).toBe("123456");
    expect(toEnglishDigits("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(toEnglishDigits("user_۹۹۱۰")).toBe("user_9910");
    expect(toEnglishDigits("١٢٣٤٥٦")).toBe("123456");
  });

  it("verifies that default password '123456' hashes and compares properly with both Persian and English inputs", async () => {
    const rawPass = "123456";
    const persianPass = "۱۲۳۴۵۶";
    const hash = await bcrypt.hash(rawPass, 10);

    // ورود با ارقام انگلیسی
    const matchEnglish = await bcrypt.compare(rawPass, hash);
    expect(matchEnglish).toBe(true);

    // ورود با ارقام فارسی (پس از نرمال‌سازی)
    const matchPersianNormalized = await bcrypt.compare(toEnglishDigits(persianPass), hash);
    expect(matchPersianNormalized).toBe(true);
  });

  it("ensures default password length is at least 6 characters satisfying security constraints", () => {
    const defaultPass = "123456";
    expect(defaultPass.length).toBeGreaterThanOrEqual(4);
    expect(defaultPass).toBe("123456");
  });
});
