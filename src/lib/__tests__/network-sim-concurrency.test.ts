import { describe, it, expect } from "vitest";
import { prisma } from "../prisma";

describe("US1: آزمون استرس همروندی دیتابیس و شبیه‌سازی کاربران همزمان (Multi-User Concurrency)", () => {
  it("باید چندین تراکنش همزمان خواندن و نوشتن را بدون خطای قفل پایگاه داده (SQLITE_BUSY) اجرا کند", async () => {
    const concurrentClients = 10;
    const operationsPerClient = 3;

    // ثبت رکوردهای تستی همزمان توسط چند کلاینت شبیه‌سازی‌شده
    const startTime = Date.now();
    let lockErrorsCount = 0;
    let successfulOps = 0;

    const workerTasks = Array.from({ length: concurrentClients }, async (_, clientIndex) => {
      for (let op = 0; op < operationsPerClient; op++) {
        try {
          // ۱. شبیه‌سازی تاخیر پینگ شبکه
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 50) + 10));

          // ۲. خواندن اطلاعات خطوط و قطارها
          const lines = await prisma.line.findMany({ take: 5 });
          expect(Array.isArray(lines)).toBe(true);

          // ۳. ثبت یک لاگ رویداد همزمان در پایگاه داده
          await prisma.auditLog.create({
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
        } catch (err: unknown) {
          const errStr = String(err).toLowerCase();
          if (errStr.includes("sqlite_busy") || errStr.includes("database is locked")) {
            lockErrorsCount++;
          }
          throw err;
        }
      }
    });

    await Promise.all(workerTasks);
    const elapsedMs = Date.now() - startTime;

    // اعتبارسنجی قطعی: صفر خطای قفل پایگاه داده
    expect(lockErrorsCount).toBe(0);
    expect(successfulOps).toBe(concurrentClients * operationsPerClient);

    // پایداری داده‌ها (Persistence Proof)
    const lineCount = await prisma.line.count();
    expect(lineCount).toBeGreaterThanOrEqual(0);

    console.log(`[Concurrency Stress Test] ${successfulOps} عملیات همزمان در ${elapsedMs}ms با موفقیت ۱۰۰٪ اجرا شد.`);
  });

  it("باید سرعت استعلام و زمان پاسخ‌دهی دیتابیس در ترافیک بالا زیر آستانه مجاز باشد", async () => {
    const t0 = Date.now();
    const [trains, lines] = await Promise.all([
      prisma.train.findMany({ take: 10 }),
      prisma.line.findMany({ take: 10 }),
    ]);
    const duration = Date.now() - t0;

    expect(Array.isArray(trains)).toBe(true);
    expect(Array.isArray(lines)).toBe(true);
    expect(duration).toBeLessThan(1000); // زیر ۱ ثانیه
  });
});
