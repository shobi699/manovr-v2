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
        const rawDbUrl = process.env.DATABASE_URL || "";
        const isNetworkPath =
          rawDbUrl.includes("srvdfs01") ||
          rawDbUrl.startsWith("file:////") ||
          rawDbUrl.includes("\\\\");

        await baseClient.$queryRawUnsafe("PRAGMA busy_timeout = 60000;");
        // برای مسیر شبکه از TRUNCATE استفاده می‌شود تا فایل دائماً ساخته و پاک نشود؛
        // برای دیسک محلی از WAL جهت نهایت پایداری و خواندن/نوشتن هم‌زمان بهره‌گیری می‌شود.
        const journalMode = isNetworkPath ? "TRUNCATE" : "WAL";
        await baseClient.$queryRawUnsafe(`PRAGMA journal_mode = ${journalMode};`);
        await baseClient.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
        await baseClient.$queryRawUnsafe("PRAGMA temp_store = MEMORY;");
        await baseClient.$queryRawUnsafe("PRAGMA cache_size = -32000;"); // ۳۲ مگابایت کش حافظه
        await baseClient.$queryRawUnsafe("PRAGMA locking_mode = NORMAL;");
        pragmasConfigured = true;
      } catch {
        // در صورت بروز خطای موقت، مانع اجرای کوئری نشود
      } finally {
        configuringPragmasPromise = null;
      }
    })();

    return configuringPragmasPromise;
  };

  // اکستنشن نوبت‌دهی هوشمند و بازتلاش تا ۶۰ ثانیه در صورت قفل بودن دیتابیس در شبکه
  const extendedClient = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          await ensurePragmas();
          const startTime = Date.now();
          const maxWaitMs = 60000; // حداکثر زمان انتظار نوبت ۶۰ ثانیه برای شبکه
          let attempt = 0;

          while (true) {
            try {
              return await query(args);
            } catch (err: unknown) {
              const errorObj = err as { message?: string; code?: string };
              const errorMessage = String(errorObj?.message || "").toLowerCase();
              const errorCode = String(errorObj?.code || "");
              const isLocked =
                errorMessage.includes("database is locked") ||
                errorMessage.includes("sqlite_busy") ||
                errorMessage.includes("database table is locked") ||
                errorMessage.includes("xdelete of a vfs object") ||
                errorMessage.includes("error code 2570") ||
                errorCode === "P2034" ||
                errorCode === "P2028";

              if (isLocked && Date.now() - startTime < maxWaitMs) {
                attempt++;
                // استفاده از تاخیر همراه با Jitter تصادفی تا کلاینت‌های مختلف هم‌زمان تلاش نکنند
                const jitter = Math.floor(Math.random() * 150);
                const delay = Math.min(80 + jitter + attempt * 120, 1500);
                console.warn(
                  `[SQLite Network Queue] دیتابیس در شبکه در حال استفاده است. در حال انتظار... (تلاش ${attempt}، تاخیر ${delay}ms)`
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
              }
              if (isLocked) {
                throw new Error(
                  "دیتابیس برای مدت طولانی (بیش از ۶۰ ثانیه) توسط کاربر دیگری در شبکه قفل مانده است. لطفاً چند لحظه بعد مجدداً تلاش نمایید."
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
