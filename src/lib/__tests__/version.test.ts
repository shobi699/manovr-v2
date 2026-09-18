import { describe, it, expect } from "vitest";
import {
  APP_CURRENT_VERSION,
  APP_BUILD_DATE_JALALI,
  APP_RELEASES,
} from "@/lib/version";

describe("Application Version & Release History Integrity", () => {
  it("has valid semver format for current version", () => {
    expect(APP_CURRENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(APP_CURRENT_VERSION).toBe("0.1.3");
  });

  it("contains Jalali build date", () => {
    expect(APP_BUILD_DATE_JALALI).toContain("شهریور");
    expect(APP_BUILD_DATE_JALALI).toContain("۱۴۰۵");
  });

  it("contains chronological releases including current version", () => {
    expect(APP_RELEASES.length).toBeGreaterThanOrEqual(4);

    const currentRelease = APP_RELEASES.find((r) => r.version === APP_CURRENT_VERSION);
    expect(currentRelease).toBeDefined();
    expect(currentRelease?.badge).toBe("نسخه جاری");
    expect(currentRelease?.highlights.length).toBeGreaterThanOrEqual(2);
  });

  it("each release contains version, jalali date, title and concise highlights", () => {
    APP_RELEASES.forEach((rel) => {
      expect(rel.version).toBeTruthy();
      expect(rel.dateJalali).toBeTruthy();
      expect(rel.title).toBeTruthy();
      expect(rel.highlights.length).toBeGreaterThanOrEqual(1);
      // توضیحات در حد یک الی دو خط مختصر و مفید
      rel.highlights.forEach((h) => {
        expect(h.length).toBeGreaterThan(20);
      });
    });
  });
});
