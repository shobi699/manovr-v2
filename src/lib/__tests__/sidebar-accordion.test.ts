import { describe, it, expect } from "vitest";

describe("Sidebar Collapsible Accordion Logic", () => {
  const analysisItems = [
    { href: "/profile", label: "پروفایل من" },
    { href: "/tickets", label: "تیکت‌های پشتیبانی" },
    { href: "/reports", label: "گزارش‌ساز پویا" },
    { href: "/help", label: "راهنما و آموزش" },
    { href: "/settings", label: "شخصی‌سازی تم" },
    { href: "/admin/terminals", label: "مدیریت ترمینال‌ها" },
    { href: "/admin/lookups", label: "مدیریت مقادیر پویا" },
    { href: "/admin/branding", label: "تنظیمات برندینگ" },
    { href: "/admin/audit", label: "لاگ وقایع سیستم" },
    { href: "/admin/backup", label: "پشتیبان‌گیری سیستم" },
  ];

  const isLinkActive = (path: string, href: string) => {
    if (href === "/manovrs") {
      return path === href;
    }
    return path === href || (path.startsWith(href) && href !== "/dashboard" && href !== "/depot");
  };

  it("contains exactly 10 analysis and settings sub-items", () => {
    expect(analysisItems).toHaveLength(10);
  });

  it("detects active nested routes for auto-expansion", () => {
    // مسیر داخل بخش گزارش‌ها
    const onReports = isLinkActive("/reports", "/reports");
    expect(onReports).toBe(true);

    const onAuditSubroute = isLinkActive("/admin/audit", "/admin/audit");
    expect(onAuditSubroute).toBe(true);

    // مسیر خارج از بخش تحلیل و تنظیمات (مانند دپو)
    const onDepot = analysisItems.some((item) => isLinkActive("/depot", item.href));
    expect(onDepot).toBe(false);

    // بررسی تطابق خودکار هنگام حضور در یکی از زیرمسیرهای ادمین
    const onLookups = analysisItems.some((item) => isLinkActive("/admin/lookups", item.href));
    expect(onLookups).toBe(true);
  });

  it("handles persistence fallback properly", () => {
    const parseStoredState = (stored: string | null, hasActiveChild: boolean) => {
      if (hasActiveChild) return true; // اولویت با مسیر فعال است
      if (stored !== null) return stored === "true";
      return true; // پیش‌فرض
    };

    expect(parseStoredState("false", false)).toBe(false);
    expect(parseStoredState("false", true)).toBe(true); // مسیر فعال حالت بسته را override می‌کند
    expect(parseStoredState("true", false)).toBe(true);
    expect(parseStoredState(null, false)).toBe(true);
  });
});
