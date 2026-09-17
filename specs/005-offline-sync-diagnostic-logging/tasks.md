# لیست وظایف پیاده‌سازی: همگام‌سازی هوشمند محلی-سرور، سیاست‌های آفلاین و لاگ عیب‌یابی
# Tasks: Local-First Smart Sync, Offline Policies & In-App Diagnostic Logging

**شاخه ویژگی**: `005-offline-sync-diagnostic-logging`  
**طرح فنی**: [plan.md](file:///d:/Manovr/manovr-v2/specs/005-offline-sync-diagnostic-logging/plan.md) | **سند مشخصات**: [spec.md](file:///d:/Manovr/manovr-v2/specs/005-offline-sync-diagnostic-logging/spec.md)

---

## وضعیت وظایف (Task Checklist)

### فاز ۱: پایداری دیتابیس و همزمانی شبکه (Database Resilience & SMB Concurrency)
- [x] **T001**: بهینه‌سازی موتور SQLite در `src/lib/prisma.ts` با حذف قفل‌های انحصاری در زمان اتصال، فعال‌سازی `read_uncommitted = true` و تنظیم `busy_timeout = 8000`.
- [x] **T002**: ارتقای `src/lib/network-status.ts` با افزودن آزمون مجوز نوشتن دیسک (NTFS Modify)، شناسایی فایل‌های قفل موقت (`dev.db-wal` و `dev.db-shm`) و تابع نیتیو `repairDatabaseInPlace`.
- [x] **T003**: ایجاد سرور اکشن `src/app/actions/database-repair.ts` جهت فراخوانی متمرکز و امن ابزار تعمیر و عیب‌یابی از داخل رابط کاربری.

### فاز ۲: عیب‌یابی و تعمیر درون‌برنامه‌ای در صفحه لاگین (In-App Login Diagnostics)
- [x] **T004**: ایجاد کامپوننت مودال عیب‌یابی ۵ مرحله‌ای و تعمیر دیتابیس در `src/app/login/DatabaseDiagnosticModal.tsx`.
- [x] **T005**: اتصال مودال عیب‌یابی به `src/app/login/LoginConnectionStatus.tsx` و افزودن بنر اخطار عدم دسترسی نوشتن پوشه سرور با راهنمای ادمین.

### فاز ۳: سیستم جامع لاگ عیب‌یابی و ارسال به ادمین (Diagnostic Logging Engine)
- [x] **T006**: پیاده‌سازی ماژول اختصاصی `src/lib/logger.ts` با ثبت ساختاریافته وقایع (دیتابیس، شبکه، آفلاین، امنیت) در دیسک محلی و متد کپی گزارش Markdown برای ادمین.
- [x] **T007**: پیاده‌سازی اکشن سرور `src/app/actions/logs.ts` جهت واکشی، جستجو و خروجی فایل لاگ (`.log`).
- [x] **T008**: ایجاد کامپوننت مشاهده، جستجو و دکمه یک‌کلیکی «کپی لاگ برای ادمین» درون رابط کاربری نرم‌افزار.

### فاز ۴: ارتقای همگام‌سازی هوشمند آفلاین و بازتلاش ۱ دقیقه‌ای (Offline Sync & 1-Min Retry)
- [x] **T009**: ارتقای کارگر همگام‌سازی `src/lib/offline-sync.ts` با حلقه بازتلاش خودکار هر ۶۰ ثانیه (۱ دقیقه) به محض برقراری اتصال به سرور.
- [x] **T010**: پیاده‌سازی سازوکار محاسبه تاخیر و صدور اخطار خودکار در صورت معوق ماندن داده‌ها به مدت بیش از ۱۰ دقیقه (۶۰۰ ثانیه).
- [x] **T011**: تثبیت ادغام زمانی دقیق (Chronological Timestamp Ordering) جهت رفع تعارضات داده‌ای چندکاربره در پایانه.

### فاز ۵: تثبیت سیاست‌های آفلاین در ثبت مانورها (Offline Policy Enforcement)
- [x] **T012**: اعمال کنترل سیاست‌های `smart_sync` و `read_only` در اکشن `createManovrAction` در `src/app/actions/manovr.ts`.
- [x] **T013**: اعمال کنترل سیاست فقط خواندنی در تغییر وضعیت قطارها (`updateTrainStatusAction`) و جابجایی ریل (`relocateTrainAction`).
- [x] **T014**: نمایش بنر اخطار وضعیت «فقط خواندنی» در نمای پایانه (`/depot`) و فرم مانور جدید در صورت قطعی شبکه.

### فاز ۶: پروتکل همگام‌سازی سه‌گانه الزامی (Tri-Sync Protocol)
- [x] **T015**: افزودن مجوزهای `system.diagnostics` و `logs.diagnostics` به `ALL_PERMS`، `PERM_LABELS` و `PERM_GROUPS` در `src/lib/perms.ts`.
- [x] **T016**: اعتبارسنجی در فرم مدیریت نقش‌ها (`/roles`).
- [x] **T017**: نگارش حداقل ۱۰۰۰ کاراکتر مستندات فنی و راهنمای تفصیلی عملیات آفلاین و عیب‌یابی در `src/lib/help-menu-guides.ts`.

### فاز ۷: آزمون‌های خودکار و تحویل (Verification & Convergence)
- [x] **T018**: تدوین آزمون‌های جامع در Vitest برای ماژول‌های لاگ، صف آفلاین، تعمیر دیتابیس و انطباق سیاست‌ها.
- [x] **T019**: اجرای تایپ‌چک کامل با `npx tsc --noEmit` و آزمون‌ها با `npm test` در ۲ دور متوالی با قبولی ۱۰۰٪.
- [x] **T020**: به‌روزرسانی کامل مستندات و اعلام وضعیت همگرایی کامل (`Converged`).
