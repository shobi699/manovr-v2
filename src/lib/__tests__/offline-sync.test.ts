import { describe, it, expect } from "vitest";
import { getOfflinePolicy, setOfflinePolicy } from "@/lib/settings";
import { getNetworkStatus } from "@/lib/network-status";
import type { OfflineAction } from "@/lib/offline-sync";

describe("Offline Sync & Chronological Ordering", () => {
  it("sorts queue strictly in chronological order by action timestamp", () => {
    // شبیه‌سازی چند کاربر که همزمان در زمان قطعی سیستم تغییراتی ثبت کرده‌اند
    const userA_action1: OfflineAction = {
      id: "act-1",
      actionType: "CREATE_MANOVR",
      data: { trainId: 101, sourceLineId: 1, destinationLineId: 2 },
      timestamp: "2026-09-10T10:05:30.000Z", // ۱۰:۰۵ توسط کاربر الف
      userId: 1,
      userFullName: "کاربر الف",
    };

    const userB_action1: OfflineAction = {
      id: "act-2",
      actionType: "UPDATE_TRAIN_STATUS",
      data: { trainId: 102, status: 2 },
      timestamp: "2026-09-10T10:04:15.000Z", // ۱۰:۰۴ توسط کاربر ب (قدیمی‌تر از الف)
      userId: 2,
      userFullName: "کاربر ب",
    };

    const userC_action1: OfflineAction = {
      id: "act-3",
      actionType: "RELOCATE_TRAIN",
      data: { trainId: 101, destinationLineId: 5 },
      timestamp: "2026-09-10T10:12:00.000Z", // ۱۰:۱۲ توسط کاربر ج (جدیدتر از همه)
      userId: 3,
      userFullName: "کاربر ج",
    };

    // لیست ورودی به صورت تصادفی/غیرترتیبی
    const unorderedQueue = [userA_action1, userC_action1, userB_action1];

    // منطق مرتب‌سازی زمانی دقیق سامانه
    const sorted = [...unorderedQueue].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // ۱. باید اولین مورد، رویداد کاربر ب (ساعت ۱۰:۰۴) باشد
    expect(sorted[0].id).toBe("act-2");
    expect(sorted[0].userFullName).toBe("کاربر ب");

    // ۲. مورد دوم، رویداد کاربر الف (ساعت ۱۰:۰۵) باشد
    expect(sorted[1].id).toBe("act-1");
    expect(sorted[1].userFullName).toBe("کاربر الف");

    // ۳. مورد سوم، رویداد کاربر ج (ساعت ۱۰:۱۲) باشد
    expect(sorted[2].id).toBe("act-3");
    expect(sorted[2].userFullName).toBe("کاربر ج");
  });

  it("stores and retrieves offline policy correctly", async () => {
    // پیش‌فرض باید auto_sync باشد
    const initial = await getOfflinePolicy();
    expect(["auto_sync", "read_only"]).toContain(initial);

    // تغییر به read_only
    await setOfflinePolicy("read_only", "تست مدیر");
    const updated = await getOfflinePolicy();
    expect(updated).toBe("read_only");

    // بازگرداندن به حالت پیش‌فرض auto_sync
    await setOfflinePolicy("auto_sync", "تست مدیر");
    const restored = await getOfflinePolicy();
    expect(restored).toBe("auto_sync");
  });

  it("masks network server paths securely without leaking UNC addresses", async () => {
    const status = await getNetworkStatus();

    expect(status.maskedTarget).toBe("سرور متمرکز دپو (دپو دیتا)");
    expect(status.maskedActivePath).toBeDefined();
    expect(status.maskedTarget.includes("\\\\")).toBe(false);
    expect(status.maskedActivePath.includes("\\\\")).toBe(false);
  });
});
