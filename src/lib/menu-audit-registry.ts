export interface MenuItemDefinition {
  id: string;
  title: string;
  route: string;
  category: "OPERATIONS" | "FLEET" | "PERSONNEL" | "SUPPORT" | "ADMIN";
  requiredPerm?: string;
  descriptionFa: string;
}

export const ALL_AUDIT_MENUS: MenuItemDefinition[] = [
  // ماژول‌های عملیات مانور و پایانه
  {
    id: "depot",
    title: "نمای پایانه",
    route: "/depot",
    category: "OPERATIONS",
    requiredPerm: "depot.view",
    descriptionFa: "نمای سه‌بعدی و دوبعدی خطوط، قطارهای متوقف و مانور سریع در پایانه",
  },
  {
    id: "dashboard",
    title: "داشبورد و آمار",
    route: "/dashboard",
    category: "OPERATIONS",
    requiredPerm: "dashboard.view",
    descriptionFa: "شاخص‌های کلیدی عملکرد، تعداد مانورها، وضعیت خطوط و ناوگان",
  },
  {
    id: "manovrs-approvals",
    title: "تأیید و کنترل مانورها",
    route: "/manovrs/approvals",
    category: "OPERATIONS",
    requiredPerm: "manovr.confirm",
    descriptionFa: "کارتابل تایید دو مرحله‌ای مانورها توسط کشیک و متصدی ارشد پایانه",
  },
  {
    id: "manovrs-history",
    title: "تاریخچه مانورها",
    route: "/manovrs",
    category: "OPERATIONS",
    requiredPerm: "manovr.view",
    descriptionFa: "فهرست جامع کلیه مانورهای ثبت‌شده با قابلیت فیلتر زمانی و استخراج گزارش",
  },
  {
    id: "manovrs-new",
    title: "ثبت مانور جدید",
    route: "/manovrs/new",
    category: "OPERATIONS",
    requiredPerm: "manovr.create",
    descriptionFa: "فرم ثبت دستور مانور با انتخاب قطار، خط مبدا، خط مقصد و راننده مانور",
  },

  // ماژول‌های مدیریت ناوگان و زیرساخت
  {
    id: "trains",
    title: "مدیریت قطارها",
    route: "/trains",
    category: "FLEET",
    requiredPerm: "train.view",
    descriptionFa: "فهرست واگن‌ها و قطارهای فعال، متوقف، اعزامی و تحت تعمیر",
  },
  {
    id: "lines",
    title: "مدیریت خطوط ریل",
    route: "/lines",
    category: "FLEET",
    requiredPerm: "line.view",
    descriptionFa: "وضعیت خطوط ریل پایانه، ظرفیت خط، انسداد و اختصاص قطارها",
  },

  // ماژول‌های پرسنل و دسترسی‌ها
  {
    id: "users",
    title: "کاربران و پرسنل",
    route: "/users",
    category: "PERSONNEL",
    requiredPerm: "user.view",
    descriptionFa: "مدیریت حساب‌های کاربری پرسنل پایانه، رانندگان و متصدیان مانور",
  },
  {
    id: "roles",
    title: "مدیریت نقش‌ها",
    route: "/roles",
    category: "PERSONNEL",
    requiredPerm: "role.view",
    descriptionFa: "تعریف نقش‌ها و تخصیص ماتریس اختیارات و دسترسی‌های سه‌گانه",
  },
  {
    id: "phonebook",
    title: "دفتر تلفن پرسنل",
    route: "/phonebook",
    category: "PERSONNEL",
    requiredPerm: "phonebook.view",
    descriptionFa: "فهرست تماس مستقیم پرسنل و مسئولین کشیک و واحدهای پایانه",
  },
  {
    id: "profile",
    title: "پروفایل من",
    route: "/profile",
    category: "PERSONNEL",
    descriptionFa: "نمایش مشخصات پرسنلی، تغییر رمز عبور و اطلاعات حساب کاربر جاری",
  },

  // ماژول‌های پشتیبانی، گزارش‌گیری و آموزش
  {
    id: "tickets",
    title: "تیکت‌های پشتیبانی",
    route: "/tickets",
    category: "SUPPORT",
    requiredPerm: "ticket.view",
    descriptionFa: "سامانه ثبت و پیگیری درخواست‌های فنی و تیکت‌های پرسنلی پایانه",
  },
  {
    id: "reports",
    title: "گزارش‌ساز پویا",
    route: "/reports",
    category: "SUPPORT",
    requiredPerm: "report.build",
    descriptionFa: "طراحی، تولید و استخراج گزارش‌های آماری و عملیاتی با خروجی اکسل و PDF",
  },
  {
    id: "help",
    title: "راهنما و آموزش",
    route: "/help",
    category: "SUPPORT",
    requiredPerm: "help.view",
    descriptionFa: "دانشنامه فنی و راهنمای جامع منوهای بیست‌گانه سامانه پایانه",
  },
  {
    id: "settings",
    title: "شخصی‌سازی تم",
    route: "/settings",
    category: "SUPPORT",
    descriptionFa: "تنظیمات بصری کاربر، انتخاب تم تاریک یا روشن و پوسته سامانه",
  },

  // ماژول‌های مدیریتی ادمین پایانه
  {
    id: "admin-terminals",
    title: "مدیریت ترمینال‌ها",
    route: "/admin/terminals",
    category: "ADMIN",
    requiredPerm: "terminal.view",
    descriptionFa: "تنظیمات و اطلاعات پایانه‌های مترو شامل پایانه فتح‌آباد",
  },
  {
    id: "admin-lookups",
    title: "مدیریت مقادیر پویا",
    route: "/admin/lookups",
    category: "ADMIN",
    requiredPerm: "lookups.manage",
    descriptionFa: "مدیریت انواع مانور، دلایل تاخیر، عناوین شغلی و مقادیر داینامیک",
  },
  {
    id: "admin-branding",
    title: "تنظیمات برندینگ",
    route: "/admin/branding",
    category: "ADMIN",
    requiredPerm: "branding.manage",
    descriptionFa: "شخصی‌سازی عنوان پایانه، لوگو، متون فوتر و هویت سازمانی",
  },
  {
    id: "admin-audit",
    title: "لاگ وقایع سیستم",
    route: "/admin/audit",
    category: "ADMIN",
    requiredPerm: "audit.view",
    descriptionFa: "ثبت و پایش وقایع امنیتی، لاگین کاربران، تغییرات نقش و مانورها",
  },
  {
    id: "admin-backup",
    title: "پشتیبان‌گیری سیستم",
    route: "/admin/backup",
    category: "ADMIN",
    requiredPerm: "backup.manage",
    descriptionFa: "تهیه نسخه پشتیبان از پایگاه داده و بازیابی داده‌های پایانه",
  },
];
