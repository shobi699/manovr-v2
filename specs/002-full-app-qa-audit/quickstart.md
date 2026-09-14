# راهنمای اعتبارسنجی و اجرای ممیزی جامع سامانه (Quickstart Validation Guide: full-app-qa-audit)

این راهنما مراحل اجرای سرتاسری ممیزی، راستی‌آزمایی لایه‌ها و استخراج گزارش نهایی کیفیت پایانه را تبیین می‌کند.

---

## ۱. پیش‌نیازها و محیط اجرا (Prerequisites)

1. سرور محلی سیستم باید فعال باشد (`npm run dev` در پورت ۳۰۰۰).
2. پایگاه داده پایانه آماده و مهاجرت‌ها اعمال شده باشند (`npx prisma db push`).
3. متغیرهای محیطی در فایل `.env` بارگذاری شده باشند.

---

## ۲. گام‌های اجرای ممیزی (Execution Steps)

### گام اول: بررسی سلامت اتصال و زیرساخت پایگاه داده (Database Sanity Check)
اجرای آزمون پایه‌ای ارتباط با پایگاه داده و سلامت مدل‌ها:
```bash
npm run test:run -- src/lib/__tests__/perms.test.ts src/lib/__tests__/validations.test.ts
```
*نتیجه مورد انتظار*: کلیه آزمون‌های اسکیما و کلاینت پاس شوند.

### گام دوم: ممیزی سیستماتیک منوها و تعاملات لایه رابط کاربری (UI & Menu Crawl)
پیمایش ۲۰ منوی سامانه به ترتیب اولویت با ابزار ارزیابی خودکار و ثبت بازخوردهای بصری:
```bash
npx playwright test e2e/desktop/tests/001-depot-line-manovr.spec.ts --config=e2e/desktop/playwright.config.ts
```

### گام سوم: اعتبارسنجی لایه‌های منطقی سرور (Server Actions & Zod)
آزمون رفتار لایه‌های منطقی و اکشن‌های سرور در اعتبارسنجی ورودی‌های معتبر و مهار ورودی‌های نامعتبر:
```bash
npm run test:run -- src/app/actions/__tests__/manovr-actions.test.ts src/app/actions/__tests__/user-actions.test.ts
```

### گام چهارم: سنجش سبکی، کارایی و آزمون‌های تشخیصی (Lightness & Diagnostics)
بررسی زمان پاسخ‌دهی و پایش روانی منوها در تعاملات چندکاربره و پرسنلی:
```bash
npm run test:run -- src/lib/__tests__/terminal-stress-concurrency.test.ts
```

### گام پنجم: گردآوری و استخراج گزارش جامع ممیزی
مطابق قرارداد [`contracts/menu-audit-contract.md`](./contracts/menu-audit-contract.md) و اسکیمای [`contracts/audit-report-schema.json`](./contracts/audit-report-schema.json)، ماتریس نتایج ۲۰ منو در سند نهایی گزارش ممیزی گردآوری و ارزیابی نهایی صادر می‌گردد.
