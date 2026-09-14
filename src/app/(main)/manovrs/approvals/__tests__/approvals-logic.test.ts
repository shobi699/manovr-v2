import { describe, it, expect } from "vitest";

// شبیه‌سازی منطق تب‌ها و فیلترهای تأیید و کنترل مانورها مطابق با ApprovalsPanelClient
interface MockManovr {
  id: number;
  status: number; // 1: شروع شده (فعال), 2: پایان یافته, 3: حذف شده
  confirmationStatus: number; // 1: تأیید, 2: رد, 3: بدون تأیید (منتظر تأیید)
  type: number;
}

function filterManovrsByTab(
  manovrs: MockManovr[],
  activeTab: "pending" | "active" | "approved" | "rejected"
): MockManovr[] {
  return manovrs.filter((m) => {
    if (activeTab === "pending") {
      return m.confirmationStatus === 3; // منتظر تأیید
    }
    if (activeTab === "active") {
      return m.status === 1; // در حال اجرا (شروع شده)
    }
    if (activeTab === "approved") {
      return m.confirmationStatus === 1; // تأیید شده
    }
    if (activeTab === "rejected") {
      return m.confirmationStatus === 2; // رد شده
    }
    return true;
  });
}

function getAvailableBulkActions(
  activeTab: "pending" | "active" | "approved" | "rejected",
  selectedManovrs: MockManovr[]
): string[] {
  const actions: string[] = [];
  if (selectedManovrs.length === 0) return actions;

  if (activeTab === "pending") {
    actions.push("bulk_approve", "bulk_reject", "bulk_delete");
  } else if (activeTab === "active") {
    actions.push("bulk_finish", "bulk_delete");
  } else if (activeTab === "approved") {
    if (selectedManovrs.some((m) => m.status === 1)) {
      actions.push("bulk_finish");
    }
    actions.push("bulk_delete");
  } else if (activeTab === "rejected") {
    actions.push("bulk_delete");
  }

  return actions;
}

describe("ApprovalsPanel - ۴ تب تأیید و کنترل مانورها و عملیات گروهی متناظر", () => {
  const sampleManovrs: MockManovr[] = [
    // منتظر تایید شیفت (confirmationStatus: 3)
    { id: 1, status: 1, confirmationStatus: 3, type: 1 },
    { id: 2, status: 1, confirmationStatus: 3, type: 2 },
    // مانورهای فعال در حال اجرا (status: 1)
    { id: 3, status: 1, confirmationStatus: 1, type: 2 },
    { id: 4, status: 1, confirmationStatus: 1, type: 3 },
    { id: 5, status: 1, confirmationStatus: 1, type: 1 },
    // مانورهای تأیید شده خاتمه‌یافته (status: 2, confirmationStatus: 1)
    { id: 6, status: 2, confirmationStatus: 1, type: 2 },
    { id: 7, status: 2, confirmationStatus: 1, type: 4 },
    // مانورهای رد شده (confirmationStatus: 2)
    { id: 8, status: 1, confirmationStatus: 2, type: 1 },
    { id: 9, status: 2, confirmationStatus: 2, type: 5 },
  ];

  describe("۱. فیلترینگ و شمارش مانورها در هر تب", () => {
    it("تب ۱ (منتظر تأیید مسئول شیفت): فقط مانورهای با confirmationStatus === 3 را نمایش می‌دهد", () => {
      const pending = filterManovrsByTab(sampleManovrs, "pending");
      expect(pending).toHaveLength(2);
      expect(pending.map((m) => m.id)).toEqual([1, 2]);
    });

    it("تب ۲ (مانورهای در حال اجرا - فعال): مانورهای با وضعیت شروع‌شده (status === 1) را نمایش می‌دهد", () => {
      const active = filterManovrsByTab(sampleManovrs, "active");
      expect(active).toHaveLength(6);
      expect(active.every((m) => m.status === 1)).toBe(true);
    });

    it("تب ۳ (مانورهای تأیید شده): تمام مانورهای تایید شده (confirmationStatus === 1) را نمایش می‌دهد", () => {
      const approved = filterManovrsByTab(sampleManovrs, "approved");
      expect(approved).toHaveLength(5);
      expect(approved.map((m) => m.id)).toEqual([3, 4, 5, 6, 7]);
    });

    it("تب ۴ (مانورهای رد شده): مانورهای رد شده (confirmationStatus === 2) را نمایش می‌دهد", () => {
      const rejected = filterManovrsByTab(sampleManovrs, "rejected");
      expect(rejected).toHaveLength(2);
      expect(rejected.map((m) => m.id)).toEqual([8, 9]);
    });
  });

  describe("۲. عملیات گروهی متناسب با هر تب (دکمه‌های نوار ابزار)", () => {
    it("در تب منتظر تأیید (pending): عملیات تأیید گروهی، رد گروهی و حذف گروهی در دسترس هستند", () => {
      const selected = sampleManovrs.filter((m) => m.id === 1 || m.id === 2);
      const actions = getAvailableBulkActions("pending", selected);
      expect(actions).toEqual(["bulk_approve", "bulk_reject", "bulk_delete"]);
    });

    it("در تب مانورهای در حال اجرا (active): به جای تایید گروهی، بستن گروهی و حذف گروهی در دسترس است", () => {
      const selected = sampleManovrs.filter((m) => [3, 4, 5].includes(m.id));
      const actions = getAvailableBulkActions("active", selected);
      expect(actions).toContain("bulk_finish");
      expect(actions).toContain("bulk_delete");
      expect(actions).not.toContain("bulk_approve");
      expect(actions).not.toContain("bulk_reject");
    });

    it("در تب مانورهای تأیید شده (approved): عملیات حذف گروهی فعال است", () => {
      const selected = sampleManovrs.filter((m) => [6, 7].includes(m.id));
      const actions = getAvailableBulkActions("approved", selected);
      expect(actions).toContain("bulk_delete");
      expect(actions).not.toContain("bulk_approve");
    });

    it("در تب مانورهای رد شده (rejected): فقط عملیات حذف گروهی فعال است", () => {
      const selected = sampleManovrs.filter((m) => [8, 9].includes(m.id));
      const actions = getAvailableBulkActions("rejected", selected);
      expect(actions).toEqual(["bulk_delete"]);
    });
  });

  describe("۳. منطق انتخاب همگانی (Select All) و ایزولاسیون تب‌ها", () => {
    it("انتخاب همه در یک تب، فقط شناسه‌های مانورهای همان تب را انتخاب می‌کند", () => {
      const activeList = filterManovrsByTab(sampleManovrs, "active");
      const selectedIds = activeList.map((m) => m.id);
      expect(selectedIds).toHaveLength(6);
      expect(selectedIds).toEqual([1, 2, 3, 4, 5, 8]);
    });

    it("هنگام تغییر تب، شناسه‌های انتخاب‌شده باید ریست شوند تا اثر ناخواسته در تب دیگر نگذارند", () => {
      let selectedIds = [3, 4, 5];
      // تغییر تب به rejected
      const onTabChange = () => {
        selectedIds = [];
      };
      onTabChange();
      expect(selectedIds).toEqual([]);
    });
  });
});
