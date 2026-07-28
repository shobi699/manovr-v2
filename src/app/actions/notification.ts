"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// دریافت لیست ۲۰ اعلان آخر کاربر جاری
export async function getNotifications() {
  const session = await getSession();
  if (!session) return { ok: false, error: "ابتدا وارد شوید." };

  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: session.id, readAt: null },
    });
    return { ok: true, data: notifs, unreadCount };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در دریافت اعلان‌ها" };
  }
}

// ثبت خوانده شدن یک اعلان
export async function markNotificationAsRead(id: number) {
  const session = await getSession();
  if (!session) return { ok: false, error: "ابتدا وارد شوید." };

  try {
    await prisma.notification.update({
      where: { id, userId: session.id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در تغییر وضعیت اعلان" };
  }
}

// ثبت خوانده شدن تمام اعلان‌های کاربر
export async function markAllNotificationsAsRead() {
  const session = await getSession();
  if (!session) return { ok: false, error: "ابتدا وارد شوید." };

  try {
    await prisma.notification.updateMany({
      where: { userId: session.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در به‌روزرسانی وضعیت اعلان‌ها" };
  }
}
