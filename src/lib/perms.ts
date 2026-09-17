// سیستم مجوزهای ریز — جایگزین تدریجی نقش‌های عددی
import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/auth";

export const ALL_PERMS = [
  // Manovr
  "manovr.view",      // مشاهده تاریخچه مانورها
  "manovr.create",    // ثبت مانور جدید
  "manovr.edit",      // ویرایش مانور
  "manovr.confirm",   // تأیید/رد مانور (فردی و گروهی)
  "manovr.delete",    // حذف مانور
  "manovr.report",    // مشاهده ماتریس عملکرد و گزارش شیفت راهبران
  // Train
  "train.view",       // مشاهده لیست قطارها
  "train.create",     // ساخت و افزودن قطار
  "train.edit",       // ویرایش مشخصات قطار
  "train.delete",     // حذف و اسقاط قطار
  "train.export",     // خروجی اکسل ناوگان
  // Train Status
  "train.status.kafshak", // تغییر وضعیت کفشک
  "train.status.atp",     // تغییر وضعیت سیستم ATP
  "train.status.rotary",  // تعیین موعد دوار
  "train.status.license", // تغییر وضعیت مجوز حرکت
  // Line
  "line.view",        // مشاهده خطوط
  "line.create",      // ساخت خط ریل جدید
  "line.edit",        // ویرایش خط ریل
  "line.delete",      // حذف خط ریل
  // Terminal
  "terminal.view",    // مشاهده پایانه‌ها و زون‌ها
  "terminal.create",  // ساخت پایانه جدید
  "terminal.edit",    // ویرایش پایانه
  "terminal.delete",  // حذف پایانه
  // User
  "user.view",        // مشاهده پرسنل و کاربران
  "user.create",      // ساخت کاربر جدید
  "user.edit",        // ویرایش اطلاعات و سطح دسترسی کاربر
  "user.delete",      // حذف کاربر
  // Role
  "role.view",        // مشاهده نقش‌ها و ماتریس دسترسی
  "role.create",      // ساخت نقش جدید
  "role.edit",        // ویرایش نقش
  "role.delete",      // حذف نقش
  // Phonebook
  "phonebook.view",   // مشاهده دفترچه تلفن
  "phonebook.edit",   // ویرایش شماره‌ها و اطلاعات تماس
  // Report
  "report.build",     // ساخت و تحلیل گزارش پویا
  "report.export",    // خروجی گزارش (Excel/PDF)
  "report.import",    // ایمپورت اکسل اطلاعات پایه
  "report.schedule",  // زمان‌بندی خودکار ارسال دوره‌ای گزارش‌ها
  // Ticket
  "ticket.view",      // مشاهده کارتابل تیکت‌های پشتیبانی
  "ticket.create",    // ثبت تیکت پشتیبانی جدید
  "ticket.manage",    // مدیریت، ارجاع و پاسخ به تیکت‌ها
  "ticket.broadcast", // ارسال پیام و اطلاعیه همگانی
  // Depot & Dashboard
  "depot.view",       // مشاهده نمای پایانه (2D/3D/Bento/Map)
  "depot.layout",     // ویرایش چیدمان ۳بعدی پایانه و اسلات‌ها
  "dashboard.view",   // مشاهده داشبورد و شاخص‌های آماری
  // Help & Training
  "help.view",        // دسترسی به مرکز آموزش و دانشنامه
  "about.view",       // مشاهده اطلاعات سامانه و درباره ما
  // Settings, Admin & Maintenance
  "lookups.manage",   // مدیریت مقادیر پویا و لوکاپ‌ها
  "branding.manage",  // تنظیمات هویت بصری و برندینگ
  "audit.view",       // مشاهده لاگ وقایع سیستم (Audit Log)
  "audit.export",     // خروجی اکسل از لاگ‌های سیستم
  "backup.manage",    // پشتیبان‌گیری و بازگردانی دیتابیس
  "settings.global",  // تنظیمات سراسری سیستم
  "updater.manage",   // مدیریت پچ‌ها و به‌روزرسانی سیستم
  "system.diagnostics", // عیب‌یابی پایگاه داده و شبکه متمرکز دپو
  "logs.diagnostics",   // مشاهده و استخراج لاگ‌های تشخیصی سیستم
] as const;

export type Perm = (typeof ALL_PERMS)[number];

