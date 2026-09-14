import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/auth";
import { emitSSEEvent, emitEntityChanged } from "@/lib/events";

// محاسبه تفاوت‌های دو شیء
export function computeDiff(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  
  const allKeys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  
  const ignoreKeys = ["createdAt", "updatedAt", "passwordHash", "id"];
  const isRelation = (v: unknown) => v !== null && typeof v === "object";

  for (const key of allKeys) {
    if (ignoreKeys.includes(key)) continue;
    // فیلدهای رابطه‌ای (آبجکت یا آرایه) نادیده گرفته می‌شوند، اما null یک مقدار
    // اسکالر معتبر است و باید ثبت شود — typeof null برابر "object" است و این
    // تله‌ای بود که باعث حذف خاموش تغییرات null می‌شد.
    if (isRelation(before?.[key]) || isRelation(after?.[key])) continue;

    const oldVal = before?.[key];
    const newVal = after?.[key];

    if (oldVal !== newVal) {
      diff[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  }

  return diff;
}

// ثبت لاگ وقایع و تولید اعلان‌های هدفمند
export async function audit(
  session: Session | null,
  entity: string,
  entityId: number,
  action: "CREATE" | "UPDATE" | "DELETE" | "CONFIRM",
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  customSummary?: string
) {
  const actorId = session?.id ?? null;
  const actorName = session ? session.fullName : "سیستم";

  const diff = computeDiff(before, after);
  const changesJson = JSON.stringify(diff);

  // تولید خلاصه متنی پیش‌فرض در صورت عدم ارسال
  let summary = customSummary || "";
  if (!summary) {
    const actionWord =
      action === "CREATE"
        ? "ایجاد"
        : action === "UPDATE"
          ? "ویرایش"
          : action === "DELETE"
            ? "حذف"
            : "تأیید";
    summary = `موجودیت ${entity} با شناسه ${entityId} توسط ${actorName} ${actionWord} شد.`;
  }

  try {
    // ۱. ثبت در جدول AuditLog
    const log = await prisma.auditLog.create({
      data: {
        actorId,
        actorName,
        entity,
        entityId,
        action,
        changes: changesJson,
        summary,
      },
    });

    // ۲. تولید اعلان‌های خودکار
    await handleAutoNotifications(session, entity, entityId, action, before, after, summary);

    // ۳. انتشار رویداد به استریم SSE (فقط سیگنال ابطال — خلاصه و دیف لاگ محرمانه است و نباید همگانی منتشر شود)
    emitEntityChanged(entity, { id: entityId, action });

    return log;
  } catch (error) {
    console.error("Audit logger failed:", error);
  }
}

// تولید خودکار اعلان‌ها بر اساس سناریوهای تعریف شده
async function handleAutoNotifications(
  session: Session | null,
  entity: string,
  entityId: number,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  summary: string
) {
  // سناریو ۱: ثبت مانور جدید -> اعلان به تمام دارندگان مجوز تایید مانور (مسئولین شیفت و ادمین‌ها)
  if (entity === "manovr" && action === "CREATE") {
    // یافتن تمام پرسنلی که دسترسی تایید مانور دارند (نقش‌های ادمین و مسئول یا دارای مجوز سفارشی)
    const users = await prisma.personnel.findMany({
      where: {
        hasAccount: true,
        OR: [
          { role: { in: [1, 2, 4] } },
          {
            accessRole: {
              permissions: {
                contains: "manovr.confirm",
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    const notifsData = users.map((u) => ({
      userId: u.id,
      kind: "warning",
      title: "مانور جدید در انتظار تأیید",
      body: summary,
      link: "/manovrs/approvals",
    }));

    if (notifsData.length > 0) {
      await prisma.notification.createMany({ data: notifsData });
      // ارسال زنده به SSE
      for (const n of notifsData) {
        emitSSEEvent(`notification:${n.userId}`, {
          type: "new_notification",
          notification: n,
        });
      }
    }
  }

  // سناریو ۲: تایید یا رد مانور -> اعلان به ثبت‌کننده مانور
  if (entity === "manovr" && action === "CONFIRM") {
    const creatorId = Number(after?.creatorId || before?.creatorId);
    if (creatorId && creatorId !== session?.id) {
      const isApproved = after?.confirmationStatus === 1;
      const notif = await prisma.notification.create({
        data: {
          userId: creatorId,
          kind: isApproved ? "success" : "alert",
          title: isApproved ? "تأیید مانور شما" : "رد مانور شما",
          body: summary,
          link: "/manovrs",
        },
      });

      emitSSEEvent(`notification:${creatorId}`, {
        type: "new_notification",
        notification: notif,
      });
    }
  }
}
