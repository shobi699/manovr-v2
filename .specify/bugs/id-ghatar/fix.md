# Bug Fix: ارتقای جامع کارنامه عملکرد ناوگان، جدول ماتریسی قطارها، فیلترهای اکسل‌گونه و چاپ اختصاصی

- **Slug**: id-ghatar
- **Fixed**: 2026-09-18T09:35:00+03:30
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

تب گزارش عملکرد ناوگان در منوی مانورها (`/manovrs`) به طور بنیادین به یک داشبورد ماتریسی قطارمحور با فیلترهای سبک اکسل در سرستون‌ها، انتخابگر ناوگان جستجوپذیر، مودال جامع ریز مانورها، پوشش تمامی ۱۹ نوع مانور و چاپ ایزوله اختصاصی ارتقا یافت. مشکل عدم نمایش مانورها هنگام انتخاب شماره قطار نیز با تنظیم بازه پیش‌فرض روی «کل تاریخچه» و نمایش بنر برجسته تقویم جلالی برطرف گردید.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/lib/train-performance.ts` | Modified | افزودن اینترفیس `TrainMatrixRow`، گسترش `TrainPerformanceStats` با ماتریس قطارها، لیست انواع مانورها و برچسب تاریخ جلالی موثر |
| `src/app/actions/train-performance.ts` | Modified | محاسبه ماتریس عملکرد سطر به سطر قطارها، تجمیع مانورها، استخراج بازه موثر شمسی و واکشی نام تمام انواع مانورها از لوک‌آپ‌های سامانه |
| `src/app/(main)/manovrs/components/TrainSearchableCombobox.tsx` | Added | انتخابگر ناوگان جستجوپذیر با قابلیت تایپ شماره قطار، فیلتر آنی نوع (AC/DC/دیزل) و دکمه پاکسازی |
| `src/app/(main)/manovrs/components/TrainColumnFilterPopover.tsx` | Added | کامپوننت فیلتر اکسل‌گونه سرستون‌ها با چک‌باکس انتخاب مقادیر و مرتب‌سازی صعودی/نزولی |
| `src/app/(main)/manovrs/components/TrainPerformanceDrilldownModal.tsx` | Added | پنجره مودال تعاملی سوابق ریز مانورهای یک قطار با جدول جزئیات، سرچ داخلی و خروجی اکسل اختصاصی |
| `src/app/(main)/manovrs/TrainPerformanceView.tsx` | Modified | بازنویسی کامل با جدول ماتریسی قطارمحور، ایزولاسیون چاپ اختصاصی (`@media print`)، بنر تاریخ جلالی، و فوتر جمع کل |
| `src/lib/__tests__/train-performance.test.ts` | Modified | آزمون‌های تکمیلی برای تبدیل تاریخ و عملکرد توابع کارنامه قطارها |

## Diff Highlights

### ۱. ایزولاسیون اختصاصی محدوده چاپ
```css
@media print {
  body * {
    visibility: hidden !important;
  }
  #train-performance-print-area,
  #train-performance-print-area * {
    visibility: visible !important;
  }
  #train-performance-print-area {
    position: absolute !important;
    inset-inline-start: 0 !important;
    top: 0 !important;
    width: 100% !important;
  }
}
```

### ۲. ساختار ماتریس عملکرد قطارمحور
```typescript
export interface TrainMatrixRow {
  trainId: number;
  trainCode: string;
  trainType: number;
  trainStatus: number;
  currentLineName: string;
  totalManovrs: number;
  byDetailedType: Record<number, number>;
  byCategory: { lineChange: number; permanent: number; exit: number; normal: number };
  manovrs: TrainPerformanceManovrItem[];
}
```

## Tests Added or Updated

- `src/lib/__tests__/train-performance.test.ts`: آزمون‌های بررسی قالب تاریخ شمسی تهران (`toTehranJalali`) با اعداد فارسی و رفتار با مقادیر نامعتبر، به همراه آزمون‌های تفکیک و دسته‌بندی مانورها.

## Local Verification

- **بیلد پروژه (`npm run build`)**: با موفقیت کامل با توربوپک و TypeScript بدون خطا کامپایل شد (`Exit Code: 0`).
- **سوئیت کامل آزمون‌ها (`npx vitest run`)**: تمام **۴۵ فایل تست** و **۲۸۷ آزمون واحد** با موفقیت ۱۰۰٪ پاس شدند.

## Deviations from Assessment

هیچ انحرافی وجود ندارد؛ تمامی الزامات ارزیابی و درخواست‌های کاربر به صورت کامل و نهایی پیاده‌سازی شدند.
