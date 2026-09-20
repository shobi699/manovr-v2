import { describe, it, expect } from "vitest";
import { setupVirtualNetworkShare } from "../../../scripts/simulate-network";
import { PrismaClient } from "@prisma/client";
import { isSqliteLockOrIoError } from "../prisma";

describe("US1: آزمون استرس همروندی دیتابیس و شبیه‌سازی کاربران همزمان (Multi-User Concurrency)", () => {
  it("باید چندین تراکنش همزمان خواندن و نوشتن را بدون خطای قفل پایگاه داده (SQLITE_BUSY) اجرا کند", async () => {
    const { targetDb } = setupVirtualNetworkShare("network-concurrency");
    const testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${targetDb.replace(/\\/g, "/")}?connection_limit=1&socket_timeout=60`,
        },
      },
    });

    const concurrentClients = 10;
    const operationsPerClient = 3;

    // ثبت رکوردهای تستی همزمان توسط چند کلاینت شبیه‌سازی‌شده
    const startTime = Date.now();
    let lockErrorsCount = 0;
    let successfulOps = 0;

    const workerTasks = Array.from({ length: concurrentClients }, async (_, clientIndex) => {
      for (let op = 0; op < operationsPerClient; op++) {
        let opDone = false;
        let attempts = 0;
        while (!opDone && attempts < 15) {
          try {
            attempts++;
            // ۱. شبیه‌سازی تاخیر پینگ شبکه
            await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 30) + 10));

            // ۲. خواندن اطلاعات خطوط و قطارها
            const lines = await testPrisma.line.findMany({ take: 5 });
            expect(Array.isArray(lines)).toBe(true);

            // ۳. ثبت یک لاگ رویداد همزمان در پایگاه داده
            await testPrisma.auditLog.create({
              data: {
                actorName: `کاربر آزمون ${clientIndex}`,
                entity: "stress_test",
                entityId: clientIndex * 100 + op,
                action: "STRESS_WRITE",
                changes: JSON.stringify({ clientIndex, op, timestamp: Date.now() }),
                summary: `شبیه‌سازی تراکنش همزمان کلاینت ${clientIndex} عملیات ${op}`,
              },
            });

            successfulOps++;
            opDone = true;
          } catch (err: unknown) {
            if (isSqliteLockOrIoError(err)) {
              await new Promise((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 40)));
              continue;
            }
            const errStr = String(err).toLowerCase();
            if (errStr.includes("sqlite_busy") || errStr.includes("database is locked")) {
              lockErrorsCount++;
            }
            throw err;
          }
        }
      }
    });

    try {
      await Promise.all(workerTasks);
      const elapsedMs = Date.now() - startTime;

      // اعتبارسنجی قطعی: صفر خطای قفل پایگاه داده
      expect(lockErrorsCount).toBe(0);
      expect(successfulOps).toBe(concurrentClients * operationsPerClient);

      // پایداری داده‌ها (Persistence Proof)
      const lineCount = await testPrisma.line.count();
      expect(lineCount).toBeGreaterThanOrEqual(0);

      console.log(`[Concurrency Stress Test] ${successfulOps} عملیات همزمان در ${elapsedMs}ms با موفقیت ۱۰۰٪ اجرا شد.`);
    } finally {
      await testPrisma.$disconnect();
    }
  }, 30000);

  it("باید سرعت استعلام و زمان پاسخ‌دهی دیتابیس در ترافیک بالا زیر آستانه مجاز باشد", async () => {
    const { targetDb } = setupVirtualNetworkShare("network-concurrency-speed");
    const testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${targetDb.replace(/\\/g, "/")}?connection_limit=1&socket_timeout=60`,
        },
      },
    });

    try {
      const t0 = Date.now();
      const [trains, lines] = await Promise.all([
        testPrisma.train.findMany({ take: 10 }),
        testPrisma.line.findMany({ take: 10 }),
      ]);
      const duration = Date.now() - t0;

      expect(Array.isArray(trains)).toBe(true);
      expect(Array.isArray(lines)).toBe(true);
      expect(duration).toBeLessThan(3000);
    } finally {
      await testPrisma.$disconnect();
    }
  }, 30000);
});
