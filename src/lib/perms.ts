// سیستم مجوزهای ریز — جایگزین تدریجی نقش‌های عددی
import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/auth";

export const ALL_PERMS = [
  "manovr.view",      // مشاهده تاریخچه مانورها
  "manovr.create",    // ثبت مانور
  "manovr.edit",      // ویرایش مانور
  "manovr.confirm",   // تأیید/رد مانور
  "manovr.delete",    // حذف مانور
  "train.manage",     // مدیریت قطارها
  "line.manage",      // مدیریت خطوط
  "terminal.manage",  // مدیریت ترمینال‌ها
  "user.manage",      // مدیریت کاربران
  "role.manage",      // مدیریت نقش‌ها
  "phonebook.view",   // مشاهده دفتر تلفن
  "phonebook.edit",   // ویرایش دفتر تلفن
  "report.build",     // ساخت گزارش
  "report.export",    // خروجی گزارش (اکسل/PDF)
  "report.import",    // ایمپورت داده
  "ticket.create",    // ثبت تیکت پشتیبانی
  "ticket.manage",    // مدیریت و پاسخ به تیکت‌ها
  "lookups.manage",   // مدیریت مقادیر پویا
  "branding.manage",  // تنظیمات برندینگ
  "audit.view",       // مشاهده لاگ وقایع سیستم
  "backup.manage",    // مدیریت پشتیبان‌گیری
  "settings.global",  // تنظیمات سراسری سیستم
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
  "train.manage": "مدیریت قطارها",
  "line.manage": "مدیریت خطوط ریل",
  "terminal.manage": "مدیریت ترمینال‌ها",
  "user.manage": "مدیریت کاربران و پرسنل",
  "role.manage": "مدیریت نقش‌ها و سطوح دسترسی",
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

// مجوزهای معادل نقش‌های قدیمی (fallback وقتی accessRole ندارد)
const LEGACY: Record<number, string[]> = {
  4: [...ALL_PERMS],
  1: [...ALL_PERMS],
  2: [
    "manovr.view", "manovr.create", "manovr.edit", "manovr.confirm", "manovr.delete",
    "train.manage", "line.manage", "terminal.manage", "user.manage",
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

