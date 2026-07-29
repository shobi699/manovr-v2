// مرجع کدهای سیستم — استخراج‌شده از enumهای نرم‌افزار اصلی

export const ManovrType: Record<number, string> = {
  1: "دیزل",
  2: "انتقال قطار",
  3: "تارواش / مثلث",
  4: "استاتیک",
  5: "تست خط",
  6: "تست حرکت",
  7: "دوار",
  8: "تست خط اصلی",
  9: "انتقال به واگن‌سازی",
  10: "بین خطوط",
  11: "بادگیری",
  12: "خط اصلی دیزل",
  13: "ورودی شهرری",
  14: "ورودی کهریزک",
  15: "ورودی شهرآفتاب",
  16: "خروجی شهرری",
  17: "خروجی کهریزک",
  18: "خروجی شهرآفتاب",
  19: "تعویض قطار",
  20: "تعویض کفشک",
  21: "انتقال دائم به سایر خطوط",
  22: "انتقال دائم به واگن‌سازی",
  23: "سایر انتقال‌های دائم",
  24: "انتقال دائم",
};

export const ManovrStatus: Record<number, string> = {
  1: "شروع‌شده",
  2: "پایان‌یافته",
  3: "حذف‌شده",
};

export const ConfirmationStatus: Record<number, string> = {
  1: "تأیید",
  2: "رد",
  3: "بدون تأیید",
};

export const Role: Record<number, string> = {
  0: "بدون دسترسی",
  1: "ادمین",
  2: "مسئول",
  3: "مشاهده",
  4: "تکنسین",
};

export const OrgPosition: Record<number, string> = {
  1: "راهبر",
  2: "مسئول",
  3: "ادمین",
  4: "سایر",
  5: "تکنسین اعزام پذیرش",
  6: "مدیر",
  7: "رییس",
};

export const Terminal: Record<number, string> = {
  1: "دیزل‌شاپ",
  2: "واگن‌سازی",
  3: "خط اصلی",
  4: "پارکینگ شمالی",
  5: "پارکینگ جنوبی",
  6: "فرعی ۱",
  7: "فرعی ۲",
  8: "سایر خطوط",
};

export const TrainType: Record<number, string> = {
  0: "AC",
  1: "DC",
  2: "دیزل",
};

export const Shift: Record<number, string> = {
  1: "A",
  2: "B",
  3: "C",
  4: "ستادی",
};

export const WorkPlace: Record<number, string> = {
  1: "مهرآباد",
  2: "فتح‌آباد",
};

export const PersonnelType: Record<number, string> = {
  1: "مانور",
  2: "پایانه",
};

export const ROLE_ADMIN = 1;
export const ROLE_RESPONSIBLE = 2;
export const ROLE_VIEWER = 3;
export const ROLE_SUPERADMIN = 4;

// آیا کاربر اجازه‌ی ثبت/ویرایش مانور دارد؟ (ادمین یا مسئول)
export function canWriteManovr(role: number) {
  return role === ROLE_ADMIN || role === ROLE_RESPONSIBLE || role === ROLE_SUPERADMIN;
}
export function isAdmin(role: number) {
  return role === ROLE_ADMIN || role === ROLE_SUPERADMIN;
}
