"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { emitSSEEvent } from "@/lib/events";
import { revalidatePath } from "next/cache";

/**
 * دریافت لیست پرسنل فعال سیستم برای ارجاع/انتساب تیکت‌ها
 */
export async function getActivePersonnel() {
  const session = await getSession();
  if (!session) return { ok: false, error: "کاربر احراز هویت نشده است" };

  try {
    const list = await prisma.personnel.findMany({
      where: { hasAccount: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: { lastName: "asc" },
    });
    return { ok: true, data: list };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در دریافت لیست پرسنل" };
  }
}

/**
 * ارسال پیام عمومی/خصوصی توسط مدیر (Broadcast & Direct Message)
 */
export async function sendAdminMessage(data: {
  title: string;
  body: string;
  kind: "info" | "success" | "warning" | "alert";
  targetUserId?: number | null; // نال یعنی ارسال همگانی
}) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "branding.manage"))) {
    return { ok: false, error: "عدم دسترسی کافی (فقط مدیر سیستم)" };
  }

  try {
    if (data.targetUserId) {
      // ارسال پیام به یک کاربر مشخص
      const notif = await prisma.notification.create({
        data: {
          userId: Number(data.targetUserId),
          kind: data.kind,
          title: data.title,
          body: data.body,
        },
      });
      emitSSEEvent("notification_new", { userId: notif.userId });
    } else {
      // ارسال پیام همگانی (به تمام پرسنل فعال)
      const allPersonnel = await prisma.personnel.findMany({
        select: { id: true },
      });

      const notifsData = allPersonnel.map((p) => ({
        userId: p.id,
        kind: data.kind,
        title: data.title,
        body: data.body,
      }));

      await prisma.notification.createMany({
        data: notifsData,
      });

      emitSSEEvent("notification_new", { broadcast: true });
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در ارسال پیام" };
  }
}

/**
 * ایجاد تیکت پشتیبانی جدید توسط هر کاربر با امکان انتساب اولیه
 */
export async function createTicket(title: string, body: string, assigneeId?: number | null) {
  const session = await getSession();
  if (!session) return { ok: false, error: "کاربر احراز هویت نشده است" };

  try {
    // ۱. ایجاد تیکت
    const ticket = await prisma.ticket.create({
      data: {
        title,
        body,
        status: "open",
        creatorId: session.id,
        assigneeId: assigneeId ? Number(assigneeId) : null,
      },
    });

    // ۲. ثبت گردش کار اولیه تیکت
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        fromUserId: session.id,
        toUserId: assigneeId ? Number(assigneeId) : null,
        action: "CREATE",
        note: "ثبت اولیه تیکت در کارتابل",
      },
    });

    // ۳. ارسال اعلان
    if (assigneeId) {
      // ارسال اعلان به شخص منتسب شده
      await prisma.notification.create({
        data: {
          userId: Number(assigneeId),
          kind: "info",
          title: `تیکت ارجاع شده جدید: ${title}`,
          body: `یک تیکت عملیاتی جدید توسط ${session.fullName} به شما ارجاع گردید.`,
          link: "/tickets",
        },
      });
      emitSSEEvent("notification_new", { userId: Number(assigneeId) });
    } else {
      // ارسال اعلان به مدیران در صورت عدم انتساب به شخص خاص
      const admins = await prisma.personnel.findMany({
        where: { role: 1 },
        select: { id: true },
      });

      const notifs = admins.map((admin) => ({
        userId: admin.id,
        kind: "info" as const,
        title: `تیکت عمومی جدید: ${title}`,
        body: `یک تیکت عملیاتی عمومی جدید توسط ${session.fullName} ثبت گردید.`,
        link: "/tickets",
      }));

      if (notifs.length > 0) {
        await prisma.notification.createMany({ data: notifs });
        emitSSEEvent("notification_new", { role: 1 });
      }
    }

    emitSSEEvent("ticket_changed", { ticketId: ticket.id });
    return { ok: true, data: ticket };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در ثبت تیکت" };
  }
}

/**
 * دریافت لیست تیکت‌ها (مدیر کل تیکت‌ها را می‌بیند، کاربر فقط تیکت‌های ایجاد شده یا ارجاع شده به خود را)
 */
