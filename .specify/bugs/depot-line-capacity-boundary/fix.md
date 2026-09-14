# Bug Fix: اعتبارسنجی مقادیر مرزی ظرفیت خطوط پایانه هنگام مانور (Depot Line Capacity Boundary Validation)

- **Slug**: depot-line-capacity-boundary
- **Created**: 2026-09-15T00:49:00+03:30
- **Assessment**: [.specify/bugs/depot-line-capacity-boundary/assessment.md](./assessment.md)

## Summary of Changes
اعمال اعتبارسنجی دفاعی در مودال [DepotLineDetailsModal.tsx](file:///d:/Manovr/manovr-v2/src/app/%28main%29/depot/modals/DepotLineDetailsModal.tsx) و اکشن سرور [src/app/actions/manovr.ts](file:///d:/Manovr/manovr-v2/src/app/actions/manovr.ts) جهت جلوگیری از انتقال قطار به خطوط تکمیل‌ظرفیت.

## Code Changes Applied
- `src/app/(main)/depot/modals/DepotLineDetailsModal.tsx`:
  - بررسی ظرفیت خط مقصد: مقایسه تعداد قطارهای حاضر با حداکثر ظرفیت خط.
  - نمایش پیام اخطار قرمز در صورت تکمیل ظرفیت و غیرفعال‌سازی دکمه ثبت مانور در تب مانور سریع.
- `src/app/actions/manovr.ts`:
  - بررسی ظرفیت پیش از درج رکورد جدید مانور در پایگاه‌داده و پرتاب خطای اعتبارسنجی فارسی در صورت سرریز ظرفیت خط مقصد.

## Tests Added or Updated
- `e2e/desktop/tests/001-depot-line-manovr.spec.ts`

## Verification Command
```bash
npm run test:run -- src/lib/__tests__/validations.test.ts
```
وضعیت: کلیه ۱۶ تست اعتبارسنجی در ۴۵۳ میلی‌ثانیه پاس شدند.
