# مستندات یافته‌های فنی و معماری ممیزی جامع سامانه (Research Findings: full-app-qa-audit)

**قابلیت**: ممیزی جامع کیفیت، لایه‌های سامانه و تست سرتاسری منوها  
**تاریخ**: ۱۴۰۵/۰۶/۲۵ (2026-09-15)  
**سند برنامه**: [plan.md](./plan.md)

---

## ۱. نقشه جامع ۲۰ منوی عملیاتی سامانه (Systematic Menu Inventory)

سامانه مانور دارای ۲۰ ماژول ناوبری مستقل به شرح زیر است که در این ممیزی مورد سنجش قرار می‌گیرند:

| ردیف | شناسه منو | مسیر URL | عنوان فارسی | کلید مجوز مورد نیاز | مؤلفه اصلی |
|:---:|:---|:---|:---|:---|:---|
| ۱ | `depot` | `/depot` | نمای پایانه (2D & 3D) | `depot.view` | `DepotScene.tsx` |
| ۲ | `dashboard` | `/dashboard` | داشبورد و شاخص‌های آماری | `dashboard.view` | `DashboardClient.tsx` |
| ۳ | `approvals` | `/manovrs/approvals` | تأیید و کنترل مانورها | `manovr.confirm` | `ApprovalsPanelClient.tsx` |
| ۴ | `manovrs-history` | `/manovrs` | تاریخچه مانورها | `manovr.view` | `ManovrsTableClient.tsx` |
| ۵ | `manovrs-new` | `/manovrs/new` | ثبت مانور جدید | `manovr.create` | `NewManovrForm.tsx` |
| ۶ | `trains` | `/trains` | مدیریت قطارها و ناوگان | `train.view` | `TrainsTableClient.tsx` |
| ۷ | `lines` | `/lines` | مدیریت خطوط ریل و ظرفیت‌ها | `line.view` | `LinesTableClient.tsx` |
| ۸ | `users` | `/users` | کاربران و پرسنل پایانه | `user.view` | `UsersTableClient.tsx` |
| ۹ | `roles` | `/roles` | مدیریت نقش‌ها و اختیارات | `role.view` | `RolesFormClient.tsx` |
| ۱۰ | `phonebook` | `/phonebook` | دفتر تلفن پرسنل | `phonebook.view` | `PhonebookClient.tsx` |
| ۱۱ | `profile` | `/profile` | پروفایل کاربری من | — (عمومی کاربران) | `ProfileClient.tsx` |
| ۱۲ | `tickets` | `/tickets` | سامانه تیکت‌های پشتیبانی | `ticket.view` | `TicketsClient.tsx` |
| ۱۳ | `reports` | `/reports` | گزارش‌ساز پویا | `report.build` | `ReportBuilderClient.tsx` |
| ۱۴ | `help` | `/help` | راهنما و آموزش جامع | `help.view` | `HelpClient.tsx` |
| ۱۵ | `settings` | `/settings` | شخصی‌سازی تم و رابط | — (شخصی کاربر) | `SettingsFormClient.tsx` |
| ۱۶ | `admin-terminals` | `/admin/terminals` | مدیریت ترمینال‌ها | `terminal.view` | `TerminalsClient.tsx` |
| ۱۷ | `admin-lookups` | `/admin/lookups` | مدیریت مقادیر پویا | `lookups.manage` | `LookupsClient.tsx` |
| ۱۸ | `admin-branding` | `/admin/branding` | تنظیمات برندینگ | `branding.manage` | `BrandingClient.tsx` |
| ۱۹ | `admin-audit` | `/admin/audit` | لاگ وقایع سیستم | `audit.view` | `AuditClient.tsx` |
| ۲۰ | `admin-backup` | `/admin/backup` | پشتیبان‌گیری و بازیابی | `backup.manage` | `BackupClient.tsx` |

---

## ۲. تصمیمات فنی و روش‌های ممیزی (Technical Decisions & Methodology)

