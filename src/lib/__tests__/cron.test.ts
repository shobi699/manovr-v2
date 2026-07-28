import { describe, it, expect } from "vitest";
import { cronMatch } from "@/lib/cron";

// کمکی: همان تبدیلی که cronMatch به‌صورت داخلی انجام می‌دهد را روی یک لحظه UTC
// دلخواه اعمال می‌کند تا مقادیر مورد انتظار تهران استخراج شود، بدون هاردکد کردن
// آفست منطقه زمانی.
function tehranFieldsFor(utcDate: Date) {
  const tehranTime = new Date(utcDate.toLocaleString("en-US", { timeZone: "Asia/Tehran" }));
  return {
    minute: tehranTime.getMinutes(),
    hour: tehranTime.getHours(),
    day: tehranTime.getDate(),
    month: tehranTime.getMonth() + 1,
    dayOfWeek: tehranTime.getDay(),
  };
}

describe("cronMatch", () => {
  it("returns false for an expression with fewer than 5 fields", () => {
    expect(cronMatch("* * * *", new Date())).toBe(false);
  });

  it("matches any date for the all-wildcard expression", () => {
    expect(cronMatch("* * * * *", new Date())).toBe(true);
  });

  it("matches a step field in the minute position at multiples of the step, not otherwise", () => {
    // یک لحظه UTC دلخواه را می‌گیریم و دقیقه تهرانش را با همان تبدیل تابع محاسبه می‌کنیم
    // (بدون فرض از پیش درباره آفست منطقه زمانی)، سپس آن را به نزدیک‌ترین مضرب ۵ گرد می‌کنیم.
    const start = new Date("2026-03-15T08:00:00Z");
    const startMinute = tehranFieldsFor(start).minute;
    const roundedMinute = startMinute - (startMinute % 5);
    const base = new Date(start.getTime() - (startMinute - roundedMinute) * 60 * 1000);
    const { minute } = tehranFieldsFor(base);
    expect(minute % 5).toBe(0);

    expect(cronMatch("*/5 * * * *", base)).toBe(true); // minute % 5 === 0

    const plus5 = new Date(base.getTime() + 5 * 60 * 1000);
    expect(tehranFieldsFor(plus5).minute % 5).toBe(0);
    expect(cronMatch("*/5 * * * *", plus5)).toBe(true); // (minute+5) % 5 === 0

    const plus7 = new Date(base.getTime() + 7 * 60 * 1000);
    expect(tehranFieldsFor(plus7).minute % 5).not.toBe(0);
    expect(cronMatch("*/5 * * * *", plus7)).toBe(false); // (minute+7) % 5 !== 0
  });

  it("matches a list field and rejects values outside the list", () => {
    // یک لحظه پایه دلخواه را می‌گیریم و بر اساس دقیقه واقعی تهرانش، افست‌های لازم برای
    // رسیدن به دقیقه‌های ۱۵ و ۱۶ را محاسبه می‌کنیم — بدون فرض از پیش درباره آفست منطقه زمانی.
    const base = new Date("2026-03-15T08:00:00Z");
    const baseMinute = tehranFieldsFor(base).minute;

    const offsetTo = (targetMinute: number) => {
      const diff = ((targetMinute - baseMinute) % 60 + 60) % 60;
      return new Date(base.getTime() + diff * 60 * 1000);
    };

    const to15 = offsetTo(15);
    expect(tehranFieldsFor(to15).minute).toBe(15);
    expect(cronMatch("1,15,30 * * * *", to15)).toBe(true);

    const to16 = offsetTo(16);
    expect(tehranFieldsFor(to16).minute).toBe(16);
    expect(cronMatch("1,15,30 * * * *", to16)).toBe(false);
  });

  it("matches a range field in the hour position and rejects values outside the range", () => {
    const base = new Date("2026-03-15T00:00:00Z");
    const { hour: baseHour } = tehranFieldsFor(base);

    // ساخت یک لحظه که ساعت تهرانش ۱۲ باشد، با جابجایی نسبت به base بر حسب ساعت.
    const to12 = new Date(base.getTime() + (12 - baseHour + 24) % 24 * 60 * 60 * 1000);
    expect(tehranFieldsFor(to12).hour).toBe(12);
    expect(cronMatch("* 9-17 * * *", to12)).toBe(true);

    const to20 = new Date(base.getTime() + (20 - baseHour + 24) % 24 * 60 * 60 * 1000);
    expect(tehranFieldsFor(to20).hour).toBe(20);
    expect(cronMatch("* 9-17 * * *", to20)).toBe(false);
  });

  it("tolerates extra whitespace between fields", () => {
    expect(cronMatch("*  *  * * *", new Date())).toBe(true);
  });
});
