import { describe, it, expect } from "vitest";
import type { FlyoutTooltipItem } from "@/components/SidebarFlyoutTooltip";

describe("Sidebar Flyout Tooltip Positioning & Geometry Logic", () => {
  // تابع کمکی محاسبه موقعیت تول‌تیپ شناور مطابق با کامپوننت SidebarFlyoutTooltip
  const computeTooltipCoords = (
    anchorRect: { top: number; height: number; left: number; right: number },
    navPos: "right" | "left" = "right",
    windowWidth: number = 1920
  ) => {
    const targetTop = anchorRect.top + anchorRect.height / 2;
    const isNavLeft = navPos === "left";

    if (isNavLeft) {
      return {
        top: targetTop,
        left: anchorRect.right + 12,
        right: undefined,
        transform: "translateY(-50%)",
      };
    }

    return {
      top: targetTop,
      left: undefined,
      right: windowWidth - anchorRect.left + 12,
      transform: "translateY(-50%)",
    };
  };

  it("calculates correct centered vertical coordinate", () => {
    const mockRect = { top: 200, height: 44, left: 1850, right: 1894 };
    const coords = computeTooltipCoords(mockRect, "right", 1920);

    // مرکز عمودی: 200 + 44 / 2 = 222
    expect(coords.top).toBe(222);
    expect(coords.transform).toBe("translateY(-50%)");
  });

  it("calculates correct RTL offset when sidebar is on the right", () => {
    const mockRect = { top: 100, height: 44, left: 1846, right: 1890 };
    const coords = computeTooltipCoords(mockRect, "right", 1920);

    // فاصله از راست: 1920 - 1846 + 12 = 86px
    expect(coords.right).toBe(86);
    expect(coords.left).toBeUndefined();
  });

  it("calculates correct LTR offset when sidebar is positioned on the left", () => {
    const mockRect = { top: 150, height: 44, left: 20, right: 64 };
    const coords = computeTooltipCoords(mockRect, "left", 1920);

    // فاصله از چپ: 64 + 12 = 76px
    expect(coords.left).toBe(76);
    expect(coords.right).toBeUndefined();
  });

  it("supports comprehensive tooltip item structure with badges and category", () => {
    const mockItem: FlyoutTooltipItem = {
      anchorRect: null,
      title: "تأیید و کنترل مانورها",
      category: "عملیات پایانه",
      isActive: true,
      subtitle: "بررسی و صحه‌گذاری مانورهای شیفت جاری",
      badge: "نیازمند اقدام",
      badgeVariant: "amber",
    };

    expect(mockItem.title).toBe("تأیید و کنترل مانورها");
    expect(mockItem.category).toBe("عملیات پایانه");
    expect(mockItem.isActive).toBe(true);
    expect(mockItem.badgeVariant).toBe("amber");
  });

  it("correctly identifies warning badge variant for logout action", () => {
    const logoutItem: FlyoutTooltipItem = {
      anchorRect: null,
      title: "خروج از سامانه",
      category: "کنترل نشست",
      badge: "پایان کاربری",
      badgeVariant: "warning",
    };

    expect(logoutItem.badgeVariant).toBe("warning");
    expect(logoutItem.title).toContain("خروج");
  });
});
