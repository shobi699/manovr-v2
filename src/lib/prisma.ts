import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  let pragmasConfigured = false;
  let configuringPragmasPromise: Promise<void> | null = null;

  const ensurePragmas = async () => {
    if (pragmasConfigured) return;
    if (configuringPragmasPromise) return configuringPragmasPromise;

    configuringPragmasPromise = (async () => {
      try {
        // ۱. تنظیم زمان انتظار مناسب برای آزادسازی قفل بدون فریز طولانی برنامه
        await baseClient.$queryRawUnsafe("PRAGMA busy_timeout = 8000;");

        // ۲. فعال‌سازی خواندن بدون مسدودی (Read Uncommitted) جهت همزمانی کامل چند کاربر در شبکه SMB
        await baseClient.$queryRawUnsafe("PRAGMA read_uncommitted = true;");
        await baseClient.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
        await baseClient.$queryRawUnsafe("PRAGMA temp_store = MEMORY;");
        await baseClient.$queryRawUnsafe("PRAGMA cache_size = -16000;"); // ۱۶ مگابایت کش حافظه بهینه
        await baseClient.$queryRawUnsafe("PRAGMA locking_mode = NORMAL;");

        // ۳. تغییر حالت ژورنال صرفاً در صورت نیاز (جلوگیری قطعی از درخواست Exclusive Lock در هر اتصال کلاینت)
        try {
          const currentJm = (await baseClient.$queryRawUnsafe('PRAGMA journal_mode;')) as Array<{ journal_mode: string }>;
          const curMode = String(currentJm[0]?.journal_mode || "").toLowerCase();
          if (curMode !== "truncate" && curMode !== "wal") {
            await baseClient.$queryRawUnsafe("PRAGMA journal_mode = TRUNCATE;");
          }
        } catch {
          // در صورت مشغول بودن دیتابیس توسط کلاینت دیگر، خطایی صادر نمی‌شود
        }

        // ۴. اعتبارسنجی غیرمسدودکننده ستون‌های الحاقی
        try {
          const tableCols = (await baseClient.$queryRawUnsafe('PRAGMA table_info("Personnel");')) as Array<{ name: string }>;
          const hasCol = Array.isArray(tableCols) && tableCols.some((c) => c.name === 'isPartTimeDriver');
          if (!hasCol) {
            await baseClient.$executeRawUnsafe('ALTER TABLE "Personnel" ADD COLUMN "isPartTimeDriver" BOOLEAN NOT NULL DEFAULT 0;');
            await baseClient.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Personnel_isPartTimeDriver_idx" ON "Personnel"("isPartTimeDriver");');
          }
        } catch {
          // در صورت قفل موقت توسط کاربر دیگر، کوئری متوقف نشود
        }
      } catch {
        // خطاهای موقت مانع استارت برنامه نشود
      } finally {
        pragmasConfigured = true;
        configuringPragmasPromise = null;
      }
    })();

    return configuringPragmasPromise;
  };

  // اکستنشن نوبت‌دهی هوشمند و بازتلاش تا ۱۲ ثانیه در صورت قفل لحظه‌ای تراکنش در شبکه
  const extendedClient = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          await ensurePragmas();
          const startTime = Date.now();
          const maxWaitMs = 12000; // سقف زمان نوبت‌دهی ۱۲ ثانیه (جلوگیری از فریز طولانی در صفحه لاگین)
          let attempt = 0;

          while (true) {
            try {
              return await query(args);
            } catch (err: unknown) {
              const isLocked = isSqliteLockOrIoError(err);

              if (isLocked && Date.now() - startTime < maxWaitMs) {
                attempt++;
                // تاخیر هوشمند و سریع (Micro-backoff) با Jitter تصادفی جهت تفکیک تقاضای کلاینت‌ها
                const jitter = Math.floor(Math.random() * 35);
                const delay = Math.min(20 + jitter + attempt * 15, 250);
                if (attempt % 8 === 0 || attempt === 1) {
                  console.warn(
                    `[SQLite Network Queue] نوبت‌دهی دسترسی دیتابیس در شبکه... (تلاش ${attempt}، تاخیر ${delay}ms)`
                  );
                }
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
              }
              if (isLocked) {
                throw new Error(
                  "پایگاه داده در شبکه در حال حاضر توسط کاربر دیگری در حال نوشتن است. لطفاً چند لحظه بعد مجدداً تلاش نمایید."
                );
              }
              throw err;
            }
          }
        },
      },
    },
  });

  return extendedClient as unknown as PrismaClient;
}

/**
 * تشخیص جامع خطاهای قفل، تداخل شبکه و I/O دیتابیس SQLite
 * شامل خطای ۲۵۷۰ (SQLITE_IOERR_DELETE در اشتراک فایل‌های ویندوز / SMB)
 */
export function isSqliteLockOrIoError(err: unknown): boolean {
  if (!err) return false;
  const errorObj = err as { message?: string; code?: string };
  const rawMsg = typeof err === "string" ? err : String(errorObj?.message || "");
  const msg = rawMsg.toLowerCase();
  const code = String(errorObj?.code || "").toUpperCase();

  return (
    msg.includes("database is locked") ||
    msg.includes("sqlite_busy") ||
    msg.includes("database table is locked") ||
    msg.includes("xdelete of a vfs object") ||
    msg.includes("extended_code: 2570") ||
    msg.includes("error code 2570") ||
    msg.includes("code: 2570") ||
    msg.includes("code 2570") ||
    msg.includes("2570") ||
    msg.includes("disk i/o error") ||
    msg.includes("sqlite_ioerr") ||
    msg.includes("sharing violation") ||
    msg.includes("sharing_violation") ||
    msg.includes("socket timeout") ||
    msg.includes("socket_timeout") ||
    msg.includes("failed to respond to a query within the configured timeout") ||
    msg.includes("access is denied") ||
    msg.includes("busy") ||
    msg.includes("cannot acquire lock") ||
    code === "P2034" ||
    code === "P2028" ||
    code === "P2024"
  );
}

/**
 * اجرای عملیات یا تراکنش با بازتلاش هوشمند تا سقف ۱۵ ثانیه در صورت قفل بودن دیتابیس شبکه
 */
export async function executeWithRetry<T>(
  action: () => Promise<T>,
  maxWaitMs = 15000
): Promise<T> {
  const startTime = Date.now();
  let attempt = 0;
  while (true) {
    try {
      return await action();
    } catch (err: unknown) {
      if (isSqliteLockOrIoError(err) && Date.now() - startTime < maxWaitMs) {
        attempt++;
        const jitter = Math.floor(Math.random() * 30);
        const delay = Math.min(20 + jitter + attempt * 15, 250);
        if (attempt % 8 === 0 || attempt === 1) {
          console.warn(
            `[SQLite Network Queue] تراکنش در انتظار آزادسازی قفل دیتابیس است... (تلاش ${attempt}، تاخیر ${delay}ms)`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (isSqliteLockOrIoError(err)) {
        throw new Error(
          "پایگاه داده در شبکه برای مدت بیش از ۱۵ ثانیه در حال استفاده توسط کاربر دیگری بود. لطفاً چند لحظه بعد مجدداً تلاش نمایید."
        );
      }
      throw err;
    }
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
