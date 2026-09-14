---
description: "فهرست وظایف اجرایی بهبود مانور سریع و اعتبارسنجی خطوط پایانه"
---

# فهرست وظایف اجرایی: مانور سریع و اعتبارسنجی خطوط پایانه (Tasks: 001-depot-line-manovr)

**ورودی**: اسناد طراحی از مسیر `/specs/001-depot-line-manovr/`  
**پیش‌نیازها**: `plan.md` و `spec.md`

## ساختار کد تسک‌ها: `[ID] [P?] [Story/Phase] شرح تسک`

---

## فاز ۱: زیرساخت امنیت و دسترسی‌ها (Phase 1: Security & Permissions — Tri-Sync Part 1)
- [x] T001 اعتبارسنجی کلید `MANOVR_CREATE` و `LINE_MANAGE` در `src/lib/perms.ts`
- [x] T002 اعمال گارد `hasPerm(session, "MANOVR_CREATE")` در اکشن `createManovr` در `src/app/actions/manovr.ts`
- [x] T003 [P] اجرای آزمون‌های واحد مجوزها با دستور `npm run test:run -- src/lib/__tests__/perms.test.ts`

---

## فاز ۲: آزمون‌های پذیرش و تست خودکار Playwright (Phase 2: Automated Tests — Anti-False Green)
> **الزام قانون اساسی**: استفاده از Web-First Assertions، دستور `await`، و اثبات پایداری داده (Persistence Proof)
- [x] T004 ایجاد سناریوی تست E2E در `e2e/desktop/depot-line-manovr.spec.ts`
- [x] T005 پیاده‌سازی گام انتخاب خط، باز شدن مودال جزئیات، تعیین قطار و مقصد و ارسال فرم
- [x] T006 [P] بررسی پایداری داده در بک‌اند (استعلام تغییر وضعیت و ثبت در تاریخچه مانورها)

---

## فاز ۳: پیاده‌سازی و یکپارچه‌سازی رابط کاربری (Phase 3: UI & RTL Implementation)
- [x] T007 به‌روزرسانی تب مانور در `src/app/(main)/depot/modals/DepotLineDetailsModal.tsx` با کنترل ظرفیت خط مقصد
- [x] T008 اتصال انتخابگر تاریخ و زمان شمسی تهران با `JalaliDateTimePicker`
- [x] T009 تضمین چیدمان راست‌چین (`dir="rtl"`) و هماهنگی با کلاس‌های منطقی Tailwind (`ms-*`, `me-*`)

---

## فاز ۴: همگام‌سازی آموزش و مستندات منو (Phase 4: Tri-Sync Help Documentation)
- [x] T010 بررسی و غنی‌سازی آموزش صفحه پایانه در `src/lib/help-menu-guides.ts` با حداقل **۱۰۰۰ کاراکتر فارسی**
- [x] T011 [P] اجرای آزمون ناوگانی و محتوایی راهنما در `src/lib/__tests__/help-navigation.test.ts`

---

## فاز ۵: همگرایی نهایی و اعتبارسنجی سیستم (Phase 5: Convergence & QA)
- [x] T012 اجرای آزمون‌های Vitest: `npm run test:run`
- [x] T013 اجرای اعتبارسنجی یکپارچگی Spec Kit: `npm run spec:status`
- [x] T014 اعلام وضعیت همگرا (Converged)
