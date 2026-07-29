import path from "path";

// تمام خروجی‌های زمان‌بندی‌شده باید داخل این پوشه بمانند.
// مسیر مطلق یا خروج از این ریشه پذیرفته نمی‌شود.
export const SCHEDULED_OUTPUT_ROOT = "public/exports/scheduled";

/**
 * ریشه‌ی مطلق پوشه خروجی گزارش‌های زمان‌بندی‌شده
 */
export function scheduledOutputRoot(cwd: string = process.cwd()): string {
  return path.resolve(cwd, SCHEDULED_OUTPUT_ROOT);
}

/**
 * یک مسیر نسبی دلخواه را داخل ریشه‌ی خروجی محدود می‌کند.
 * در صورت مطلق بودن یا خروج از ریشه، null برمی‌گرداند.
 */
export function resolveScheduledOutputDir(
  requested: string,
  cwd: string = process.cwd()
): string | null {
  if (typeof requested !== "string") return null;

  let trimmed = requested.trim();
  if (trimmed === "") return null;

  // پشتیبانی از مقادیر قدیمی UI که کل مسیر نسبی را می‌فرستادند
  if (trimmed === SCHEDULED_OUTPUT_ROOT) {
    trimmed = "";
  } else if (trimmed.startsWith(SCHEDULED_OUTPUT_ROOT + "/")) {
    trimmed = trimmed.slice(SCHEDULED_OUTPUT_ROOT.length + 1);
  } else if (trimmed.startsWith(SCHEDULED_OUTPUT_ROOT + "\\")) {
    trimmed = trimmed.slice(SCHEDULED_OUTPUT_ROOT.length + 1);
  }

  // مسیرهای مطلق و مسیرهای ویندوزی با حرف درایو مجاز نیستند
  if (path.isAbsolute(trimmed) || /^[a-zA-Z]:/.test(trimmed)) return null;

  // بایت تهی و مسیرهای UNC
  if (trimmed.includes("\0") || trimmed.startsWith("\\\\")) return null;

  const root = scheduledOutputRoot(cwd);
  const resolved = path.resolve(root, trimmed);

  // باید دقیقاً ریشه یا زیرمجموعه‌ی آن باشد
  const relative = path.relative(root, resolved);
  if (relative === "") return root;
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

  return resolved;
}
