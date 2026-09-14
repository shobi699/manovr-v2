import fs from "fs";
import path from "path";
import os from "os";
import { prisma } from "@/lib/prisma";

export interface NetworkStatusResult {
  isShared: boolean;
  isDatabaseReady: boolean;
  targetSharedPath: string;
  activeDatabasePath: string;
  maskedTarget: string;
  maskedActivePath: string;
  storageSource: string;
  pingMs: number;
  sharedPathAccessible: boolean;
  serverHostname: string;
  checkedAt: string;
}

/**
 * بررسی دسترسی ناهمگام و ایمن به مسیر با سقف زمان پاسخگویی (Timeout Guard)
 * جهت ممانعت مطلق از بلاک شدن نخ اصلی Node.js روی مسیرهای شبکه ویندوز
 */
async function checkPathAccessibleAsync(targetPath: string, timeoutMs = 1200): Promise<boolean> {
  try {
    const checkPromise = fs.promises.access(targetPath, fs.constants.R_OK);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SMB Network Timeout")), timeoutMs)
    );
    await Promise.race([checkPromise, timeoutPromise]);
    return true;
  } catch {
    return false;
  }
}

/**
 * دریافت مسیر اشتراکی پیکربندی‌شده از manovr-config.json یا متغیرهای محیطی
 */
export function getTargetSharedPath(): string {
  if (process.env.SHARED_DATA_TARGET) {
    return process.env.SHARED_DATA_TARGET.trim();
  }

  const candidatePaths = [
    path.join(process.cwd(), "manovr-config.json"),
    path.join(process.cwd(), "..", "manovr-config.json"),
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
        if (parsed && typeof parsed.sharedDataPath === "string") {
          return parsed.sharedDataPath.trim();
        }
      }
    } catch {}
  }

  return "\\\\srvdfs01\\Line1\\Depo\\data";
}

/**
 * بررسی وضعیت ارتباط با پایگاه داده و پوشه اشتراکی شبکه به صورت کاملاً غیرمسدودکننده
 */
export async function getNetworkStatus(): Promise<NetworkStatusResult> {
  const targetSharedPath = getTargetSharedPath();
  const rawDbUrl = process.env.DATABASE_URL || "";
  const storagePathEnv = process.env.STORAGE_PATH || "";
  const storageSourceEnv = process.env.STORAGE_SOURCE || "";

  // استخراج مسیر فیزیکی دیتابیس از DATABASE_URL
  let activeDatabasePath = storagePathEnv ? path.join(storagePathEnv, "database", "dev.db") : "";
  if (!activeDatabasePath && rawDbUrl.startsWith("file:")) {
    const rawFilePath = rawDbUrl.replace(/^file:\/\//, "").replace(/^file:/, "");
    activeDatabasePath = rawFilePath.replace(/\//g, "\\");
  }

  // بررسی کاملاً ناهمگام با تایم‌اوت محافظ برای جلوگیری از فریز سرور
  let sharedPathAccessible = await checkPathAccessibleAsync(targetSharedPath);
  if (!sharedPathAccessible) {
    const rootDfs = "\\\\srvdfs01\\Line1\\Depo";
    sharedPathAccessible = await checkPathAccessibleAsync(rootDfs);
  }

  // تشخیص اینکه آیا دیتابیس جاری روی پوشه شبکه قرار دارد یا محلی است
  const normalizedActive = activeDatabasePath.toLowerCase().replace(/\//g, "\\");
  const normalizedTarget = targetSharedPath.toLowerCase().replace(/\//g, "\\");
  const isShared =
    Boolean(
      normalizedActive &&
        (normalizedActive.includes("srvdfs01") ||
          normalizedActive.startsWith("\\\\") ||
          (normalizedTarget && normalizedActive.includes(normalizedTarget)))
    ) ||
    storageSourceEnv.toLowerCase().includes("dfs") ||
    storageSourceEnv.toLowerCase().includes("shared");

  // تست سلامت و زمان پاسخگویی پایگاه داده با یک کوئری فوق‌سریع
  let isDatabaseReady = false;
  let pingMs = 0;
  try {
    const start = performance.now();
    await prisma.$queryRawUnsafe("SELECT 1;");
    pingMs = Math.max(1, Math.round(performance.now() - start));
    isDatabaseReady = true;
  } catch (dbErr) {
    console.error("[NetworkStatus] خطای ارتباط با پایگاه داده:", dbErr);
    isDatabaseReady = false;
    pingMs = -1;
  }

  // تعیین منبع و برچسب‌های امنیتی (مخفی‌سازی مسیرهای داخلی شبکه)
  const maskedTarget = "سرور متمرکز دپو (دپو دیتا)";
  const maskedActivePath = isShared
    ? "سرور مرکزی دپو (دپو / دیتا)"
    : "پایگاه داده محلی (حالت آفلاین)";

  let storageSource = storageSourceEnv;
  if (!storageSource) {
    if (isShared) {
      storageSource = maskedTarget;
    } else {
      storageSource = "پایگاه داده محلی (حالت آفلاین)";
    }
  }

  return {
    isShared,
    isDatabaseReady,
    targetSharedPath,
    activeDatabasePath: activeDatabasePath || "dev.db",
    maskedTarget,
    maskedActivePath,
    storageSource,
    pingMs,
    sharedPathAccessible,
    serverHostname: os.hostname(),
    checkedAt: new Date().toISOString(),
  };
}
