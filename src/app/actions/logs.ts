"use server";

import {
  getRecentDiagnosticLogs,
  generateDiagnosticReportForAdmin,
  getDiagnosticLogFileContent,
  DiagnosticLogEntry,
  LogLevel,
  LogCategory,
} from "@/lib/logger";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";

/**
 * دریافت لاگ‌های تشخیصی برای نمایش درون کامپوننت‌های رابط کاربری با فیلتر سطح و دسته‌بندی
 */
export async function getDiagnosticLogsAction(options?: {
  limit?: number;
  level?: LogLevel;
  category?: LogCategory;
  search?: string;
}): Promise<DiagnosticLogEntry[]> {
  const session = await getSession();
  if (!session) return [];

  // بررسی دسترسی: مدیر سیستم، ناظر ممیزی یا فرد دارای مجوز
  const hasAccess =
    (await hasPerm(session, "audit.view")) ||
    (await hasPerm(session, "system.diagnostics")) ||
    (await hasPerm(session, "logs.diagnostics")) ||
    session.role === 1;

  if (!hasAccess) return [];

  const logs = await getRecentDiagnosticLogs({
    limit: options?.limit || 200,
    level: options?.level,
    category: options?.category,
  });

  if (options?.search && options.search.trim() !== "") {
    const q = options.search.trim().toLowerCase();
    return logs.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        (l.details && l.details.toLowerCase().includes(q)) ||
        (l.category && l.category.toLowerCase().includes(q)) ||
        (l.level && l.level.toLowerCase().includes(q))
    );
  }

  return logs;
}

/**
 * تولید و دریافت گزارش متنی آماده Markdown جهت کپی یک‌کلیکی برای ادمین
 */
export async function getAdminReportAction(): Promise<string> {
  const session = await getSession();
  if (!session) return "عدم احراز هویت";

  return await generateDiagnosticReportForAdmin();
}

/**
 * دانلود مستقیم فایل کامل لاگ متنی سیستم
 */
export async function downloadDiagnosticLogFileAction(): Promise<{ content: string; filename: string }> {
  const session = await getSession();
  if (!session) {
    return { content: "عدم احراز هویت", filename: "error.log" };
  }

  return await getDiagnosticLogFileContent();
}
