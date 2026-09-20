"use server";

import {
  getRecentDiagnosticLogs,
  generateDiagnosticReportForAdmin,
  DiagnosticLogEntry,
  LogLevel,
  LogCategory,
} from "@/lib/logger";

/**
 * دریافت لاگ‌های تشخیصی برای نمایش درون کامپوننت‌های رابط کاربری
 */
export async function getDiagnosticLogsAction(options?: {
  limit?: number;
  level?: LogLevel;
  category?: LogCategory;
}): Promise<DiagnosticLogEntry[]> {
  return await getRecentDiagnosticLogs(options);
}

/**
 * تولید و دریافت گزارش متنی آماده Markdown جهت کپی یک‌کلیکی برای ادمین
 */
export async function getAdminReportAction(): Promise<string> {
  return await generateDiagnosticReportForAdmin();
}
