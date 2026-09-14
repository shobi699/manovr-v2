import { describe, it, expect } from "vitest";
import { generateFullSystemQAReport } from "../qa-report-generator";
import { ALL_AUDIT_MENUS } from "../menu-audit-registry";

describe("QA Report Generator & System Sanity", () => {
  it("should contain exactly 20 audited menus", () => {
    expect(ALL_AUDIT_MENUS.length).toBe(20);
  });

  it("should generate a comprehensive audit report matching schema", async () => {
    const report = await generateFullSystemQAReport();

    expect(report.reportId).toMatch(/^QA-[0-9]{8}-[0-9]{3}$/);
    expect(report.summary.totalMenusAudited).toBe(20);
    expect(report.summary.passedMenus).toBe(20);
    expect(report.summary.systemLightnessRating).toBe("EXCELLENT");
    expect(report.menuDetails.length).toBe(20);
    expect(report.layerDetails.length).toBeGreaterThanOrEqual(5);
    expect(report.finalVerdict).toBe("SYSTEM_APPROVED");
  });

  it("should verify that every menu item has UI, backend, DB, and performance audit records", async () => {
    const report = await generateFullSystemQAReport();

    for (const menu of report.menuDetails) {
      expect(menu.uiAudit.status).toBe("PASS");
      expect(menu.uiAudit.rtlCompliant).toBe(true);
      expect(menu.backendAudit.status).toBe("PASS");
      expect(menu.backendAudit.zodValidationActive).toBe(true);
      expect(menu.dbAudit.status).toBe("PASS");
      expect(menu.performanceAudit.status).toBe("PASS");
      expect(menu.overallStatus).toBe("PASS");
    }
  });
});
