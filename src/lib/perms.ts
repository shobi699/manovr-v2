// سیستم مجوزهای ریز — جایگزین تدریجی نقش‌های عددی
import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/auth";

export const ALL_PERMS = [
  // Manovr
  "manovr.view",      // مشاهده تاریخچه مانورها
  "manovr.create",    // ثبت مانور
  "manovr.edit",      // ویرایش مانور
  "manovr.confirm",   // تأیید/رد مانور
  "manovr.delete",    // حذف مانور
  // Train
  "train.view",       // مشاهده قطارها
  "train.create",     // ساخت قطار
  "train.edit",       // ویرایش قطار
  "train.delete",     // حذف قطار
  "train.status.kafshak", // تغییر وضعیت کفشک
  "train.status.atp",     // تغییر وضعیت ATP
  "train.status.rotary",  // تغییر موعد دوار
  "train.status.license", // تغییر وضعیت مجوز
  // Line
  "line.view",        // مشاهده خطوط
  "line.create",      // ساخت خط
  "line.edit",        // ویرایش خط
  "line.delete",      // حذف خط
  // Terminal
  "terminal.view",    // مشاهده ترمینال‌ها
  "terminal.create",  // ساخت ترمینال
  "terminal.edit",    // ویرایش ترمینال
  "terminal.delete",  // حذف ترمینال
  // User
  "user.view",        // مشاهده کاربران
  "user.create",      // ساخت کاربر
  "user.edit",        // ویرایش کاربر
  "user.delete",      // حذف کاربر
  // Role
  "role.view",        // مشاهده نقش‌ها
  "role.create",      // ساخت نقش
  "role.edit",        // ویرایش نقش
  "role.delete",      // حذف نقش
  // Phonebook
  "phonebook.view",   // مشاهده دفتر تلفن
  "phonebook.edit",   // ویرایش دفتر تلفن
  // Report
  "report.build",     // ساخت گزارش
  "report.export",    // خروجی گزارش (اکسل/PDF)
  "report.import",    // ایمپورت داده
  // Ticket
  "ticket.create",    // ثبت تیکت پشتیبانی
  "ticket.manage",    // مدیریت و پاسخ به تیکت‌ها
  // Settings & Lookups
  "lookups.manage",   // مدیریت مقادیر پویا
  "branding.manage",  // تنظیمات برندینگ
  "audit.view",       // مشاهده لاگ وقایع سیستم
  "backup.manage",    // مدیریت پشتیبان‌گیری
  "settings.global",  // تنظیمات سراسری سیستم
  // Depot & Dashboard
  "depot.layout",     // چیدمان پایانه (۳بعدی)
  "depot.view",       // مشاهده نمای پایانه
  "dashboard.view",   // مشاهده داشبورد و آمار
] as const;

export type Perm = (typeof ALL_PERMS)[number];

export const PERM_LABELS: Record<Perm, string> = {
  "manovr.view": "مشاهده تاریخچه مانورها",
  "manovr.create": "ثبت مانور جدید",
  "manovr.edit": "ویرایش مانور",
  "manovr.confirm": "تأیید/رد مانور",
  "manovr.delete": "حذف مانور",
  "train.view": "مشاهده لیست قطارها",
  "train.create": "ثبت قطار جدید",
  "train.edit": "ویرایش اطلاعات قطار",
  "train.delete": "حذف قطار",
  "train.status.kafshak": "تغییر وضعیت کفشک قطار",
  "train.status.atp": "تغییر وضعیت هشدار ATP",
  "train.status.rotary": "تعیین موعد خط دوار",
  "train.status.license": "تغییر وضعیت مجوز قطار",
  "line.view": "مشاهده لیست خطوط ریل",
  "line.create": "ثبت خط جدید",
  "line.edit": "ویرایش خط ریل",
  "line.delete": "حذف خط ریل",
  "terminal.view": "مشاهده لیست ترمینال‌ها",
  "terminal.create": "ثبت ترمینال جدید",
  "terminal.edit": "ویرایش ترمینال",
  "terminal.delete": "حذف ترمینال",
  "user.view": "مشاهده لیست کاربران و پرسنل",
  "user.create": "ثبت کاربر جدید",
  "user.edit": "ویرایش کاربران",
  "user.delete": "حذف کاربران",
  "role.view": "مشاهده نقش‌ها و سطوح دسترسی",
  "role.create": "ساخت نقش جدید",
  "role.edit": "ویرایش نقش",
  "role.delete": "حذف نقش",
  "phonebook.view": "مشاهده دفتر تلفن",
  "phonebook.edit": "ویرایش دفتر تلفن",
  "report.build": "ساخت گزارش جدید",
  "report.export": "خروجی گرفتن از گزارش‌ها (Excel/PDF)",
  "report.import": "ایمپورت و ورود اطلاعات پایه از اکسل",
  "ticket.create": "ارسال تیکت پشتیبانی جدید",
  "ticket.manage": "مدیریت و پاسخ به تیکت‌های پشتیبانی",
  "lookups.manage": "مدیریت مقادیر پویا (لوکاپ‌ها)",
  "branding.manage": "تنظیمات برندینگ و تم سراسری سیستم",
  "audit.view": "مشاهده لاگ وقایع و عملیات کاربران (Audit Log)",
  "backup.manage": "پشتیبان‌گیری و بازگردانی دیتابیس",
  "settings.global": "تنظیمات سراسری سیستم",
  "depot.layout": "چیدمان ۳بعدی پایانه و سوله‌ها",
  "depot.view": "مشاهده نمای دوبعدی و سه‌بعدی پایانه",
  "dashboard.view": "مشاهده داشبورد و آمارهای سیستم",
};

