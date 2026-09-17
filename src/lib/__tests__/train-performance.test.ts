import { describe, it, expect } from "vitest";
import {
  calculateDateRange,
  categorizeManovrType,
} from "@/app/actions/train-performance";
import {
  recordDiagnosticLog,
  generateDiagnosticReportForAdmin,
  getDiagnosticLogFileContent,
} from "@/lib/logger";

describe("Train Performance Business Logic Tests", () => {
  describe("categorizeManovrType", () => {
    it("should correctly categorize permanent transfer types", () => {
      expect(categorizeManovrType(21)).toBe("permanent");
      expect(categorizeManovrType(22)).toBe("permanent");
      expect(categorizeManovrType(23)).toBe("permanent");
      expect(categorizeManovrType(24)).toBe("permanent");
    });

    it("should correctly categorize line exit types", () => {
      expect(categorizeManovrType(16)).toBe("exit");
      expect(categorizeManovrType(17)).toBe("exit");
      expect(categorizeManovrType(18)).toBe("exit");
    });

    it("should correctly categorize line change types", () => {
      expect(categorizeManovrType(2)).toBe("lineChange");
      expect(categorizeManovrType(10)).toBe("lineChange");
      expect(categorizeManovrType(19)).toBe("lineChange");
    });

    it("should categorize other standard types as normal", () => {
      expect(categorizeManovrType(1)).toBe("normal"); // دیزل
      expect(categorizeManovrType(3)).toBe("normal"); // تارواش
      expect(categorizeManovrType(4)).toBe("normal"); // استاتیک
      expect(categorizeManovrType(5)).toBe("normal"); // تست خط
      expect(categorizeManovrType(11)).toBe("normal"); // بادگیری
    });
  });

  describe("calculateDateRange", () => {
    it("should return null bounds for 'all' preset", () => {
      const { start, end } = calculateDateRange("all");
      expect(start).toBeNull();
      expect(end).toBeNull();
    });

    it("should return start and end for 'today' preset", () => {
      const { start, end } = calculateDateRange("today");
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(start!.getTime()).toBeLessThan(end!.getTime());
      expect(start!.getHours()).toBe(0);
      expect(end!.getHours()).toBe(23);
    });

    it("should return correct bounds for 'week' preset starting from Saturday", () => {
      const { start, end } = calculateDateRange("week");
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(start!.getTime()).toBeLessThanOrEqual(end!.getTime());
    });

    it("should return custom date bounds when custom preset is selected", () => {
      const { start, end } = calculateDateRange("custom", "2026-09-01", "2026-09-10");
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(start!.toISOString()).toContain("2026-09-01");
      expect(end!.getHours()).toBe(23);
      expect(end!.getMinutes()).toBe(59);
    });
  });

  describe("Diagnostic Logging Engine Tests", () => {
    it("should record log entries and keep in memory", () => {
      const entry = recordDiagnosticLog(
        "INFO",
        "SYSTEM",
        "آزمون ثبت لاگ عملکرد ناوگان",
        "تست سیستمی"
      );
      expect(entry).toBeDefined();
      expect(entry.id).toContain("log_");
      expect(entry.level).toBe("INFO");
      expect(entry.category).toBe("SYSTEM");
      expect(entry.message).toBe("آزمون ثبت لاگ عملکرد ناوگان");
      expect(entry.timestampJalali).toBeDefined();
    });

    it("should generate admin markdown report with hostname and entries", async () => {
      recordDiagnosticLog("ERROR", "DATABASE", "خطای تستی قفل پایگاه داده", "شبیه‌سازی");
      const report = await generateDiagnosticReportForAdmin();
      expect(report).toContain("گزارش جامع عیب‌یابی و وضعیت سامانه مانور دپو");
      expect(report).toContain("خلاصه وضعیت خطاها");
      expect(report).toContain("خطای تستی قفل پایگاه داده");
    });

    it("should return downloadable log file content with filename", async () => {
      const { content, filename } = await getDiagnosticLogFileContent();
      expect(content).toBeDefined();
      expect(filename).toContain(".log");
    });
  });
});
