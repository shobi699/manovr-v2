"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm, getRoleLevel } from "@/lib/perms";
import { audit } from "@/lib/audit";
import { ManovrType, isAdmin } from "@/lib/enums";
import { hasRoomOnLine, shouldSetKafshak, isPermanentTransfer } from "@/lib/manovr-rules";
import {
  createManovrSchema,
  confirmManovrSchema,
  finishManovrSchema,
  bulkConfirmManovrSchema,
  bulkFinishManovrSchema,
  bulkDeleteManovrSchema,
  formatZodError,
} from "@/lib/validations";
import { getOfflinePolicy } from "@/lib/settings";
import { getNetworkStatus } from "@/lib/network-status";
import { recordOfflineAction, withFastOfflineFallback } from "@/lib/offline-sync";

// خطای دامنه‌ای که باید به پیام کاربر تبدیل شود، نه خطای ۵۰۰
class ManovrError extends Error {}

export async function createManovr(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string, success?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "ابتدا وارد شوید." };
  if (!(await hasPerm(session, "manovr.create")))
    return { error: "دسترسی ندارید. شما اجازه ثبت مانور را ندارید." };

  // بررسی سیاست کار در زمان قطعی شبکه
  const netStatus = await getNetworkStatus();
  const offlinePolicy = await getOfflinePolicy();
  if (!netStatus.isShared) {
    if (offlinePolicy === "read_only") {
      return {
        error:
          "ارتباط با سرور متمرکز دپو برقرار نیست. طبق تنظیمات مدیریت، در زمان قطعی شبکه سیستم در حالت «فقط مشاهده» قرار دارد و امکان ثبت مانور جدید مسدود است.",
      };
    }
  }

  const rawInput = Object.fromEntries(fd.entries());
  const parsed = createManovrSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: formatZodError(parsed.error) };
  }

  const {
    type,
    trainId,
    rahbar1Id,
    rahbar2Id,
    sourceLineId: formSourceLineId,
    destinationLineId: formDestLineId,
    slotIndex,
    description,
    executionTime,
    noRedirect,
  } = parsed.data;

  // دریافت اطلاعات قطار برای تعیین خط فعلی
  const train = await prisma.train.findUnique({ where: { id: trainId } });
  if (!train) return { error: "قطار مورد نظر یافت نشد." };

  const isPerm = isPermanentTransfer(type);
  let sourceLineId = formSourceLineId || train.lineId;
  let destinationLineId = formDestLineId || (sourceLineId || train.lineId);

  if (!destinationLineId && !isPerm) return { error: "لطفا مقصد را انتخاب نمایید." };
  if (!sourceLineId) sourceLineId = destinationLineId || 1;
  if (!destinationLineId) destinationLineId = sourceLineId;

  // بررسی ظرفیت و ثبت مانور و جابجایی قطار باید اتمیک باشند تا دو مانور همزمان
  // نتوانند هر دو از یک ظرفیت باقیمانده عبور کنند
  let created: any = null;
  let wasOffline = false;

  try {
    const executeDbTransaction = async () => {
      return await prisma.$transaction(async (tx) => {
        let dest = null;
        if (destinationLineId) {
          dest = await tx.line.findUnique({ where: { id: destinationLineId } });
        }

        // در مانور انتقال دائم (خروج قطار)، قطار از پایانه خارج می‌شود و ظرفیت اشغال نمی‌کند
        if (!isPerm && dest) {
          // ۱. بررسی ظرفیت کلی خط مقصد (بدون احتساب خود این قطار تا مانور در محل مسدود نشود)
          const onDest = await tx.train.count({
            where: {
              lineId: destinationLineId,
              isDisposed: false,
              id: { not: trainId },
            },
          });
          if (!hasRoomOnLine(onDest, dest.capacity)) {
            throw new ManovrError("ظرفیت خط مقصد پر شده است.");
          }

          // ۲. بررسی محدوده مجاز اسلات بر اساس ظرفیت خط
          if (slotIndex < 0 || slotIndex >= dest.capacity) {
            throw new ManovrError(`جایگاه انتخابی خارج از ظرفیت خط مقصد (${dest.capacity} جایگاه) است.`);
          }

          // ۳. بررسی اتمیک عدم اشغال همزمان اسلات توسط قطار دیگر (جلوگیری قطعی از Race Condition و رزرو دوبل)
          const existingInSlot = await tx.train.findFirst({
            where: {
              lineId: destinationLineId,
              slotIndex: slotIndex,
              isDisposed: false,
              id: { not: trainId },
            },
          });
          if (existingInSlot) {
            throw new ManovrError(`جایگاه ${slotIndex + 1} در خط ${dest.name} در حال حاضر توسط قطار ${existingInSlot.code} اشغال شده است.`);
          }
        }

        const manovr = await tx.manovr.create({
          data: {
            type,
            status: 1,
            confirmationStatus: 3,
            description: isPerm && !description ? "انتقال دائم و خروج قطار از پایانه" : description,
            sourceLineId,
            destinationLineId,
            trainId,
            rahbar1Id,
            rahbar2Id,
            creatorId: session.id,
            executionTime,
          },
          include: {
            train: true,
            sourceLine: true,
            destinationLine: true,
          },
        });

        const trainUpdateData: {
          lineId: number | null;
          slotIndex: number;
          isDisposed?: boolean;
          hasKafshak?: boolean;
        } = isPerm
          ? { isDisposed: true, lineId: null, slotIndex: 0 }
          : { lineId: destinationLineId, slotIndex };

        if (shouldSetKafshak(type)) {
          trainUpdateData.hasKafshak = true;
        }

        await tx.train.update({
          where: { id: trainId },
          data: trainUpdateData,
        });

        return manovr;
      });
    };

    const handleOfflineFallback = async () => {
      wasOffline = true;
      await recordOfflineAction({
        actionType: "CREATE_MANOVR",
        data: {
          type,
          trainId,
          sourceLineId,
          destinationLineId,
          slotIndex,
          rahbar1Id,
          rahbar2Id,
          creatorId: session.id,
          description,
          executionTime: executionTime ? executionTime.toISOString() : undefined,
          status: 1,
        },
        timestamp: new Date().toISOString(),
        userId: session.id,
        userFullName: (session as any).name || (session as any).username || "کاربر سیستم",
      });
    };

    // اگر ارتباط شبکه قطع باشد، مستقیماً به صف آفلاین می‌رود
    if (!netStatus.isShared) {
      await handleOfflineFallback();
    } else {
      // در صورت برقراری اتصال، اگر شبکه کند باشد و ثبت بیش از ۳ ثانیه طول بکشد، بی‌درنگ در صف محلی ثبت می‌شود
      const fallbackResult = await withFastOfflineFallback(
        executeDbTransaction,
        handleOfflineFallback,
        3000 // سقف استاندارد ۳ ثانیه‌ای برای جلوگیری از تاخیر کاربر
      );

      if (fallbackResult.wasOfflineFallback) {
        wasOffline = true;
      } else {
        created = fallbackResult.result;
      }
    }
  } catch (err) {
    if (err instanceof ManovrError) return { error: err.message };
    console.error("createManovr transaction error:", err);
    return { error: "خطایی در ثبت مانور در دیتابیس رخ داد." };
  }

  // ثبت لاگ وقایع
  const trainCode = created?.train?.code || String(trainId);
  const srcName = created?.sourceLine?.name || "نامشخص";
  const destName = created?.destinationLine?.name || "نامشخص";
  const typeLabel = ManovrType[type] || `نوع ${type}`;
  const isSameLine = sourceLineId === destinationLineId;
  const auditMessage = wasOffline
    ? `مانور ${typeLabel} به علت کندی یا قطعی شبکه دپو با موفقیت در صف آفلاین محلی ثبت شد و به محض ثبات شبکه با سرور همگام می‌شود.`
    : isPerm
    ? `ثبت مانور ${typeLabel} - خروج دائم قطار کد ${trainCode} از پایانه`
    : isSameLine
    ? `مانور در محل (ثابت) برای قطار ${trainCode} روی خط ${destName} ثبت گردید.`
    : `مانور جدیدی برای قطار ${trainCode} از خط ${srcName} به خط ${destName} ثبت گردید.`;

  try {
    await audit(
      session,
      "manovr",
      created?.id || 0,
      "CREATE",
      null,
      created || { trainId, sourceLineId, destinationLineId, wasOffline: true },
      auditMessage
    );
  } catch {}

  revalidatePath("/manovrs");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  
  if (noRedirect) {
    return { success: true };
  }
  redirect("/manovrs");
}