export const PERM_LABELS: Record<Perm, string> = {
  "manovr.view": "مشاهده تاریخچه مانورها",
  "manovr.create": "ثبت مانور جدید",
  "manovr.edit": "ویرایش مانور",
  "manovr.confirm": "تأیید و رد مانور (فردی و گروهی)",
  "manovr.delete": "حذف مانور",
  "manovr.report": "ماتریس عملکرد و گزارش شیفت راهبران",
  "train.view": "مشاهده لیست قطارها و ناوگان",
  "train.create": "ثبت و افزودن قطار جدید (AC / DC / دیزل)",
  "train.edit": "ویرایش مشخصات فنی قطار",
  "train.delete": "حذف و از رده خارج کردن قطار",
  "train.export": "خروجی اکسل از لیست ناوگان",
  "train.status.kafshak": "تغییر وضعیت کفشک قطار (Shoe Gear)",
  "train.status.atp": "تغییر وضعیت هشدار حفاظتی ATP",
  "train.status.rotary": "تعیین موعد خط دوار چرخ (Wheel Turning)",
  "train.status.license": "تغییر و تمدید مجوز حرکت قطار",
  "line.view": "مشاهده لیست خطوط ریل",
  "line.create": "ثبت خط ریل جدید",
  "line.edit": "ویرایش و تغییر ظرفیت خط ریل",
  "line.delete": "حذف خط ریل",
  "terminal.view": "مشاهده لیست پایانه‌ها و زون‌ها",
  "terminal.create": "ثبت پایانه یا زون جدید",
  "terminal.edit": "ویرایش مشخصات پایانه",
  "terminal.delete": "حذف پایانه",
  "user.view": "مشاهده لیست کاربران و پرسنل",
  "user.create": "ثبت پرسنل و ساخت حساب کاربری",
  "user.edit": "ویرایش کاربران، تغییر رمز و تخصیص نقش",
  "user.delete": "حذف یا تعلیق حساب کاربر",
  "role.view": "مشاهده نقش‌ها و ماتریس دسترسی‌ها",
  "role.create": "ساخت نقش کاربری جدید",
  "role.edit": "ویرایش اختیارات و مجوزهای نقش",
  "role.delete": "حذف نقش کاربری",
  "phonebook.view": "مشاهده دفترچه تلفن و تماس پرسنل",
  "phonebook.edit": "ویرایش شماره‌های داخلی و تماس",
  "report.build": "طراحی و ساخت گزارش پویا",
  "report.export": "خروجی گرفتن از گزارش‌ها (Excel / PDF)",
  "report.import": "ایمپورت و ورود دسته‌ای داده‌ها از اکسل",
  "report.schedule": "زمان‌بندی خودکار ارسال دوره‌ای گزارشات",
  "ticket.view": "مشاهده و پیگیری کارتابل تیکت‌ها",
  "ticket.create": "ثبت و ارسال تیکت پشتیبانی جدید",
  "ticket.manage": "مدیریت، ارجاع و پاسخ به تیکت‌های پشتیبانی",
  "ticket.broadcast": "ارسال اطلاعیه و پیام همگانی به پرسنل",
  "depot.view": "مشاهده نمای دوبعدی و سه‌بعدی پایانه",
  "depot.layout": "چیدمان سه‌بعدی پایانه و سوله‌ها",
  "dashboard.view": "مشاهده داشبورد و شاخص‌های آماری",
  "help.view": "مشاهده مرکز آموزش و راهنمای منوها",
  "about.view": "مشاهده شناسنامه نرم‌افزار و درباره ما",
  "lookups.manage": "مدیریت مقادیر پویا و جداول پایه",
  "branding.manage": "شخصی‌سازی هویت بصری، نام و رنگ تم",
  "audit.view": "مشاهده لاگ وقایع امنیتی و ممیزی (Audit Log)",
  "audit.export": "خروجی اکسل از لاگ‌های وقایع سیستم",
  "backup.manage": "پشتیبان‌گیری و بازگردانی پایگاه‌داده",
  "settings.global": "پیکربندی سراسری و پارامترهای پایانه",
  "updater.manage": "بررسی، دریافت و اعمال پچ‌های به‌روزرسانی",
  "system.diagnostics": "عیب‌یابی پایگاه داده و شبکه متمرکز دپو",
  "logs.diagnostics": "مشاهده و استخراج لاگ‌های تشخیصی سیستم",
};

export interface PermGroup {
  label: string;
  icon: string;
  description: string;
  perms: Perm[];
}

