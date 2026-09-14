# برنامه فنی پیاده‌سازی: بهبود عملیات مانور سریع و اعتبارسنجی خطوط پایانه (Implementation Plan: Depot Line Quick Shunting)

**شاخه ویژگی**: `001-depot-line-manovr` | **تاریخ**: ۱۴۰۵/۰۶/۲۵ | **سند مشخصات**: [spec.md](./spec.md)  
**ورودی**: سند مشخصات از مسیر `/specs/001-depot-line-manovr/spec.md`

---

## ۱. خلاصه فنی و رویکرد معماری (Technical Summary & Approach)

این قابلیت امکان صدور دستور مانور سریع، انتقال ایمن قطار و اعتبارسنجی همزمان ظرفیت خط مقصد را درون مودال [DepotLineDetailsModal](file:///d:/Manovr/manovr-v2/src/app/%28main%29/depot/modals/DepotLineDetailsModal.tsx) محقق می‌سازد. منطق بک‌اند از طریق اکشن سرور `createManovr` در [src/app/actions/manovr.ts](file:///d:/Manovr/manovr-v2/src/app/actions/manovr.ts) و با بررسی مجوز `MANOVR_CREATE` و محاسبات زمانی تقویم شمسی تهران پیاده‌سازی شده است.

---

## ۲. ارزیابی گیت‌های قانون اساسی مانور (Constitution Gates Check)

*ارزیابی انطباق کامل با قانون اساسی مهندسی سیستم مانور:*

| گیت قانون اساسی | معیار ارزیابی | وضعیت انطباق (Pass/Fail) | ملاحظات فنی |
|-----------------|----------------|--------------------------|-------------|
| **گیت ۱: پروتکل Tri-Sync** | نیازمندی مجوزها و همگام‌سازی آموزش | ✅ Pass | مجوزهای `MANOVR_CREATE` و `LINE_MANAGE` در `perms.ts` ثبت و در راهنمای پایانه بیش از ۱۰۰۰ کاراکتر مستند شده است. |
| **گیت ۲: استانداردهای RTL** | طراحی راست‌چین و کلاس‌های منطقی | ✅ Pass | کامپوننت با `dir="rtl"` و کلاس‌های `ms-*` و `me-*` پیاده شده است. |
| **گیت ۳: تایپ‌استریکت و Zod** | اعتبار داده در ران‌تایم و امنیت تایپ | ✅ Pass | اسکیماهای Zod برای ورودی فرم مانور فعال هستند. |
| **گیت ۴: زمان تهران و تقویم شمسی** | منطقه زمانی `Asia/Tehran` | ✅ Pass | دیت‌پیکر شمسی [JalaliDateTimePicker](file:///d:/Manovr/manovr-v2/src/components/JalaliDateTimePicker.tsx) استفاده شده است. |
| **گیت ۵: شخصی‌سازی مدیر** | عدم هاردکد کردن مقادیر | ✅ Pass | مقادیر زمان پیش‌فرض و نوع مانور از جدول لایسنس و لوکاپ خوانده می‌شوند. |
| **گیت ۶: آزمون‌های Playwright** | تست با اثبات پایداری داده | ✅ Pass | تست‌های E2E مانور در `e2e/desktop/` پایداری داده در بک‌اند را اثبات می‌کنند. |
| **گیت ۷: خروجی اکسل/PDF** | فرمت‌بندی بومی‌سازی‌شده | ✅ Pass | گزارش مانورها دارای خروجی اکسل راست‌چین است. |

---

## ۳. بستر و پشته فنی (Technical Context)

- **فریم‌ورک**: Next.js App Router (React 19 + TypeScript Strict + Tailwind CSS)
- **پایگاه داده**: Prisma ORM با جداول `Manovr`، `Line`، `Train`، `User`
- **احراز هویت و مجوز**: Jose JWT و تابع `hasPerm(session, "MANOVR_CREATE")`
- **تست‌ها**: Playwright E2E + Vitest Unit Tests

---

## ۴. ساختار فایل‌ها و مسیرهای سورس‌کد (Project Structure)

```text
src/
├── app/
│   ├── (main)/depot/
│   │   ├── DepotScene.tsx                     # صفحه اصلی پایانه
│   │   └── modals/DepotLineDetailsModal.tsx   # مودال تعاملی خطوط و صدور مانور سریع
│   └── actions/
│       └── manovr.ts                          # اکشن‌های سرور صدور و تایید مانور
├── lib/
│   ├── perms.ts                               # کلیدهای امنیتی و گروه‌های دسترسی
│   └── help-menu-guides.ts                    # راهنمای فنی پایانه و مانور (> ۱۰۰۰ کاراکتر)
└── components/
    └── JalaliDateTimePicker.tsx               # انتخابگر زمان و تاریخ جلالی
e2e/desktop/
└── depot-workflow.spec.ts                     # تست‌های جامع گردش‌کار پایانه
```

---

## ۵. ردیابی پیچیدگی (Complexity Tracking)

هیچ انحرافی از معماری استاندارد و اصول قانون اساسی سیستم مشاهده نشد.
- گیت‌های قانون اساسی: **۱۰۰٪ تایید شده**.