// گروه بندی دسترسی‌ها برای نمایش بهتر در رابط کاربری
export const PERM_GROUPS: Record<string, { label: string; perms: Perm[] }> = {
  manovr: { label: "مانورها", perms: ["manovr.view", "manovr.create", "manovr.edit", "manovr.delete", "manovr.confirm"] },
  train: { label: "قطارها", perms: ["train.view", "train.create", "train.edit", "train.delete"] },
  train_status: { label: "وضعیت‌های فنی قطار", perms: ["train.status.kafshak", "train.status.atp", "train.status.rotary", "train.status.license"] },
  line: { label: "خطوط", perms: ["line.view", "line.create", "line.edit", "line.delete"] },
  terminal: { label: "ترمینال‌ها", perms: ["terminal.view", "terminal.create", "terminal.edit", "terminal.delete"] },
  user: { label: "کاربران و پرسنل", perms: ["user.view", "user.create", "user.edit", "user.delete"] },
  role: { label: "نقش‌ها و سطوح دسترسی", perms: ["role.view", "role.create", "role.edit", "role.delete"] },
  depot: { label: "نمای پایانه و داشبورد", perms: ["depot.view", "depot.layout", "dashboard.view"] },
  reports: { label: "گزارشات و اطلاعات", perms: ["report.build", "report.export", "report.import", "phonebook.view", "phonebook.edit"] },
  support: { label: "پشتیبانی", perms: ["ticket.create", "ticket.manage"] },
  admin: { label: "تنظیمات و مدیریت سیستم", perms: ["settings.global", "branding.manage", "lookups.manage", "audit.view", "backup.manage"] },
};

// مجوزهای معادل نقش‌های قدیمی (fallback وقتی accessRole ندارد)
const LEGACY: Record<number, string[]> = {
  4: [...ALL_PERMS],
  1: [...ALL_PERMS],
  2: [
    "manovr.view", "manovr.create", "manovr.edit", "manovr.confirm", "manovr.delete",
    "train.view", "train.create", "train.edit", "train.delete",
    "line.view", "line.create", "line.edit", "line.delete",
    "terminal.view", "terminal.create", "terminal.edit", "terminal.delete",
    "user.view", "user.create", "user.edit", "user.delete",
    "phonebook.view", "report.build", "report.export", "ticket.create", "ticket.manage",
    "depot.view", "dashboard.view", "settings.global"
  ],
  3: ["manovr.view", "phonebook.view", "report.build", "report.export", "depot.view", "dashboard.view"],
  0: [],
};

import { unstable_cache, revalidateTag } from "next/cache";

// مجوزهای مؤثر کاربر را از DB می‌خواند (با استفاده از کش سراسری Next.js برای سرعت بالا)
export const getUserPerms = unstable_cache(
  async (userId: number, legacyRole: number): Promise<string[]> => {
    const p = await prisma.personnel.findUnique({
      where: { id: userId },
      include: { accessRole: true },
    });
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


// touch for cache clear