// گروه بندی دسترسی‌ها برای نمایش ساختاریافته و زیبا در رابط کاربری
export const PERM_GROUPS: Record<string, PermGroup> = {
  manovr: {
    label: "مدیریت مانورها",
    icon: "🔄",
    description: "ثبت، تایید، ویرایش، حذف و گزارش‌های عملکرد مانور",
    perms: ["manovr.view", "manovr.create", "manovr.edit", "manovr.confirm", "manovr.delete", "manovr.report"],
  },
  train: {
    label: "ناوگان و قطارها",
    icon: "🚆",
    description: "مشاهده، ثبت، ویرایش، حذف و خروجی اکسل ناوگان",
    perms: ["train.view", "train.create", "train.edit", "train.delete", "train.export"],
  },
  train_status: {
    label: "وضعیت‌های فنی و حفاظتی",
    icon: "⚡",
    description: "کنترل کفشک، هشدار ATP، موعد خط دوار و مجوز حرکت",
    perms: ["train.status.kafshak", "train.status.atp", "train.status.rotary", "train.status.license"],
  },
  line: {
    label: "خطوط ریلی و پایانه",
    icon: "🛤️",
    description: "مشاهده، تعریف، ویرایش و حذف خطوط و ریل‌های پایانه",
    perms: ["line.view", "line.create", "line.edit", "line.delete"],
  },
  terminal: {
    label: "پایانه‌ها و زون‌ها",
    icon: "🏢",
    description: "مدیریت پایانه‌های عملیاتی و زون‌های پایانه",
    perms: ["terminal.view", "terminal.create", "terminal.edit", "terminal.delete"],
  },
  user: {
    label: "کاربران و پرسنل",
    icon: "👥",
    description: "مشاهده، ثبت، ویرایش مشخصات، تغییر رمز و حذف کاربران",
    perms: ["user.view", "user.create", "user.edit", "user.delete"],
  },
  role: {
    label: "نقش‌ها و سطوح دسترسی",
    icon: "🛡️",
    description: "مشاهده، تعریف، ویرایش اختیارات و حذف نقش‌ها",
    perms: ["role.view", "role.create", "role.edit", "role.delete"],
  },
  phonebook: {
    label: "دفترچه تلفن و مخاطبین",
    icon: "📞",
    description: "مشاهده و بروزرسانی شماره‌های داخلی و تماس پرسنل",
    perms: ["phonebook.view", "phonebook.edit"],
  },
  reports: {
    label: "گزارش‌ساز پویا و اکسل",
    icon: "📊",
    description: "طراحی کوئری، خروجی اکسل/PDF، ورود داده و زمان‌بندی",
    perms: ["report.build", "report.export", "report.import", "report.schedule"],
  },
  support: {
    label: "تیکت‌ها و پشتیبانی",
    icon: "🎫",
    description: "ثبت، پیگیری، ارجاع، پاسخگویی به تیکت‌ها و پیام همگانی",
    perms: ["ticket.view", "ticket.create", "ticket.manage", "ticket.broadcast"],
  },
  depot: {
    label: "نمای پایانه و مانیتورینگ",
    icon: "🧭",
    description: "مشاهده نمای پایانه، چیدمان سه‌بعدی و داشبورد آمار",
    perms: ["depot.view", "depot.layout", "dashboard.view"],
  },
  help: {
    label: "مرکز آموزش و دانشنامه",
    icon: "📚",
    description: "مشاهده راهنمای تفصیلی منوها و آموزش‌های عملیاتی",
    perms: ["help.view", "about.view"],
  },
  admin: {
    label: "تنظیمات سیستمی و امنیت",
    icon: "⚙️",
    description: "تنظیمات سراسری، عیب‌یابی شبکه، لاگ‌های تشخیصی، برندینگ، ممیزی و بکاپ",
    perms: [
      "settings.global",
      "system.diagnostics",
      "logs.diagnostics",
      "branding.manage",
      "lookups.manage",
      "audit.view",
      "audit.export",
      "backup.manage",
      "updater.manage",
    ],
  },
};

