# راهنمای اجرای آزمون‌های استرس و ساخت بسته‌های خروجی (Quickstart Guide: 003-packaging-network-resilience)

این راهنما مراحل گام‌به‌گام شبیه‌سازی شبکه با تاخیر، اجرای آزمون‌های همروندی دیتابیس و تولید بسته‌های نصبی و پرتابل را تشریح می‌کند.

---

## ۱. پیش‌نیازها

1. اطمینان از وجود حداقل ۳ گیگابایت فضای خالی در درایو `D:` برای دایرکتوری بیلد (`D:/manovr-build-dist`) و پوشه موقت (`D:/manovr-temp`).
2. فعال بودن وابستگی‌های `devDependencies` برای `electron` و `electron-builder`.

---

## ۲. گام‌های اجرا

### گام اول: اجرای آزمون همروندی در بستر تاخیر شبکه
اجرای آزمون استرس چندکاربره با پینگ نامساعد:
```bash
npm run test:run -- src/lib/__tests__/terminal-stress-concurrency.test.ts
```

### گام دوم: اجرای بیلد سرور مستقل Next.js و آماده‌سازی بسته‌ها
```bash
npm run build
```

### گام سوم: اجرای خط تولید الکترون و استخراج خروجی‌ها
تولید همزمان سه فرمت نصبی (NSIS)، پرتابل (Portable)، و اکسترکت‌شده (Unpacked):
```bash
node scripts/build.js
```
یا تولید مجزای بسته‌ها:
- بسته اکسترکت‌شده نصبی: `npm run package:unpacked`
- بسته فایل نصبی ویزاردی: `npm run package:installer`
- بسته فایل پرتابل مستقل: `npm run package:portable`

### گام چهارم: الحاق مستندات آموزشی و بررسی پوشه توزیع
کپی خودکار فایل‌های راهنما به مسیر `D:/manovr-build-dist`:
- `ManovrSystem-Setup.exe` (فایل نصبی)
- `ManovrSystem-Portable.exe` (فایل پرتابل)
- پوشه `win-unpacked/` (فایل‌های اکسترکت‌شده)
- `USER_GUIDE.md` و راهنمای استقرار در شبکه
