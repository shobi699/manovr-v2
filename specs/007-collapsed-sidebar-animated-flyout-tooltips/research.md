# یافته‌های فنی و معماری: تول‌تیپ‌های شناور انیمیشنی سایدبار
# Technical Research: Animated Flyout Tooltips for Collapsed Navigation

## ۱. ارزیابی ساختار فعلی کانتینر سایدبار و مسئله Overflow

در فایل `src/app/globals.css`:
- `.shell.collapsed-sidebar .sidebar` دارای عرض ثابت `74px` و دستور `overflow-x: hidden` است.
- کانتینر `.nav` دارای `overflow-y: auto` است تا در رزولوشن‌های کم منو قابلیت اسکرول داشته باشد.
- **نتیجه فنی**: طبق مشخصات استاندارد CSS W3C (CSS Overflow Module Level 3)، هر فرزندی که دارای `position: absolute` باشد و خارج از کادر والد با `overflow: hidden/auto` قرار گیرد، توسط مرورگر بریده می‌شود (Clipped).
- **راه‌حل آزمایش‌شده**: استفاده از React Portal (`createPortal(..., document.body)`). این روش کامپوننت شناور را مستقیماً به ریشه DOM منتقل کرده و آن را با `position: fixed` به همراه محاسبات `getBoundingClientRect()` لنگر متصل می‌کند.

## ۲. مشخصات هندسی و موقعیت‌یابی در RTL / LTR

برای اینکه تول‌تیپ هم‌تراز با وسط آیکون باز شود:
```typescript
const rect = anchorElement.getBoundingClientRect();
const tooltipTop = rect.top + rect.height / 2; // استفاده از transform: translateY(-50%)
```

برای موقعیت افقی:
- اگر جهت سایدبار راست باشد (`navPos === "right"`):
  تول‌تیپ باید در سمت چپ سایدبار باز شود:
  `style.right = window.innerWidth - rect.left + 12px` (یا معادل با کلاس چپ‌چین)
- اگر جهت سایدبار چپ باشد (`navPos === "left"`):
  تول‌تیپ باید در سمت راست سایدبار باز شود:
  `style.left = rect.right + 12px`

## ۳. کتابخانه انیمیشن و رفتار Micro-Animation

پروژه مانور از پکیج `motion/react` استفاده می‌کند که برای ری‌اکت ۱۹ و Next.js مدرن بهینه‌سازی شده است.
- زمان ورود: `0.08` تا `0.12` ثانیه (زیر ۱۰۰-۱۲۰ میلی‌ثانیه برای پاسخ‌دهی بلادرنگ)
- انتقال موقعیت: در جهت RTL یک حرکت ظریف ۸ پیکسلی از راست به چپ (`x: 8 -> 0`) به همراه فید `opacity: 0 -> 1` و مقیاس `scale: 0.96 -> 1`.
- هنگام خروج: محو شدن آنی (`duration: 0.08s`) بدون باقی‌ماندن کارت روی صفحه هنگام اسکرول یا جابجایی ماوس.

## ۴. دسترس‌پذیری کیبورد (Accessibility / a11y)

تول‌تیپ علاوه بر `onMouseEnter` / `onMouseLeave`، باید رویدادهای `onFocus` و `onBlur` المان لنگر را نیز ثبت کند. بدین ترتیب کاربرانی که با کلید `Tab` کیبورد روی آیکون‌ها حرکت می‌کنند، دقیقاً همان تجربه شناور و راهنمای تصویری را دریافت خواهند کرد.
همچنین شناسه `role="tooltip"` روی المان پرتال قرار می‌گیرد.