export async function finishManovr(id: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "manovr.edit"))) return { error: "دسترسی ندارید." };

  const parsed = finishManovrSchema.safeParse({ id });
  if (!parsed.success) return { error: formatZodError(parsed.error) };

  const before = await prisma.manovr.findUnique({ where: { id } });
  if (!before) return { error: "مانور مورد نظر یافت نشد." };

  // بررسی قفل سوابق تکمیل‌شده ("به پایان رسید" / status === 2)
  if (before.status === 2) {
    return { error: "این مانور قبلاً به پایان رسیده است و امکان ویرایش یا خاتمه مجدد آن وجود ندارد." };
  }

  const after = await prisma.manovr.update({
    where: { id },
    data: { status: 2, finishedAt: new Date() },
  });

  await audit(
    session,
    "manovr",
    id,
    "UPDATE",
    before,
    after,
    `مانور شماره ${id} خاتمه یافته و با موفقیت بسته شد.`
  );

  revalidatePath("/manovrs");
  revalidatePath("/manovrs/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  return { ok: true };
}

export async function confirmManovr(id: number, value: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "manovr.confirm"))) return { error: "دسترسی ندارید." };

  const parsed = confirmManovrSchema.safeParse({ id, status: value });
  if (!parsed.success) return { error: formatZodError(parsed.error) };

  const before = await prisma.manovr.findUnique({ where: { id } });
  const after = await prisma.manovr.update({
    where: { id },
    data: { confirmationStatus: value },
  });

  const word = value === 1 ? "تأیید" : "رد";
  await audit(
    session,
    "manovr",
    id,
    "CONFIRM",
    before,
    after,
    `سند مانور شماره ${id} توسط مسئول شیفت ${word} گردید.`
  );

  revalidatePath("/manovrs");
  revalidatePath("/manovrs/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  return { ok: true };
}