// مجوزهای معادل نقش‌های قدیمی (fallback وقتی accessRole ندارد)
const LEGACY: Record<number, string[]> = {
  4: [...ALL_PERMS],
  1: [...ALL_PERMS],
  2: [
    "manovr.view", "manovr.create", "manovr.edit", "manovr.confirm", "manovr.delete", "manovr.report",
    "train.view", "train.create", "train.edit", "train.delete", "train.export",
    "train.status.kafshak", "train.status.atp", "train.status.rotary", "train.status.license",
    "line.view", "line.create", "line.edit", "line.delete",
    "terminal.view", "terminal.create", "terminal.edit", "terminal.delete",
    "user.view", "user.create", "user.edit", "user.delete",
    "phonebook.view", "phonebook.edit", "report.build", "report.export", "report.schedule",
    "ticket.view", "ticket.create", "ticket.manage",
    "depot.view", "dashboard.view", "help.view", "about.view", "settings.global",
    "system.diagnostics", "logs.diagnostics"
  ],
  3: [
    "manovr.view", "manovr.report", "train.view", "line.view", "terminal.view",
    "phonebook.view", "report.export", "ticket.view", "depot.view", "dashboard.view", "help.view", "about.view"
  ],
  0: [],
};

import { unstable_cache, revalidateTag } from "next/cache";

// مجوزهای مؤثر کاربر را از DB می‌خواند (با استفاده از کش سراسری Next.js برای سرعت بالا)
export const getUserPerms = unstable_cache(
  async (userId: number, legacyRole: number): Promise<string[]> => {
    if (legacyRole === 4) return [...ALL_PERMS];
    const p = await prisma.personnel.findUnique({
      where: { id: userId },
      include: { accessRole: true },
    });
    if (p?.role === 4) return [...ALL_PERMS];
    if (p?.accessRole) {
      try { return JSON.parse(p.accessRole.permissions); } catch { /* fallthrough */ }
    }
    return LEGACY[p?.role ?? legacyRole] ?? [];
  },
  ["user-perms-by-id"],
  { tags: ["permissions"] }
);

// ابطال کش مجوزها پس از تغییر نقش‌ها توسط مدیر
export function invalidatePermsCache() {
  revalidateTag("permissions", "max");
}

export function permsInclude(perms: string[], perm: Perm) {
  return perms.includes(perm);
}

// چک مجوز برای server action ها
export async function hasPerm(session: Session | null, perm: Perm): Promise<boolean> {
  if (!session) return false;
  if (perm === "about.view") return true; // صفحه درباره ما برای تمام کاربران احراز هویت شده در دسترس است
  if (session.role === 4) return true; // سوپرادمین همواره به تمامی بخش‌ها دسترسی کامل دارد
  if (Array.isArray(session.perms)) {
    if (session.perms.includes(perm)) return true;
    const prefix = perm.split(".")[0];
    if (session.perms.includes(`${prefix}.manage` as any) || session.perms.includes("*")) {
      return true;
    }
  }
  const perms = await getUserPerms(session.id, session.role);
  return perms.includes(perm);
}

/**
 * دریافت سطح قدرت نقش‌ها برای کنترل سلسله مراتب (Hierarchy)
 */
export function getRoleLevel(role: number): number {
  if (role === 4) return 100; // Super Admin (سوپرادمین)
  if (role === 1) return 80;  // Admin (مدیر/ادمین)
  if (role === 2) return 50;  // Operator (مسئول شیفت/مسئول)
  if (role === 3) return 30;  // Viewer (مشاهده)
  return 0;                   // Guest / No Access (بدون دسترسی)
}

/**
 * بررسی می‌کند که آیا نقش اقدام‌کننده (actorRole) بالاتر از نقش هدف (targetRole) است یا خیر
 * هم‌تراز یا لول پایین‌تر نمی‌تواند لول بالاتر را تغییر دهد (حتی هم‌تراز خود را هم نمی‌تواند تغییر دهد)
 */
export function isRoleAllowedToManage(actorRole: number, targetRole: number): boolean {
  return getRoleLevel(actorRole) > getRoleLevel(targetRole);
}

/**
 * نگاشت خودکار و امن نام نقش V3 به کد عددی قدیمی دیتابیس (جهت سازگاری به عقب)
 */
export function mapAccessRoleToLegacyRole(roleName?: string | null): number {
  if (!roleName) return 0;
  const name = roleName.trim().toLowerCase();
  if (name.includes("سوپر") || name.includes("super")) return 4;
  if (name.includes("تکنسین") || name.includes("technician")) return 4;
  if (name.includes("ادمین") || name.includes("مدیر") || name.includes("admin")) return 1;
  if (name.includes("مسئول") || name.includes("سرپرست") || name.includes("operator")) return 2;
  if (name.includes("مشاهده") || name.includes("viewer")) return 3;
  if (name.includes("بدون") || name.includes("none")) return 0;
  return 3;
}

