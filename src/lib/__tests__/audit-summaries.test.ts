import { describe, it, expect } from "vitest";
import {
  personnelCreatedSummary,
  personnelUpdatedSummary,
  personnelDeletedSummary,
  passwordResetSummary,
  bulkPersonnelSummary,
  roleCreatedSummary,
  roleUpdatedSummary,
  roleDeletedSummary,
  lineCreatedSummary,
  lineUpdatedSummary,
  lineDeletedSummary,
  importSummary,
  trainSummary,
  manovrCreatedSummary,
  manovrStatusSummary,
  lookupSummary,
  ticketSummary,
} from "@/lib/audit-summaries";

describe("audit-summaries helpers", () => {
  it("builds personnelCreatedSummary with account info", () => {
    const withAcc = personnelCreatedSummary({ firstName: "علی", lastName: "رضایی", hasAccount: true });
    expect(withAcc).toContain("علی رضایی");
    expect(withAcc).toContain("به همراه حساب کاربری");

    const noAcc = personnelCreatedSummary({ firstName: "علی", lastName: "رضایی", hasAccount: false });
    expect(noAcc).toContain("علی رضایی");
    expect(noAcc).toContain("بدون حساب کاربری");

    const updated = personnelUpdatedSummary({ firstName: "رضا", lastName: "کاظمی" });
    expect(updated).toContain("رضا کاظمی");

    const deleted = personnelDeletedSummary({ firstName: "حسین", lastName: "علوی" });
    expect(deleted).toContain("حسین علوی");
  });

  it("handles missing name fields gracefully", () => {
    const res = personnelCreatedSummary({ firstName: null, lastName: null });
    expect(res).toContain("بدون نام");
    expect(res).not.toContain("null");
  });

  it("never includes password hashes or plain passwords in passwordResetSummary", () => {
    const summary = passwordResetSummary({ firstName: "محمد", lastName: "حسینی" });
    expect(summary).toContain("محمد حسینی");
    expect(summary).not.toMatch(/\$2[ab]\$/);
    expect(summary).not.toMatch(/\d{4,}/);
  });

  it("formats bulkPersonnelSummary correctly and caps ID list at 20", () => {
    const small = bulkPersonnelSummary("حذف", 3, [1, 2, 3]);
    expect(small).toContain("3");
    expect(small).toContain("1، 2، 3");

    const largeIds = Array.from({ length: 25 }, (_, i) => i + 1);
    const large = bulkPersonnelSummary("تغییر شیفت", 25, largeIds);
    expect(large).toContain("25");
    expect(large).toContain("5 مورد دیگر");
    expect(large).not.toContain("21، 22");
  });

  it("formats role and line summaries correctly", () => {
    expect(roleCreatedSummary("مدیر ارشد", 15)).toContain("مدیر ارشد");
    expect(roleCreatedSummary("مدیر ارشد", 15)).toContain("15 مجوز");

    expect(roleUpdatedSummary("راهبر", 4)).toContain("راهبر");
    expect(roleDeletedSummary("تکنیسین")).toContain("تکنیسین");

    expect(lineCreatedSummary("خط ۱")).toContain("خط ۱");
    expect(lineUpdatedSummary("خط ۲")).toContain("خط ۲");
    expect(lineDeletedSummary("خط ۳")).toContain("خط ۳");
    expect(importSummary("خط", 10)).toContain("10 خط");
  });

  it("formats train, manovr, lookup, and ticket summaries correctly", () => {
    expect(trainSummary("ایجاد", "101")).toContain("قطار «101» ایجاد شد.");
    expect(manovrCreatedSummary("102", "جابجایی")).toContain("جابجایی");
    expect(manovrStatusSummary(50, "تأیید شده")).toContain("50");
    expect(lookupSummary("ثبت", "پایه اولیه")).toContain("پایه اولیه");
    expect(ticketSummary("پاسخ", "مشکل ورود")).toContain("مشکل ورود");
  });
});