export async function bulkConfirmManovr(ids: number[], value: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "manovr.confirm"))) {
    return { error: "دسترسی ندارید. شما مجوز تأیید یا رد مانورها را ندارید." };
  }

  const parsed = bulkConfirmManovrSchema.safeParse({ ids, status: value });
  if (!parsed.success) return { error: formatZodError(parsed.error) };

  const validIds = parsed.data.ids;
  const word = value === 1 ? "تأیید" : "رد";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const records = await tx.manovr.findMany({
        where: { id: { in: validIds }, status: { not: 3 } },
        select: { id: true, confirmationStatus: true },
      });

      if (records.length === 0) {
        throw new Error("هیچ مانور معتبری برای تغییر وضعیت یافت نشد.");
      }

      await tx.manovr.updateMany({
        where: { id: { in: records.map((r) => r.id) } },
        data: { confirmationStatus: value },
      });

      return records;
    });

    await audit(
      session,
      "manovr",
      validIds[0],
      "CONFIRM",
      null,
      { count: result.length, status: value, ids: validIds },
      `${result.length} فقره مانور به صورت گروهی توسط مسئول شیفت ${word} گردید.`
    );

    revalidatePath("/manovrs");
    revalidatePath("/manovrs/approvals");
    revalidatePath("/dashboard");
    return { ok: true, count: result.length };
  } catch (err: any) {
    console.error("bulkConfirmManovr error:", err);
    return { error: err?.message || "خطا در تأیید یا رد گروهی مانورها." };
  }
}

export async function deleteManovr(id: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "manovr.delete"))) return { error: "دسترسی ندارید." };

  const before = await prisma.manovr.findUnique({ where: { id } });
  if (!before) return { error: "مانور مورد نظر یافت نشد." };

  // قفل امنیتی: مانورهای تکمیل‌شده («به پایان رسید» / status === 2) فقط توسط مدیر سیستم قابل حذف هستند
  if (before.status === 2) {
    const isManager = isAdmin(session.role) || getRoleLevel(session.role) >= 80;
    if (!isManager) {
      return {
        error: "این مانور به پایان رسیده است. حذف مانورهای خاتمه‌یافته منحصراً در اختیارات مدیر سیستم می‌باشد.",
      };
    }
  }

  const after = await prisma.manovr.update({ where: { id }, data: { status: 3 } });

  await audit(
    session,
    "manovr",
    id,
    "DELETE",
    before,
    after,
    before.status === 2
      ? `سند مانور خاتمه‌یافته شماره ${id} توسط مدیر سیستم به صورت نرم حذف گردید.`
      : `سند مانور شماره ${id} به صورت نرم از سیستم حذف گردید.`
  );

  revalidatePath("/manovrs");
  revalidatePath("/manovrs/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  return { ok: true };
}