### تصمیم ۱: پروتکل ارزیابی رابط کاربری و عملکرد عملیاتی (UI Assessment Protocol)
- **تصمیم**: بررسی چندوجهی فرانت‌اند شامل:
  1. بررسی چیدمان راست‌چین (`dir="rtl"`) و عدم استفاده از کلاس‌های معکوس `ml/mr`.
  2. سلامت فونت و تایپوگرافی وزیرمتن و فرمت اعداد فارسی.
  3. بازخورد بصری دکمه‌ها (Hover، Active، Focus، Disabled).
  4. رفتار مودال‌ها، منوهای راست‌کلیک (Context Menu) و پایداری در تغییر تم تاریک/روشن.
- **دلیل انتخاب**: جلوگیری از هرگونه ناهنجاری ظاهری و تضمین ارگونومی کاربری در نمایشگرهای اتاق کنترل پایانه.

### تصمیم ۲: اعتبارسنجی منطق سرور و مهار استثناها (Backend Logic Verification)
- **تصمیم**: ارسال درخواست‌های سیستمی با داده‌های معتبر و داده‌های نامعتبر به Server Actionهای مربوط به هر منو (`src/app/actions/*`).
- **معیار پذیرش**:
  - بررسی صحت اسکیماهای Zod در لایه سرور.
  - احراز گارد دسترسی `hasPerm` برای توکن سشن.
  - بازگرداندن پاسخ ساختاریافته `{ success: boolean, data?: ..., error?: string }` بدون انتشار خطای کنترل‌نشده ۵۰۰.

### تصمیم ۳: راستی‌آزمایی پایداری پایگاه داده (Database Connectivity & Persistence Proof)
- **تصمیم**: ارتباط مستقیم با کلاینت Prisma (`src/lib/prisma.ts`) در حین تست‌ها و اجرای کوئری‌های تایید صحت پایداری داده پس از هر عملیات ثبت و ویرایش.
- **معیار پذیرش**:
  - عدم قفل شدن فایل SQLite و فعال بودن حالت WAL.
  - اعمال موفق تراکنش‌ها (`prisma.$transaction`).
  - خواندن داده از پایگاه داده و تطبیق دقیق فیلدها با مقادیر ارسالی.

### تصمیم ۴: متدولوژی سنجش سبکی و کارایی عملکردی (Lightness & Resource Efficiency)
- **تصمیم**: ارزیابی زمان بارگذاری اولیه و زمان بازخورد تعاملی (Response Latency) منوها تحت شرایط استاندارد.
- **آستانه‌های پذیرش**:
  - زمان لود اولیه منوها: کمتر از ۱.۵ ثانیه در محیط استاندارد.
  - زمان رندر جداول و داده‌ها: کمتر از ۵۰۰ میلی‌ثانیه.
  - عدم افت فریم یا توقف چرخه رویداد (No UI Event Loop Freezing).

### تصمیم ۵: چارچوب آزمون‌های تشخیصی (Diagnostic Framework)
- **تصمیم**: اجرای آزمون‌های تشخیصی ویژه شامل بررسی کش شبکه، پاک‌سازی نشست‌ها، تغییر وضعیت همزمان چند موجودیت (Concurrency Sanity)، و بررسی فایل‌های لاگ خطا در ران‌تایم.

---

## ۳. ساختار گزارش جامع نهایی (Final Report Architecture)

گزارش نهایی در یک سند مدون و استاندارد با سرفصل‌های زیر گردآوری می‌شود:
1. **شناسنامه و ماتریس وضعیت کلی ممیزی (Executive Summary)**
2. **جدول تفصیلی نتایج ۲۰ منوی سامانه** (شامل وضعیت UI، منطق بک‌اند، اتصال پایگاه داده و امتیاز سبکی)
3. **تحلیل یکپارچگی لایه‌های معماری سیستم**
4. **شواهد تست‌های تشخیصی و پایداری تراکنش‌ها**
5. **نقاط قوت، توصیه‌های بهینه‌سازی و نتیجه‌گیری نهایی**
