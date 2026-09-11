import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const baseClient = new PrismaClient();

  // اعمال خودکار PRAGMA busy_timeout برای صف انتظار ۳۰ ثانیه‌ای
  let pragmasConfigured = false;
  const ensurePragmas = async () => {
    if (pragmasConfigured) return;
    try {
      await baseClient.$queryRawUnsafe("PRAGMA busy_timeout = 60000;");
      await baseClient.$queryRawUnsafe("PRAGMA journal_mode = DELETE;");
      await baseClient.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
      await baseClient.$queryRawUnsafe("PRAGMA temp_store = MEMORY;");
      await baseClient.$queryRawUnsafe("PRAGMA cache_size = -16000;");
      await baseClient.$queryRawUnsafe("PRAGMA locking_mode = NORMAL;");
      pragmasConfigured = true;
    } catch {
      // در صورت بروز هرگونه خطای موقت، مانع از اجرای کوئری نشود
    }
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
                errorCode === "P2034";

              if (isLocked && Date.now() - startTime < maxWaitMs) {
                attempt++;
                // استفاده از تاخیر همراه با Jitter تصادفی تا کلاینت‌های مختلف در یک میلی‌ثانیه هم‌زمان تلاش مجدد نکنند
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

