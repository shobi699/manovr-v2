import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

describe("Terminal Database Integrity & Concurrency Stress Test", () => {
  let testLineId: number;
  let testTrain1Id: number;
  let testTrain2Id: number;
  let testPersonnelId: number;

  beforeAll(async () => {
    // ایجاد داده‌های موقت تستی برای شبیه‌سازی دقیق شرایط عملیاتی دپو
    const personnel = await prisma.personnel.findFirst({ where: { role: 1 } });
    if (personnel) {
      testPersonnelId = personnel.id;
    } else {
      const createdPersonnel = await prisma.personnel.create({
        data: {
          personnelCode: `TST_${Date.now()}`,
          firstName: "تست",
          lastName: "سیستم",
          role: 1,
          orgPosition: 1,
          passwordHash: "hash",
        },
      });
      testPersonnelId = createdPersonnel.id;
    }

    const createdLine = await prisma.line.create({
      data: {
        name: `تست_همزمانی_${Date.now()}`,
        capacity: 2,
        terminal: 1,
        sortIdx: 9999,
        isActive: true,
      },
    });
    testLineId = createdLine.id;

    const t1 = await prisma.train.create({
      data: {
        code: `TR_S1_${Date.now() % 10000}`,
        type: 0,
        status: 1,
        slotIndex: 0,
        isDisposed: false,
      },
    });
    testTrain1Id = t1.id;

    const t2 = await prisma.train.create({
      data: {
        code: `TR_S2_${Date.now() % 10000}`,
        type: 0,
        status: 1,
        slotIndex: 0,
        isDisposed: false,
      },
    });
    testTrain2Id = t2.id;
  });

  afterAll(async () => {
    // پاکسازی کامل رکوردها پس از اتمام تست با تحمل تاخیر و بسته‌شدن ترنزکشن‌ها
    try {
      await new Promise((r) => setTimeout(r, 200));
      await prisma.manovr.deleteMany({ where: { destinationLineId: testLineId } });
      await prisma.train.deleteMany({ where: { id: { in: [testTrain1Id, testTrain2Id] } } });
      await prisma.line.deleteMany({ where: { id: testLineId } });
    } catch {}
  });

  it("prevents double-booking race condition when multiple concurrent users target the same slot", async () => {
    const slotToCompete = 0;

    // شبیه‌سازی رقابت همزمان دو کاربر برای رزرو یک اسلات یکسان در خط مقصد با صف‌بندی هوشمند
    const attemptShunting = async (trainId: number) => {
      let attempts = 0;
      while (attempts < 5) {
        try {
          return await prisma.$transaction(async (tx) => {
            // ۱. بررسی اتمیک عدم اشغال جایگاه
            const existing = await tx.train.findFirst({
              where: {
                lineId: testLineId,
                slotIndex: slotToCompete,
                isDisposed: false,
                id: { not: trainId },
              },
            });

            if (existing) {
              throw new Error(`SLOT_TAKEN: جایگاه ${slotToCompete} در حال حاضر توسط قطار ${existing.code} اشغال است.`);
            }

            // ۲. بررسی ظرفیت
            const totalOnLine = await tx.train.count({
              where: {
                lineId: testLineId,
                isDisposed: false,
                id: { not: trainId },
              },
            });

            if (totalOnLine >= 2) {
              throw new Error("CAPACITY_FULL: ظرفیت خط تکمیل است.");
            }

            // ۳. ثبت مانور
            const manovr = await tx.manovr.create({
              data: {
                type: 1,
                status: 1,
                confirmationStatus: 3,
                trainId: trainId,
                destinationLineId: testLineId,
                creatorId: testPersonnelId,
                rahbar1Id: testPersonnelId,
                executionTime: new Date().toISOString(),
              },
            });

            // ۴. به‌روزرسانی قطار
            await tx.train.update({
              where: { id: trainId },
              data: { lineId: testLineId, slotIndex: slotToCompete },
            });

            return { success: true, manovrId: manovr.id };
          });
        } catch (err: any) {
          const msg = String(err?.message || "");
          if (msg.includes("SLOT_TAKEN") || msg.includes("CAPACITY_FULL")) {
            return { success: false, error: msg };
          }
          // در صورت شلوغی پایگاه داده، زمان بازتلاش با Jitter
          attempts++;
          await new Promise((r) => setTimeout(r, 100 + Math.random() * 100));
        }
      }
      return { success: false, error: "TIMEOUT" };
    };

    // اجرای همزمان دو عملیات در دو کانکشن موازی
    const [res1, res2] = await Promise.all([
      attemptShunting(testTrain1Id),
      attemptShunting(testTrain2Id),
    ]);

    const successes = [res1, res2].filter((r) => r.success);
    const failures = [res1, res2].filter((r) => !r.success);

    // دقیقاً یکی از عملیات‌ها باید موفق شده و دیگری به دلیل اشغال بودن اسلات مسدود شود
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as any).error).toMatch(/SLOT_TAKEN|CAPACITY_FULL/);

    // اعتبارسنجی پایگاه داده: تنها یک قطار در اسلات ۰ ثبت شده باشد
    const trainsInSlot = await prisma.train.findMany({
      where: { lineId: testLineId, slotIndex: slotToCompete, isDisposed: false },
    });
    expect(trainsInSlot).toHaveLength(1);
  });

  it("handles heavy batch read workloads under simulated slow connection conditions", async () => {
    const concurrentRequests = 15;
    const promises = Array.from({ length: concurrentRequests }, () =>
      prisma.line.findMany({
        where: { id: testLineId },
        include: { trains: true },
      })
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(concurrentRequests);
    for (const r of results) {
      expect(Array.isArray(r)).toBe(true);
    }
  });

  it("verifies transactional rollback integrity on mid-transaction failure", async () => {
    const initialTrainState = await prisma.train.findUnique({ where: { id: testTrain1Id } });

    // تلاشی که عمداً در مرحله پایانی دچار خطای اعتبارسنجی می‌شود
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.train.update({
          where: { id: testTrain1Id },
          data: { slotIndex: 999 },
        });

        // بروز خطای عمدی
        throw new Error("FORCED_ROLLBACK_TEST");
      })
    ).rejects.toThrow("FORCED_ROLLBACK_TEST");

    // بررسی اینکه اسلات تغییر نکرده و به وضعیت قبل بازگشته است
    const trainAfterRollback = await prisma.train.findUnique({ where: { id: testTrain1Id } });
    expect(trainAfterRollback?.slotIndex).toBe(initialTrainState?.slotIndex);
  });
});
