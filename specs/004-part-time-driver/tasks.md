# لیست وظایف پیاده‌سازی: راهبر غیردائم (Tasks: Part-Time Driver)

**شاخه ویژگی**: `004-part-time-driver`  
**طرح فنی**: [plan.md](file:///d:/Manovr/manovr-v2/specs/004-part-time-driver/plan.md) | **سند مشخصات**: [spec.md](file:///d:/Manovr/manovr-v2/specs/004-part-time-driver/spec.md)

---

## وضعیت وظایف (Task Checklist)

### فاز ۱: اسکیما و مدل داده (Data Model & Schema)
- [x] **T001**: افزودن فیلد `isPartTimeDriver Boolean @default(false)` به مدل `Personnel` در `prisma/schema.prisma` و اعمال همگام‌سازی با `prisma db push` و تولید کلاینت پریسما.
- [x] **T002**: افزودن فیلد `isPartTimeDriver` به اسکیماهای Zod در `src/lib/validations/user.schema.ts` (`createUserSchema` و `updateUserSchema`).
- [x] **T003**: افزودن `isPartTimeDriver` به `PERSONNEL_SAFE_FIELDS` و ساختار سلکت در `src/lib/report-engine.ts`.

### فاز ۲: امنیت و سطوح دسترسی (Security & Permissions)
- [x] **T004**: بررسی و تثبیت گاردهای `hasPerm(session, "user.create")` و `hasPerm(session, "user.edit")` در `src/app/actions/user.ts`.
- [x] **T005**: اجرای تست‌های دسترسی در `src/lib/__tests__/perms.test.ts` و اطمینان از قبولی ۱۰۰٪.

### فاز ۳: داستان کاربری ۱ - چک‌باکس در فرم پرسنل (User Story 1: Personnel Forms)
- [x] **T006**: پیاده‌سازی تست‌های واحد رفتار فیلد در `src/lib/__tests__/user-part-time-driver.test.ts`.
- [x] **T007**: به‌روزرسانی اکشن‌های `createUser` و `updateUser` در `src/app/actions/user.ts` با استخراج فیلد `isPartTimeDriver` و ریست خودکار به `false` در صورت انتخاب سمت سازمانی راهبر (`orgPosition === 1`).
- [x] **T008**: افزودن چک‌باکس راهبر غیردائم با رفتار شرطی هوشمند در `src/app/(main)/users/[id]/edit/EditUserForm.tsx`.
- [x] **T009**: پاس دادن فیلد `isPartTimeDriver` در کامپوننت سروری `src/app/(main)/users/[id]/edit/page.tsx`.
- [x] **T010**: افزودن چک‌باکس با منطق شرطی در فرم ایجاد کاربر جدید در `src/app/(main)/users/new/NewUserForm.tsx`.

### فاز ۴: داستان کاربری ۲ - انتخاب‌پذیری در مانور (User Story 2: Maneuver Selection)
- [x] **T011**: ارتقای کوئری واکشی راهبران در `src/app/(main)/manovrs/new/page.tsx` به شرط تلفیقی `{ OR: [{ orgPosition: 1 }, { isPartTimeDriver: true }] }` و الحاق برچسب `(راهبر غیردائم)`.
- [x] **T012**: ارتقای کوئری راهبران در `src/app/(main)/depot/page.tsx` به شرط تلفیقی و برچسب‌گذاری برای `DepotScene` و `DepotCreateManovrModal`.
- [x] **T013**: پیاده‌سازی و راستی‌آزمایی تست ثبت مانور با راهبر غیردائم در `src/app/actions/__tests__/manovr-actions.test.ts`.

### فاز ۵: داستان کاربری ۳ - موتور گزارش‌گیری و ماتریس عملکرد (User Story 3: Reports & Performance Matrix)
- [x] **T014**: به‌روزرسانی `src/app/actions/manovr-reports.ts` جهت لحاظ فیلد `isPartTimeDriver` در استخراج خلاصه‌ها و آمار عملکرد راهبران (`driverSummaries`) و فیلتر `driverType`.
- [x] **T015**: به‌روزرسانی کوئری فیلتر تاریخچه مانورها در `src/app/(main)/manovrs/page.tsx` جهت شمول راهبران غیردائم در لیست فیلتر راهبران.
- [x] **T016**: افزودن نشانگر بصری و فیلتر تفکیکی راهبر غیردائم در `src/app/(main)/manovrs/components/DriverShuntingReportsView.tsx`.
- [x] **T017**: اجرای آزمون‌های گزارش در `src/lib/__tests__/shunting-reports.test.ts` با تست‌های جدید تفکیک دائم و غیردائم.

### فاز ۶: داستان کاربری ۴ - برچسب پرسنل و اکسل (User Story 4: Personnel Badge & Excel)
- [x] **T018**: افزودن نشانگر (بج) گرافیکی `(راهبر غیردائم)` در جدول پرسنل `src/app/(main)/users/UsersTableClient.tsx`.
- [x] **T019**: افزودن ستون وضعیت راهبر غیردائم در اکسپورت اکسل پرسنل در `src/lib/export-helpers.ts` با استانداردهای RTL.

### فاز ۷: پروتکل همگام‌سازی سه‌گانه الزامی (Tri-Sync Protocol)
- [x] **T020**: اعتبارسنجی در پنل مدیریت نقش‌ها (`src/app/(main)/roles/RolesFormClient.tsx`).
- [x] **T021**: نگارش و الحاق حداقل ۱۰۰۰ کاراکتر مستندات فنی و راهنمای عملیاتی در `src/lib/help-menu-guides.ts` برای منوهای کاربران و مانورها بدون هیچ‌گونه placeholder.
- [x] **T022**: اجرای آزمون ناوبری راهنما در `src/lib/__tests__/help-navigation.test.ts`.

### فاز ۸: تست رگرسیون و تحویل (Regression & Convergence)
- [x] **T023**: اجرای تایپ‌چک کامل بدون اخطار با `npx tsc --noEmit`.
- [x] **T024**: اجرای تست‌های کامل در ۲ دور متوالی با `npm test` (۴۳ فایل تست، ۲۶۹ تست با قبولی ۱۰۰٪).
- [x] **T025**: به‌روزرسانی کامل لیست وظایف در `tasks.md`.
- [x] **T026**: ارائه گزارش نهایی و اعلام وضعیت همگرایی کامل (`Converged`).