/**
 * اتمام و بستن دسته‌جمعی (گروهی) مانورها
 */
export async function bulkFinishManovr(ids: number[]) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "manovr.edit"))) {
    return { error: "دسترسی ندارید. شما مجوز خاتمه مانورها را ندارید." };
  }

  const parsed = bulkFinishManovrSchema.safeParse({ ids });
  if (!parsed.success) return { error: formatZodError(parsed.error) };

  const validIds = parsed.data.ids;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // فقط مانورهایی که در حال اجرا هستند (status === 1)
        const records = await tx.manovr.findMany({
          where: { id: { in: validIds }, status: 1 },
          select: { id: true, trainId: true },
        });

        if (records.length === 0) {
          throw new Error("هیچ مانور در حال اجرایی برای بستن یافت نشد.");
        }

        await tx.manovr.updateMany({
          where: { id: { in: records.map((r) => r.id) } },
          data: { status: 2, finishedAt: new Date() },
        });

        return records;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    await audit(
      session,
      "manovr",
      validIds[0],
      "UPDATE",
      null,
      { count: result.length, ids: validIds },
      `${result.length} فقره مانور در حال اجرا به صورت گروهی خاتمه یافته و بسته شدند.`
    );

    revalidatePath("/manovrs");
    revalidatePath("/manovrs/approvals");
    revalidatePath("/dashboard");
    revalidatePath("/depot");
    return { ok: true, count: result.length };
  } catch (err: any) {
    console.error("bulkFinishManovr error:", err);
    return { error: err?.message || "خطا در بستن گروهی مانورها." };
  }
}

/**
 * حذف دسته‌جمعی (گروهی) مانورها با رعایت قیود امنیتی مدیر
 */
export async function bulkDeleteManovr(ids: number[]) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "manovr.delete"))) {
    return { error: "دسترسی ندارید. شما مجوز حذف مانورها را ندارید." };
  }

  const parsed = bulkDeleteManovrSchema.safeParse({ ids });
  if (!parsed.success) return { error: formatZodError(parsed.error) };

  const validIds = parsed.data.ids;
  const isManager = isAdmin(session.role) || getRoleLevel(session.role) >= 80;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const records = await tx.manovr.findMany({
          where: { id: { in: validIds }, status: { not: 3 } },
          select: { id: true, status: true },
        });

        if (records.length === 0) {
          throw new Error("هیچ مانور فعالی برای حذف یافت نشد.");
        }

        // اگر کاربر مدیر نیست، مانورهای تکمیل‌شده (status === 2) حذف نشوند
        const allowedRecords = isManager
          ? records
          : records.filter((r) => r.status !== 2);

        if (allowedRecords.length === 0) {
          throw new Error("مانورهای انتخاب‌شده به پایان رسیده‌اند و حذف آن‌ها منحصراً در اختیارات مدیر سیستم می‌باشد.");
        }

        await tx.manovr.updateMany({
          where: { id: { in: allowedRecords.map((r) => r.id) } },
          data: { status: 3 },
        });

        return allowedRecords;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    await audit(
      session,
      "manovr",
      validIds[0],
      "DELETE",
      null,
      { count: result.length, ids: validIds },
      `${result.length} فقره مانور به صورت گروهی از سیستم حذف نرم گردیدند.`
    );

    revalidatePath("/manovrs");
    revalidatePath("/manovrs/approvals");
    revalidatePath("/dashboard");
    revalidatePath("/depot");
    return { ok: true, count: result.length };
  } catch (err: any) {
    console.error("bulkDeleteManovr error:", err);
    return { error: err?.message || "خطا در حذف گروهی مانورها." };
  }
}


