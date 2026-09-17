# Bug Fix: نمایش عمومی منوی «درباره ما» در سایدبار و پاورقی کلیک‌پذیر

- **Slug**: abut-me
- **Fixed**: 2026-09-15T19:42:00+03:30
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary
محدودیت دسترسی مشروط از منوی «درباره ما» در سایدبار ناوبری حذف گردید تا این گزینه همانند «پروفایل من» و «شخصی‌سازی تم» برای ۱۰۰٪ کاربران و پرسنل پایانه بدون نیاز به مهاجرت دسترسی‌های دیتابیس نمایش یابد. همچنین متن نسخه در پاورقی سایدبار به یک لینک مستقیم به صفحه درباره ما تبدیل شد.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/components/Sidebar.tsx` | modified | حذف قید `perm: "about.view"` از آیتم ناوبری درباره ما، افزودن استثنای عمومی در `checkPermission`، و تبدیل پاورقی نسخه به لینک تعاملی `/about` |
| `src/lib/perms.ts` | modified | اضافه کردن بای‌پس در `hasPerm` تا برای درخواست‌های اعتبارسنجی `about.view` همواره مقدار `true` برای نشست معتبر بازگرداند |
| `src/lib/__tests__/sidebar-accordion.test.ts` | modified | بروزرسانی شمارنده آیتم‌های بخش تحلیل به ۱۱ و تست وجود روت `/about` |

## Diff Highlights
```diff
--- a/src/components/Sidebar.tsx
+++ b/src/components/Sidebar.tsx
@@ -58,7 +58,7 @@ const NAV_SECTIONS: NavSection[] = [
       { href: "/tickets", icKey: "Tickets", label: "تیکت‌های پشتیبانی", perm: "ticket.view" },
       { href: "/reports", icKey: "Reports", label: "گزارش‌ساز پویا", perm: "report.build" },
       { href: "/help", icKey: "Help", label: "راهنما و آموزش", perm: "help.view" },
-      { href: "/about", icKey: "Info", label: "درباره ما", perm: "about.view" },
+      { href: "/about", icKey: "Info", label: "درباره ما" },
       { href: "/settings", icKey: "Settings", label: "شخصی‌سازی تم" },
@@ -186,6 +186,7 @@ export default function Sidebar({
     const checkPermission = (perm?: string) => {
       if (role === 4) return true; // سوپرادمین به همه جا دسترسی دارد
       if (!perm) return true;
+      if (perm === "about.view") return true;
       if (perms.includes(perm)) return true;
@@ -512,12 +513,20 @@ export default function Sidebar({
-          {isCollapsed ? (
-            <span title="سامانه مانور نسخه ۰.۱.۲ (۱۴۰۵/۰۶/۲۵) — توسعه: سید شبیر موسوی">v0.1.2</span>
-          ) : (
-            <div>
-              سامانه مانور دپو · نسخه ۰.۱.۲
-              <div style={{ marginTop: "2px", fontSize: "9.5px", color: "var(--ink-faint)" }}>۲۵ شهریور ۱۴۰۵ · توسعه توسط سید شبیر موسوی</div>
-            </div>
-          )}
+          <Link
+            href="/about"
+            style={{
+              textDecoration: "none",
+              color: "inherit",
+              display: "block",
+              borderRadius: "6px",
+              padding: "4px",
+              transition: "background-color 0.2s, color 0.2s",
+            }}
+            title="مشاهده شناسنامه سامانه و اطلاعات درباره ما"
+          >
+            {isCollapsed ? (
+              <span title="سامانه مانور نسخه ۰.۱.۲ (۱۴۰۵/۰۶/۲۵) — توسعه: سید شبیر موسوی">v0.1.2</span>
+            ) : (
+              <div>
+                <span style={{ fontWeight: 600 }}>سامانه مانور دپو · نسخه ۰.۱.۲</span>
+                <div style={{ marginTop: "2px", fontSize: "9.5px", color: "var(--ink-faint)" }}>۲۵ شهریور ۱۴۰۵ · توسعه توسط سید شبیر موسوی</div>
+              </div>
+            )}
+          </Link>
```

## Tests Added or Updated
- `src/lib/__tests__/sidebar-accordion.test.ts` — بررسی دقیق حضور ۱۱ آیتم در بخش تحلیل و تنظیمات و اطمینان از قرارگیری گزینه `/about` در منو.

## Local Verification
- اجرای کامل مجموعه تست‌ها: `npm run test:run` → ۴۴ فایل تست و ۲۷۴ آزمون با موفقیت ۱۰۰٪ پاس شدند.
- بررسی تایپ‌اسکریپت: `npx tsc --noEmit` → بدون خطا (exit code 0).
- بیلد و بسته‌بندی کامل پروژه: `npm run build` و `node scripts/build.js --skip-next` → خروجی‌های نسخه ۰.۱.۲ در دایرکتوری `export/` بازسازی شدند.

## Deviations from Assessment
هیچ انحرافی وجود نداشت؛ تمامی اقدامات پیش‌بینی‌شده در ارزیابی اعمال گردید.

## Follow-ups
- اجرای آزمون صحت‌سنجی `/speckit-bug-test slug=abut-me`.