export async function getTicketsList() {
  const session = await getSession();
  if (!session) return { ok: false, error: "کاربر احراز هویت نشده است" };

  const isSuperAdmin = session.role === 4;

  try {
    const tickets = await prisma.ticket.findMany({
      where: isSuperAdmin
        ? {}
        : {
            OR: [
              { creatorId: session.id },
              { assigneeId: session.id },
            ],
          },
      orderBy: { createdAt: "desc" },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, avatarColor: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true, avatarColor: true },
        },
        replies: {
          orderBy: { createdAt: "asc" },
        },
        history: {
          orderBy: { createdAt: "asc" },
          include: {
            fromUser: { select: { id: true, firstName: true, lastName: true } },
            toUser: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return { ok: true, data: tickets };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در دریافت لیست تیکت‌ها" };
  }
}

/**
 * ارجاع (Forward/Reassign) تیکت به شخص دیگر
 */
export async function reassignTicket(ticketId: number, targetUserId: number, note?: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: "کاربر احراز هویت نشده است" };

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) return { ok: false, error: "تیکت یافت نشد" };

    // بررسی دسترسی: فقط سازنده، منتسب شده‌ی فعلی یا سوپرادمین می‌توانند ارجاع دهند
    const isSuperAdmin = session.role === 4;
    if (ticket.creatorId !== session.id && ticket.assigneeId !== session.id && !isSuperAdmin) {
      return { ok: false, error: "شما اجازه ارجاع این تیکت را ندارید." };
    }

    // ۱. آپدیت گیرنده تیکت
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assigneeId: Number(targetUserId),
        updatedAt: new Date(),
      },
    });

    // ۲. ثبت در تاریخچه گردش کار
    await prisma.ticketHistory.create({
      data: {
        ticketId,
        fromUserId: session.id,
        toUserId: Number(targetUserId),
        action: "REASSIGN",
        note: note || "ارجاع تیکت به همکار دیگر",
      },
    });

    // ۳. ارسال اعلان به دریافت‌کننده جدید ارجاع
    await prisma.notification.create({
      data: {
        userId: Number(targetUserId),
        kind: "info",
        title: "ارجاع تیکت به کارتابل شما",
        body: `تیکت "${ticket.title}" توسط ${session.fullName} به شما ارجاع گردید.`,
        link: "/tickets",
      },
    });

    emitSSEEvent("notification_new", { userId: Number(targetUserId) });
    emitSSEEvent("ticket_changed", { ticketId });

    return { ok: true, data: updatedTicket };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در ارجاع تیکت" };
  }
}

/**
 * ارسال پاسخ به تیکت به همراه ثبت لاگ در گردش کار
 */
export async function replyToTicket(ticketId: number, body: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: "کاربر احراز هویت نشده است" };

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { creator: true },
    });
    if (!ticket) return { ok: false, error: "تیکت یافت نشد" };

    // بررسی دسترسی: فقط سازنده، منتسب شده یا سوپرادمین می‌توانند پاسخ دهند
    const isSuperAdmin = session.role === 4;
    if (ticket.creatorId !== session.id && ticket.assigneeId !== session.id && !isSuperAdmin) {
      return { ok: false, error: "شما اجازه ثبت پاسخ در این تیکت را ندارید." };
    }

    // ۱. ثبت پاسخ
    const reply = await prisma.ticketReply.create({
      data: {
        ticketId,
        body,
        userId: session.id,
      },
    });

    // ۲. ثبت در تاریخچه گردش کار به عنوان اقدام پاسخ
    await prisma.ticketHistory.create({
      data: {
        ticketId,
        fromUserId: session.id,
        action: "REPLY",
        note: "ثبت پاسخ جدید در گفتگو",
      },
    });

    // ۳. ارسال اعلان‌ها به افراد درگیر در تیکت (سازنده و منتسب‌شونده)
    const targets = new Set<number>();
    if (ticket.creatorId !== session.id) targets.add(ticket.creatorId);
    if (ticket.assigneeId && ticket.assigneeId !== session.id) targets.add(ticket.assigneeId);

    for (const targetId of targets) {
      await prisma.notification.create({
        data: {
          userId: targetId,
          kind: "success",
          title: "پاسخ جدید به تیکت",
          body: `پاسخ جدیدی برای تیکت "${ticket.title}" توسط ${session.fullName} ثبت شد.`,
          link: "/tickets",
        },
      });
      emitSSEEvent("notification_new", { userId: targetId });
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "open", updatedAt: new Date() },
    });

    emitSSEEvent("ticket_changed", { ticketId });
    return { ok: true, data: reply };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در ثبت پاسخ" };
  }
}

/**
 * بستن یا حل تیکت به همراه ثبت لاگ تغییر وضعیت
 */
export async function updateTicketStatus(ticketId: number, status: "resolved" | "closed" | "open") {
  const session = await getSession();
  if (!session) return { ok: false, error: "کاربر احراز هویت نشده است" };

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) return { ok: false, error: "تیکت یافت نشد" };

    const isSuperAdmin = session.role === 4;
    if (ticket.creatorId !== session.id && ticket.assigneeId !== session.id && !isSuperAdmin) {
      return { ok: false, error: "عدم دسترسی کافی برای تغییر وضعیت این تیکت" };
    }

    // ۱. به‌روزرسانی وضعیت تیکت
    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    });

    // ۲. ثبت در تاریخچه گردش کار به عنوان تغییر وضعیت
    const statusText = status === "resolved" ? "حل شده" : status === "closed" ? "بسته شده" : "بازگشایی مجدد";
    await prisma.ticketHistory.create({
      data: {
        ticketId,
        fromUserId: session.id,
        action: "STATUS_CHANGE",
        note: `تغییر وضعیت تیکت به: ${statusText}`,
      },
    });

    // ۳. ارسال اعلان به سازنده تیکت اگر شخص دیگری وضعیت را تغییر دهد
    if (ticket.creatorId !== session.id) {
      await prisma.notification.create({
        data: {
          userId: ticket.creatorId,
          kind: "info",
          title: "تغییر وضعیت تیکت",
          body: `وضعیت تیکت "${ticket.title}" به "${statusText}" تغییر یافت.`,
          link: "/tickets",
        },
      });
      emitSSEEvent("notification_new", { userId: ticket.creatorId });
    }

    emitSSEEvent("ticket_changed", { ticketId });
    return { ok: true, data: updated };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در تغییر وضعیت تیکت" };
  }
}
