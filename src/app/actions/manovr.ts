"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { audit } from "@/lib/audit";
import { ManovrType } from "@/lib/enums";
import { hasRoomOnLine, shouldSetKafshak, isPermanentTransfer } from "@/lib/manovr-rules";

// خطای دامنه‌ای که باید به پیام کاربر تبدیل شود، نه خطای ۵۰۰
class ManovrError extends Error {}

export async function createManovr(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "ابتدا وارد شوید." };
  if (!(await hasPerm(session, "manovr.create")))
    return { error: "دسترسی ندارید. شما اجازه ثبت مانور را ندارید." };

  const type = Number(fd.get("type"));
  const trainId = Number(fd.get("trainId"));
  const destRaw = fd.get("destinationLineId");
  const sourceRaw = fd.get("sourceLineId");
  const rahbar1Id = Number(fd.get("rahbar1Id"));
  const rahbar2Raw = fd.get("rahbar2Id");
  const rahbar2Id = rahbar2Raw ? Number(rahbar2Raw) : null;
  const slotIndex = fd.get("slotIndex") ? Number(fd.get("slotIndex")) : 0;
  const description = String(fd.get("description") ?? "").trim() || null;
  const executionTimeRaw = fd.get("executionTime");
  const executionTime = executionTimeRaw ? new Date(String(executionTimeRaw)) : new Date();

  if (!type) return { error: "لطفا نوع مانور را انتخاب کنید." };
  if (!trainId) return { error: "لطفا قطار را انتخاب نمایید." };
  if (!rahbar1Id) return { error: "لطفا راهبر ۱ را انتخاب نمایید." };

  // دریافت اطلاعات قطار برای تعیین خط فعلی
  const train = await prisma.train.findUnique({ where: { id: trainId } });
  if (!train) return { error: "قطار مورد نظر یافت نمایید." };

  const isPerm = isPermanentTransfer(type);
  let sourceLineId = sourceRaw ? Number(sourceRaw) : train.lineId;
  let destinationLineId = destRaw ? Number(destRaw) : (sourceLineId || train.lineId);

  if (!destinationLineId && !isPerm) return { error: "لطفا مقصد را انتخاب نمایید." };
  if (!sourceLineId) sourceLineId = destinationLineId || 1;
  if (!destinationLineId) destinationLineId = sourceLineId;

  // بررسی ظرفیت و ثبت مانور و جابجایی قطار باید اتمیک باشند تا دو مانور همزمان
  // نتوانند هر دو از یک ظرفیت باقیمانده عبور کنند
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      let dest = null;
      if (destinationLineId) {
        dest = await tx.line.findUnique({ where: { id: destinationLineId } });
      }

      // در مانور انتقال دائم (خروج قطار)، قطار از پایانه خارج می‌شود و ظرفیت اشغال نمی‌کند
      if (!isPerm && dest) {
        // بدون احتساب خود این قطار، تا مانور در محل مسدود نشود
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
  } catch (err) {
    if (err instanceof ManovrError) return { error: err.message };
    console.error("createManovr transaction error:", err);
    return { error: "خطایی در ثبت مانور در دیتابیس رخ داد." };
  }

  // ثبت لاگ وقایع
  const trainCode = created.train?.code || String(trainId);
  const srcName = created.sourceLine?.name || "نامشخص";
  const destName = created.destinationLine?.name || "نامشخص";
  const typeLabel = ManovrType[type] || `نوع ${type}`;
  const isSameLine = sourceLineId === destinationLineId;
  const auditMessage = isPerm
    ? `ثبت مانور ${typeLabel} - خروج دائم قطار کد ${trainCode} از پایانه`
    : isSameLine
    ? `مانور در محل (ثابت) برای قطار ${trainCode} روی خط ${destName} ثبت گردید.`
    : `مانور جدیدی برای قطار ${trainCode} از خط ${srcName} به خط ${destName} ثبت گردید.`;

  await audit(
    session,
    "manovr",
    created.id,
    "CREATE",
    null,
    created,
    auditMessage
  );

  revalidatePath("/manovrs");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  redirect("/manovrs");
}

export async function finishManovr(id: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "manovr.edit"))) return { error: "دسترسی ندارید." };

  const before = await prisma.manovr.findUnique({ where: { id } });
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
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  return { ok: true };
}

export async function confirmManovr(id: number, value: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "manovr.confirm"))) return { error: "دسترسی ندارید." };

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
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  return { ok: true };
}

export async function deleteManovr(id: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "manovr.delete"))) return { error: "دسترسی ندارید." };

  const before = await prisma.manovr.findUnique({ where: { id } });
  const after = await prisma.manovr.update({ where: { id }, data: { status: 3 } });

  await audit(
    session,
    "manovr",
    id,
    "DELETE",
    before,
    after,
    `سند مانور شماره ${id} به صورت نرم از سیستم حذف گردید.`
  );

  revalidatePath("/manovrs");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  return { ok: true };
}
