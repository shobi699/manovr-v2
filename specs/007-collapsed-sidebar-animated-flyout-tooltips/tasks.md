# فهرست وظایف اجرایی: تول‌تیپ‌ها و پیش‌نمایش‌های انیمیشنی شناور برای آیکون‌های سایدبار جمع‌شده
# Tasks: Animated Flyout Tooltips & Badges for Collapsed Sidebar Navigation

**شناسه ویژگی**: `007-collapsed-sidebar-animated-flyout-tooltips`  
**ورودی**: اسناد طراحی از مسیر `/specs/007-collapsed-sidebar-animated-flyout-tooltips/`  
**پیش‌نیازها**: [plan.md](file:///d:/Manovr/manovr-v2/specs/007-collapsed-sidebar-animated-flyout-tooltips/plan.md)، [spec.md](file:///d:/Manovr/manovr-v2/specs/007-collapsed-sidebar-animated-flyout-tooltips/spec.md)

---

## فاز ۱: ایجاد کامپوننت هسته و سیستم شناور (Phase 1: Core Tooltip Component & Portal)
**هدف**: ساخت پرتال سبک، ایزوله و پرسرعت برای نمایش بدون بریدگی در `document.body`

- [x] T001 [P] ساخت کامپوننت `SidebarFlyoutTooltip.tsx` در `src/components/SidebarFlyoutTooltip.tsx` با قابلیت `createPortal`، انیمیشن‌های شتاب‌یافته `motion/react`، طراحی لوکس شیشه‌ای (Glassmorphism)، پیکان نشانگر متصل، و پشتیبانی هوشمند از راست‌چین (`dir="rtl"`) و حالت‌های ناوبری راست/چپ.
- [x] T002 [P] تدوین آزمون‌های جامع واحد در `src/lib/__tests__/sidebar-flyout-tooltip.test.ts` برای ارزیابی رندرینگ در پرتال، محاسبات دقیق موقعیت، برچسب‌ها و واکنش به رویدادهای ماوس و کیبورد.

---

## فاز ۲: اتصال به منوهای اصلی و زیرمنوها (Phase 2: Menu Items Integration)
**هدف**: جایگزینی کامل عنوان‌های بومی `title` با کارت‌های انیمیشنی شناور برای کلیه منوها

- [x] T003 [US1, US2, US3, US4] پیاده‌سازی هوک و وضعیت مدیریت نمایش شناور در `src/components/Sidebar.tsx` و اتصال آن به آیکون‌های بخش‌های «عملیات پایانه» و «اطلاعات پایه» در حالت `isCollapsed === true`.
- [x] T004 [US5] اتصال کارت شناور به دکمه تنظیمات چرخ‌دنده و زیرمنوهای آکاردئون «تحلیل و تنظیمات» به همراه نمایش وضعیت باز/بسته بودن و برچسب‌های تفکیک‌شده.
- [x] T005 [US6, US9] پشتیبانی کامل از دسترسی‌پذیری کیبورد (`focus / blur` روی Tab) و نمایش برجسته وضعیت صفحه فعال جاری (`isActive`) در نشانگر کارت شناور.

---

## فاز ۳: المان‌های کنترلی و فوتر سایدبار (Phase 3: Controls, Header & Footer Integration)
**هدف**: پوشش تام تمام آیکون‌های باقی‌مانده سایدبار جمع‌شده

- [x] T006 [US10, US11, US12] اتصال کارت شناور به لوگوی بالای سایدبار، دکمه تغییر اندازه/گسترش منو، نشانگر وضعیت سرور پایانه، دکمه قرمز هشداردهنده خروج (`Logout`) و شماره نسخه پایانه در فوتر سایدبار.

---

## فاز ۴: تضمین کیفیت، تست و تحویل (Phase 4: Quality Assurance & Build)
**هدف**: ارزیابی صحت عملکرد، گذر از بیلد و تست‌های سیستم

- [x] T007 اجرای آزمون‌های خودکار Vitest (`npx vitest run`) و اطمینان از پاس شدن ۱۰۰٪ تست‌ها (۴۶ فایل تست و ۲۹۲ آزمون با موفقیت پاس شدند).
- [x] T008 اجرای تست بیلد کامل پروژه (`npm run build`) با موتور توربوپک بدون هیچ خطا یا اخطار هیدریشن.
