import { describe, it, expect } from "vitest";
import { Icons } from "@/lib/icons";
import { MENU_GUIDES, MenuGuideItem } from "@/lib/help-menu-guides";
import { persianSearchMatch } from "@/lib/persian-text";

describe("Help & Documentation System — Comprehensive Menu Guides Verification", () => {
  it("exports Help icon from Phosphor icons registry", () => {
    expect(Icons.Help).toBeDefined();
  });

  it("contains comprehensive documentation for all 21 system menus", () => {
    expect(MENU_GUIDES).toBeDefined();
    expect(MENU_GUIDES.length).toBe(21);
  });

  it("strictly enforces that every single menu guide has at least 1,000 characters of detailed documentation", () => {
    for (const guide of MENU_GUIDES) {
      expect(
        guide.fullGuideText.length,
        `Menu ${guide.id} (${guide.title} - ${guide.route}) has ${guide.fullGuideText.length} characters, which is less than the required 1000 characters`
      ).toBeGreaterThanOrEqual(1000);
    }
  });

  it("ensures all 21 menus have unique IDs and unique routes", () => {
    const ids = new Set<string>();
    const routes = new Set<string>();

    for (const guide of MENU_GUIDES) {
      expect(ids.has(guide.id), `Duplicate ID found: ${guide.id}`).toBe(false);
      ids.add(guide.id);

      expect(routes.has(guide.route), `Duplicate Route found: ${guide.route}`).toBe(false);
      routes.add(guide.route);
    }

    expect(ids.size).toBe(21);
    expect(routes.size).toBe(21);
  });

  it("ensures all required structured fields are populated for every menu", () => {
    for (const guide of MENU_GUIDES) {
      expect(guide.title.trim().length).toBeGreaterThan(5);
      expect(guide.route.startsWith("/")).toBe(true);
      expect(["operations", "base-info", "analysis"]).toContain(guide.category);
      expect(["عملیات پایانه", "اطلاعات پایه", "تحلیل و تنظیمات"]).toContain(guide.categoryTitle);
      expect(guide.summary.trim().length).toBeGreaterThan(20);
      expect(guide.sections.length).toBeGreaterThanOrEqual(2);
      expect(guide.workflows.length).toBeGreaterThanOrEqual(3);
      expect(guide.tips.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("correctly partitions menus into standard categories", () => {
    const terminalOps = MENU_GUIDES.filter((g) => g.category === "operations" || g.categoryTitle === "عملیات پایانه");
    const baseInfo = MENU_GUIDES.filter((g) => g.category === "base-info" || g.categoryTitle === "اطلاعات پایه");
    const adminAnalysis = MENU_GUIDES.filter((g) => g.category === "analysis" || g.categoryTitle === "تحلیل و تنظیمات");

    expect(terminalOps.length).toBe(5);
    expect(baseInfo.length).toBe(5);
    expect(adminAnalysis.length).toBe(11);
  });

  it("verifies Persian search matching on menu guides", () => {
    const depotGuide = MENU_GUIDES.find((g) => g.route === "/depot");
    expect(depotGuide).toBeDefined();
    if (depotGuide) {
      expect(persianSearchMatch(depotGuide.title, "پایانه")).toBe(true);
      expect(persianSearchMatch(depotGuide.fullGuideText, "فتح‌آباد")).toBe(true);
      expect(persianSearchMatch(depotGuide.fullGuideText, "کفشک")).toBe(true);
    }

    const reportGuide = MENU_GUIDES.find((g) => g.route === "/reports");
    expect(reportGuide).toBeDefined();
    if (reportGuide) {
      expect(persianSearchMatch(reportGuide.title, "گزارش")).toBe(true);
      expect(persianSearchMatch(reportGuide.fullGuideText, "اکسل")).toBe(true);
    }
  });
});
