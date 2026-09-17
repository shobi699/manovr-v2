# Bug Fix: رفع خطای دیسک ۲۵۷۰ و پایداری دیتابیس مشترک شبکه سرور (SQLite Network Share Disk I/O Fix)

- **Slug**: database-server-falt
- **Fixed**: 2026-09-15T16:55:00+03:30
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

پایداری ارتباط با دیتابیس اشتراکی شبکه (`\\srvdfs01\Line1\Depo\data`) از طریق تغییر حالت ژورنال به `TRUNCATE`، اعمال `connection_limit=1` برای کلاینت‌ها، اصلاح جامع الگوهای خطای صف نوبت‌دهی (شامل `extended_code: 2570` و `disk i/o error`) با بازتلاش تصادفی تا ۶۰ ثانیه، سنجش واقعی تاخیر فایل‌سیستم شبکه و ابزار خودکار آزادسازی قفل پیاده‌سازی گردید.

## Changes

| File | Change | Notes |
|------|--------|-------|
| [`src/lib/prisma.ts`](file:///d:/Manovr/manovr-v2/src/lib/prisma.ts) | modified | افزودن تابع جامع `isSqliteLockOrIoError`، پیاده‌سازی `executeWithRetry`، اصلاح شرط صف نوبت‌دهی هوشمند برای تشخیص خطای ۲۵۷۰ انجین راست پریزما و تثبیت ژورنال مود `TRUNCATE` |
| [`main.js`](file:///d:/Manovr/manovr-v2/main.js) | modified | اضافه کردن پارامترهای `connection_limit=1` و `socket_timeout=60` به URL دیتابیس کلاینت‌ها جهت جلوگیری از سیل اتصالات به فایل شبکه |
| [`src/lib/network-status.ts`](file:///d:/Manovr/manovr-v2/src/lib/network-status.ts) | modified | ارتقای محاسبه پینگ با سنجش فیزیکی تاخیر دیسک شبکه سرور از طریق `stat` به جای کوئری رم `SELECT 1;` |
| [`src/app/actions/train.ts`](file:///d:/Manovr/manovr-v2/src/app/actions/train.ts) | modified | مجهز کردن `prisma.train.update` به بلوک محافظ `try/catch` برای جلوگیری از خروج ناخواسته کاربر یا نمایش خطای خام سیستمی |
| [`scripts/repair-network-db.mjs`](file:///d:/Manovr/manovr-v2/scripts/repair-network-db.mjs) | added | ابزار خودکار و مستقل جهت تبدیل دیتابیس شبکه سرور دپو از WAL به TRUNCATE، اجرای wal_checkpoint، حذف فایل‌های قفل سرگردان و تست سلامت |
| [`src/lib/__tests__/network-resilience.test.ts`](file:///d:/Manovr/manovr-v2/src/lib/__tests__/network-resilience.test.ts) | added | تست‌های واحد جامع برای راستی‌آزمایی تشخیص خطای ۲۵۷۰ از تصویر مانیتور کاربر و صحت چرخه بازتلاش |

## Diff Highlights (optional)

```typescript
// تشخیص دقیق خطای ۲۵۷۰ موتور SQLite و ویندوز SMB
export function isSqliteLockOrIoError(err: unknown): boolean {
  if (!err) return false;
  const rawMsg = typeof err === "string" ? err : String((err as any)?.message || "");
  const msg = rawMsg.toLowerCase();
  const code = String((err as any)?.code || "").toUpperCase();

  return (
    msg.includes("database is locked") ||
    msg.includes("sqlite_busy") ||
    msg.includes("extended_code: 2570") ||
    msg.includes("error code 2570") ||
    msg.includes("2570") ||
    msg.includes("disk i/o error") ||
    msg.includes("sqlite_ioerr") ||
    msg.includes("sharing violation") ||
    msg.includes("sharing_violation") ||
    code === "P2034" ||
    code === "P2028"
  );
}
```

## Tests Added or Updated

- `src/lib/__tests__/network-resilience.test.ts`:
  - `detects exact Prisma Rust engine extended_code 2570 error from screenshot`
  - `detects various SQLite lock, sharing violation and VFS delete errors`
  - `does not false-positive on standard non-lock business errors`
  - `retries an action that initially encounters 2570 lock error and then succeeds`
  - `immediately throws non-lock errors without retrying`

## Local Verification

- دستور اجرا: `npx vitest run src/lib/__tests__/network-resilience.test.ts` → ۵ آزمون با موفقیت ۱۰۰٪ پاس شد.
- دستور اجرا: `npx vitest run src/lib/__tests__` → ۴۰ فایل آزمون و ۲۳۸ تست سیستم بدون هیچ رگرسیونی با موفقیت ۱۰۰٪ پاس شدند.
- اجرای ابزار تعمیر روی فایل محلی: `node scripts/repair-network-db.mjs` → وضعیت ژورنال دیتابیس به `TRUNCATE` تثبیت شد و تست خواندن/نوشتن ۲ms تایید گردید.

## Deviations from Assessment

هیچ انحرافی وجود نداشت. تمام موارد تشخیصی و راه‌حل‌های ارائه شده در `assessment.md` عیناً و به طور کامل پیاده‌سازی شدند.

## Follow-ups

- در سرور سازمان مترو، فایل `scripts/repair-network-db.mjs` به صورت یک‌باره توسط مدیر سیستم بر روی دیتابیس شبکه اجرا شود:
  ```powershell
  node scripts/repair-network-db.mjs "\\srvdfs01\Line1\Depo\data\database\dev.db"
  ```
