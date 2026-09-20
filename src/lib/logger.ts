import fs from "fs";
import path from "path";
import os from "os";

export type LogLevel = "INFO" | "WARN" | "ERROR";
export type LogCategory = "DATABASE" | "NETWORK" | "SYNC" | "AUTH" | "SYSTEM";

export interface DiagnosticLogEntry {
  id: string;
  timestamp: string;
  timestampJalali: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: string;
  stack?: string;
  metadata?: Record<string, any>;
}

// بافر درون‌حافظه‌ای ۲۰۰ لاگ آخر جهت ارائه بلادرنگ به رابط کاربری
const inMemoryLogs: DiagnosticLogEntry[] = [];
const MAX_MEMORY_LOGS = 250;

/**
 * تعیین مسیر ذخیره‌سازی لاگ‌های محلی کلاینت
 */
function getLogFilePath(): string {
  const localAppData =
    process.env.LOCALAPPDATA ||
    (process.platform === "win32"
      ? path.join(process.env.USERPROFILE || "C:\\", "AppData", "Local")
      : path.join(os.homedir(), ".config"));

  const logDir = path.join(localAppData, "ManovrSystem", "logs");
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch {}
  }
  return path.join(logDir, "diagnostic-events.log");
}

/**
 * فرمت‌دهی تاریخ و زمان به افق تهران و تقویم جلالی
 */
function getTehranJalaliTimestamp(): { iso: string; jalali: string } {
  const now = new Date();
  const iso = now.toISOString();

  try {
    const jalali = new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    return { iso, jalali };
  } catch {
    return { iso, jalali: iso };
  }
}

/**
 * ثبت عمومی یک واقعه در سیستم لاگ
 */
export function recordDiagnosticLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  details?: string | Error | any,
  metadata?: Record<string, any>
): DiagnosticLogEntry {
  const { iso, jalali } = getTehranJalaliTimestamp();

  let detailsStr: string | undefined;
  let stackStr: string | undefined;

  if (details instanceof Error) {
    detailsStr = details.message;
    stackStr = details.stack;
  } else if (typeof details === "string") {
    detailsStr = details;
  } else if (details && typeof details === "object") {
    try {
      detailsStr = JSON.stringify(details);
    } catch {
      detailsStr = String(details);
    }
  }

  const entry: DiagnosticLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: iso,
    timestampJalali: jalali,
    level,
    category,
    message,
    details: detailsStr,
    stack: stackStr,
    metadata,
  };

  // افزودن به بافر حافظه
  inMemoryLogs.unshift(entry);
  if (inMemoryLogs.length > MAX_MEMORY_LOGS) {
    inMemoryLogs.pop();
  }

  // ثبت غیرمسدودکننده در فایل دیسک
  try {
    const logPath = getLogFilePath();
    const logLine = `[${jalali}] [${level}] [${category}] ${message}${
      detailsStr ? ` | جزئیات: ${detailsStr}` : ""
    }${stackStr ? `\nStack: ${stackStr}` : ""}\n`;

    fs.appendFile(logPath, logLine, () => {});
  } catch {}

  return entry;
}

export const logger = {
  info: (category: LogCategory, message: string, details?: any, metadata?: Record<string, any>) =>
    recordDiagnosticLog("INFO", category, message, details, metadata),

  warn: (category: LogCategory, message: string, details?: any, metadata?: Record<string, any>) =>
    recordDiagnosticLog("WARN", category, message, details, metadata),

  error: (category: LogCategory, message: string, error?: any, metadata?: Record<string, any>) =>
    recordDiagnosticLog("ERROR", category, message, error, metadata),
};

/**
 * دریافت لیست لاگ‌های اخیر با فیلتر سطح و دسته‌بندی
 */
export async function getRecentDiagnosticLogs(options?: {
  limit?: number;
  level?: LogLevel;
  category?: LogCategory;
}): Promise<DiagnosticLogEntry[]> {
  const limit = options?.limit || 100;

  let filtered = [...inMemoryLogs];

  if (options?.level) {
    filtered = filtered.filter((l) => l.level === options.level);
  }
  if (options?.category) {
    filtered = filtered.filter((l) => l.category === options.category);
  }

  return filtered.slice(0, limit);
}

/**
 * تولید گزارش متنی جامع Markdown جهت ارسال مستقیم و یک‌کلیکی به ادمین یا توسعه‌دهنده
 */
export async function generateDiagnosticReportForAdmin(): Promise<string> {
  const logs = await getRecentDiagnosticLogs({ limit: 40 });
  const { jalali } = getTehranJalaliTimestamp();

  const report = [
    `# گزارش جامع عیب‌یابی و وضعیت سامانه مانور دپو (Manovr V3)`,
    `**تاریخ تولید گزارش:** ${jalali}`,
    `**نام ایستگاه کاری (Hostname):** ${os.hostname()}`,
    `**سیستم عامل:** ${os.type()} ${os.release()} (${os.arch()})`,
    `**مسیر لاگ محلی:** ${getLogFilePath()}`,
    ``,
    `---`,
    `## خلاصه وضعیت خطاها (Errors & Warnings)`,
    ``,
  ];

  const errorLogs = logs.filter((l) => l.level === "ERROR");
  const warnLogs = logs.filter((l) => l.level === "WARN");

  report.push(`- تعداد خطاهای اخیر: **${errorLogs.length}** مورد`);
  report.push(`- تعداد هشدارهای اخیر: **${warnLogs.length}** مورد`);
  report.push(``);

  report.push(`### آخرین وقایع ثبت‌شده:`);
  report.push(``);

  if (logs.length === 0) {
    report.push(`_هیچ رخداد خطایی در سیستم ثبت نشده است._`);
  } else {
    for (const log of logs) {
      const badge = log.level === "ERROR" ? "🔴 [خطا]" : log.level === "WARN" ? "🟡 [هشدار]" : "🟢 [اطلاع]";
      report.push(`#### ${badge} [${log.category}] - ${log.timestampJalali}`);
      report.push(`**پیام:** ${log.message}`);
      if (log.details) {
        report.push(`**جزئیات:** \`${log.details}\``);
      }
      if (log.stack) {
        report.push(`\`\`\`text\n${log.stack}\n\`\`\``);
      }
      report.push(``);
    }
  }

  report.push(`---`);
  report.push(`_تهیه شده توسط سیستم عیب‌یابی هوشمند سامانه مانور خط یک متروی تهران_`);

  return report.join("\n");
}
