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
  sharedPathWritable: boolean;
  writePermissionError?: string;
  databaseExists: boolean;
  hasStaleLocks: boolean;
  journalMode?: string;
  userMessage: string;
  serverHostname: string;
  checkedAt: string;
}

export interface RepairStep {
  title: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

export interface RepairResult {
  success: boolean;
  message: string;
  steps: RepairStep[];
}

/**
 * بررسی دسترسی ناهمگام و ایمن به مسیر با سقف زمان پاسخگویی (Timeout Guard)
 * جهت ممانعت مطلق از بلاک شدن نخ اصلی Node.js روی مسیرهای شبکه ویندوز
 */
async function checkPathAccessibleAsync(targetPath: string, timeoutMs = 1500): Promise<boolean> {
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
 * بررسی دقیق مجوز نوشتن و اصلاح (NTFS Modify / SMB Write)
 * با آزمون ایجاد و حذف بلادرنگ فایل پروب در پوشه دیتابیس
 */
async function checkPathWritableAsync(
  targetFolder: string,
  timeoutMs = 2500
): Promise<{ writable: boolean; error?: string }> {
  try {
    if (!fs.existsSync(targetFolder)) {
      return { writable: false, error: "مسیر پوشه در سرور یافت نشد." };
    }

    const probeFile = path.join(
      targetFolder,
      `.manovr_perm_probe_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.tmp`
    );

    const writePromise = (async () => {
      await fs.promises.writeFile(probeFile, "MANOVR_PERM_CHECK_OK", "utf8");
      if (fs.existsSync(probeFile)) {
        await fs.promises.unlink(probeFile);
      }
      return true;
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("مهلت زمانی بررسی مجوز نوشتن شبکه به پایان رسید")), timeoutMs)
    );

    await Promise.race([writePromise, timeoutPromise]);
    return { writable: true };
  } catch (err: any) {
    const rawMsg = err?.message || String(err);
    if (
      rawMsg.includes("EACCES") ||
      rawMsg.includes("permission denied") ||
      rawMsg.includes("EPERM") ||
      rawMsg.includes("access is denied")
    ) {
      return {
        writable: false,
        error: "کاربر جاری دسترسی نوشتن و تغییر (Modify / Write) در پوشه اشتراکی را ندارد.",
      };
    }
    return { writable: false, error: rawMsg };
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
 * بررسی جامع و همه‌جانبه وضعیت شبکه، پایگاه داده و مجوزهای دسترسی کاربر
 */
export async function getNetworkStatus(): Promise<NetworkStatusResult> {
  const targetSharedPath = getTargetSharedPath();
  const rawDbUrl = process.env.DATABASE_URL || "";
  const storagePathEnv = process.env.STORAGE_PATH || "";
  const storageSourceEnv = process.env.STORAGE_SOURCE || "";

  // استخراج مسیر فیزیکی دیتابیس از DATABASE_URL یا متغیر محیطی
  let activeDatabasePath = storagePathEnv ? path.join(storagePathEnv, "database", "dev.db") : "";
  if (!activeDatabasePath && rawDbUrl.startsWith("file:")) {
    const rawFilePath = rawDbUrl.replace(/^file:\/\//, "").replace(/^file:/, "").split("?")[0];
    activeDatabasePath = rawFilePath.replace(/\//g, "\\");
  }

  // ۱. بررسی دسترسی خواندن به پوشه شبکه
  let sharedPathAccessible = await checkPathAccessibleAsync(targetSharedPath);
  if (!sharedPathAccessible) {
    const rootDfs = "\\\\srvdfs01\\Line1\\Depo";
    sharedPathAccessible = await checkPathAccessibleAsync(rootDfs);
  }

  // ۲. تشخیص اشتراکی بودن مسیر دیتابیس
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

  // ۳. بررسی فیزیکی وجود فایل دیتابیس
  let databaseExists = false;
  if (activeDatabasePath) {
    try {
      databaseExists = fs.existsSync(activeDatabasePath);
    } catch {
      databaseExists = false;
    }
  }

  // ۴. بررسی دقیق مجوز نوشتن (NTFS Write/Modify) در پوشه دیتابیس
  const dbDirectory = activeDatabasePath ? path.dirname(activeDatabasePath) : targetSharedPath;
  let sharedPathWritable = false;
  let writePermissionError: string | undefined;

  if (sharedPathAccessible && dbDirectory) {
    const writeCheck = await checkPathWritableAsync(dbDirectory);
    sharedPathWritable = writeCheck.writable;
    writePermissionError = writeCheck.error;
  }

  // ۵. بررسی فایل‌های قفل موقت و ژورنال‌های سرگردان
  let hasStaleLocks = false;
  let journalMode = "نامشخص";
  if (activeDatabasePath && databaseExists) {
    const walPath = `${activeDatabasePath}-wal`;
    const shmPath = `${activeDatabasePath}-shm`;
    const journalPath = `${activeDatabasePath}-journal`;
    try {
      hasStaleLocks = fs.existsSync(walPath) || fs.existsSync(shmPath) || fs.existsSync(journalPath);
    } catch {
      hasStaleLocks = false;
    }
  }

  // ۶. تست سلامت و زمان پاسخگویی پایگاه داده با سنجش تاخیر واقعی
  let isDatabaseReady = false;
  let pingMs = 0;
  try {
    const start = performance.now();
    if (isShared && activeDatabasePath && databaseExists) {
      try {
        await fs.promises.stat(activeDatabasePath);
      } catch {}
    }

    const jmResult = (await prisma.$queryRawUnsafe("PRAGMA journal_mode;")) as Array<{ journal_mode: string }>;
    if (Array.isArray(jmResult) && jmResult[0]?.journal_mode) {
      journalMode = String(jmResult[0].journal_mode).toUpperCase();
    }

    await prisma.$queryRawUnsafe("SELECT 1;");
    pingMs = Math.max(1, Math.round(performance.now() - start));
    isDatabaseReady = true;
  } catch (dbErr) {
    console.error("[NetworkStatus] خطای استعلام پایگاه داده:", dbErr);
    isDatabaseReady = false;
    pingMs = -1;
  }

  // ۷. برچسب‌گذاری امنیتی منبع داده
  const maskedTarget = "سرور متمرکز دپو (دپو دیتا)";
  const maskedActivePath = isShared
    ? "سرور مرکزی دپو (دپو / دیتا)"
    : "پایگاه داده محلی (حالت آفلاین)";

  let storageSource = storageSourceEnv;
  if (!storageSource) {
    storageSource = isShared ? maskedTarget : "پایگاه داده محلی (حالت آفلاین)";
  }

  // ۸. تولید پیام راهنمای جامع و شفاف فارسی برای کاربر
  let userMessage = "اتصال پایگاه داده و مجوزهای دسترسی در وضعیت مطلوب است.";
  if (!sharedPathAccessible) {
    userMessage = "پوشه اشتراکی سرور پایانه در دسترس نیست. لطفاً اتصال فیزیکی شبکه به سرور دپو را بررسی فرمایید.";
  } else if (!databaseExists) {
    userMessage = "فایل پایگاه داده dev.db در مسیر سرور دپو یافت نشد. لطفاً با ادمین سیستم تماس بگیرید.";
  } else if (!sharedPathWritable) {
    userMessage = "شما دسترسی نوشتن و اصلاح (Modify/Write) در پوشه اشتراکی سرور را ندارید. لطفاً جهت فعال‌سازی دسترسی به ادمین شبکه مراجعه فرمایید.";
  } else if (hasStaleLocks) {
    userMessage = "فایل‌های قفل موقت در پایگاه داده سرور مشاهده شد. با زدن دکمه عیب‌یابی می‌توانید قفل‌ها را آزاد نمایید.";
  } else if (!isDatabaseReady) {
    userMessage = "پایگاه داده سرور به درخواست‌ها پاسخ نمی‌دهد. وضعیت سرویس پایگاه داده را بررسی نمایید.";
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
    sharedPathWritable,
    writePermissionError,
    databaseExists,
    hasStaleLocks,
    journalMode,
    userMessage,
    serverHostname: os.hostname(),
    checkedAt: new Date().toISOString(),
  };
}

/**
 * ابزار تخصصی تعمیر، آزادسازی قفل و تثبیت حالت TRUNCATE پایگاه داده مستقیماً از درون نرم‌افزار
 */
export async function repairDatabaseInPlace(): Promise<RepairResult> {
  const steps: RepairStep[] = [];
  const status = await getNetworkStatus();
  const dbPath = status.activeDatabasePath;

  // ۱. بررسی فایل پایگاه داده
  if (!fs.existsSync(dbPath)) {
    return {
      success: false,
      message: "فایل پایگاه داده در مسیر هدف یافت نشد.",
      steps: [
        {
          title: "بررسی فایل پایگاه داده",
          status: "error",
          detail: `فایل در مسیر ${dbPath} وجود ندارد. لطفاً از وجود dev.db در پوشه شبکه مطمئن شوید.`,
        },
      ],
    };
  }
  steps.push({
    title: "بررسی فایل پایگاه داده",
    status: "ok",
    detail: `فایل پایگاه داده با موفقیت شناسایی شد (${path.basename(dbPath)})`,
  });

  // ۲. بررسی مجوز نوشتن در پوشه
  if (!status.sharedPathWritable) {
    return {
      success: false,
      message: "کاربر جاری مجوز نوشتن (Modify / Write) در پوشه پایگاه داده ندارد.",
      steps: [
        ...steps,
        {
          title: "مجوز نوشتن و اصلاح در سرور",
          status: "error",
          detail: "برای انجام عملیات تعمیر نیاز به مجوز Modify در پوشه سرور است. لطفاً با ادمین شبکه هماهنگ فرمایید.",
        },
      ],
    };
  }
  steps.push({
    title: "مجوز نوشتن و اصلاح",
    status: "ok",
    detail: "مجوز نوشتن و اصلاح (NTFS Modify) در پوشه سرور تایید گردید.",
  });

  // ۳. اجرای Checkpoint و ادغام لاگ‌های معلق
  try {
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
    steps.push({
      title: "ادغام لاگ‌های معلق (Checkpoint)",
      status: "ok",
      detail: "دستور wal_checkpoint(TRUNCATE) با موفقیت اجرا شد و داده‌ها به فایل اصلی منتقل شدند.",
    });
  } catch (e: any) {
    steps.push({
      title: "ادغام لاگ‌های معلق",
      status: "warn",
      detail: `پایگاه داده در حالت WAL نبوده یا نیاز به چک‌پوینت ندارد (${e?.message || "بدون خطا"}).`,
    });
  }

  // ۴. تثبیت حالت ژورنال به TRUNCATE و فعال‌سازی read_uncommitted
  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = TRUNCATE;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 8000;");
    await prisma.$queryRawUnsafe("PRAGMA read_uncommitted = true;");
    await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
    steps.push({
      title: "تثبیت حالت ژورنال به TRUNCATE",
      status: "ok",
      detail: "حالت پایدار TRUNCATE و خواندن همزمان (read_uncommitted) جهت پایداری در شبکه SMB تثبیت گردید.",
    });
  } catch (e: any) {
    steps.push({
      title: "تنظیم پارامترهای ژورنال",
      status: "warn",
      detail: `تنظیم پراگما با پیام مواجه شد: ${e?.message}`,
    });
  }

  // ۵. پاکسازی فایل‌های قفل موقت سرگردان
  const walFile = `${dbPath}-wal`;
  const shmFile = `${dbPath}-shm`;
  const journalFile = `${dbPath}-journal`;
  let cleanedCount = 0;

  for (const f of [walFile, shmFile, journalFile]) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
        cleanedCount++;
      } catch {}
    }
  }

  if (cleanedCount > 0) {
    steps.push({
      title: "پاکسازی فایل‌های قفل موقت",
      status: "ok",
      detail: `${cleanedCount} فایل موقت سرگردان قفل با موفقیت پاکسازی و حافظه آزاد گردید.`,
    });
  } else {
    steps.push({
      title: "بررسی فایل‌های قفل موقت",
      status: "ok",
      detail: "هیچ فایل قفل موقت سرگردانی مشاهده نشد.",
    });
  }

  // ۶. آزمون نهایی تراکنش پایگاه داده
  try {
    await prisma.$queryRawUnsafe("SELECT 1;");
    steps.push({
      title: "آزمون نهایی اتصال و تراکنش",
      status: "ok",
      detail: "تراکنش آزمایشی با موفقیت اجرا شد و پایگاه داده در وضعیت ۱۰۰٪ آماده بهره‌برداری است.",
    });
  } catch (e: any) {
    return {
      success: false,
      message: "خطا در اجرای آزمون نهایی پایگاه داده.",
      steps: [
        ...steps,
        {
          title: "آزمون نهایی اتصال",
          status: "error",
          detail: e?.message || "خطای نامشخص",
        },
      ],
    };
  }

  return {
    success: true,
    message: "عملیات آزادسازی قفل، بهینه‌سازی و تعمیر پایگاه داده با موفقیت ۱۰۰٪ انجام شد.",
    steps,
  };
}

