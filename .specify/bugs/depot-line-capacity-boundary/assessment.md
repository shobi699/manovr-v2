# Bug Assessment: اعتبارسنجی مقادیر مرزی ظرفیت خطوط پایانه هنگام مانور (Depot Line Capacity Boundary Validation)

- **Slug**: depot-line-capacity-boundary
- **Created**: 2026-09-15T00:48:00+03:30
- **Source**: گزارش ممیزی تست‌های مانور پایانه (Pasted Text)
- **Verdict**: valid
- **Severity**: medium

## Report (verbatim or summarized)
در صورتی که ظرفیت یک خط ریلی به حداکثر تعداد مجاز قطار برسد، ارسال دستور مانور جدید به مقصد آن خط باید بلافاصله با خطای اعتبارسنجی در کلاینت و سرور متوقف شود و اجازه ثبت مانور داده نشود تا از مسدودی خط جلوگیری گردد.

## Symptom
هنگامی که خط مقصد دارای صفر اسلات خالی است، فرم مانور باید ارسال درخواست را متوقف کرده و خطای فارسی شفاف به کاربر نمایش دهد.

## Reproduction
1. ورود به صفحه `/depot`.
2. کلیک روی خطی که تمام اسلات‌های آن اشغال است (تعداد قطار مساوی با ظرفیت).
3. تلاش برای انتخاب این خط به عنوان خط مقصد در مودال صدور مانور `DepotLineDetailsModal`.

## Suspected Code Paths
- `src/app/(main)/depot/modals/DepotLineDetailsModal.tsx:71` — مدیریت انتخاب خط مقصد و اعتبارسنجی کلاینت
- `src/app/actions/manovr.ts:createManovr` — اعتبارسنجی سرور و گارد ظرفیت خط

## Root Cause Hypothesis
در کلاینت، چک کردن متراژ و تعداد اسلات در برخی سناریوها فقط به عنوان هشدار بصری نمایش داده می‌شد بدون اینکه دکمه ثبت مانور را به طور کامل غیرفعال (disable) کند. اطمینان بالا (High Confidence).

## Proposed Remediation
**Preferred**:
در [DepotLineDetailsModal](file:///d:/Manovr/manovr-v2/src/app/%28main%29/depot/modals/DepotLineDetailsModal.tsx)، در صورت اشغال بودن تمام اسلات‌های خط مقصد انتخابی، پیام خطای صریح قرمز رنگ نشان داده شده و دکمه ثبت مانور `disabled` گردد. همچنین در `createManovr` اکشن سرور، یک چک دفاعی با پرتاب خطای فارسی در صورت سرریز ظرفیت اعمال شود.

**Files likely to change**:
- `src/app/(main)/depot/modals/DepotLineDetailsModal.tsx`
- `src/app/actions/manovr.ts`

**Tests to add or update**:
- `e2e/desktop/tests/001-depot-line-manovr.spec.ts`

## Risks & Considerations
- هیچ ریسک مهاجرت پایگاه داده وجود ندارد. تغییر کاملاً غیرمخرب و محافظتی است.

## Open Questions
- هیچ سوال بازی وجود ندارد؛ رفتار مطابق استانداردهای ایمنی خطوط ریلی است.
