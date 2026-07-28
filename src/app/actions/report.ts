"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";

import { executeReportQuery, type ReportConfig } from "@/lib/report-engine";

// اجرای کوئری گزارش دلخواه به صورت امن
export async function runDynamicReport(config: ReportConfig) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "report.build"))) {
    return { error: "دسترسی ندارید." };
  }

  try {
    const records = await executeReportQuery(config);
    return { records };
  } catch (err: any) {
    return { error: `خطا در اجرای گزارش: ${err.message}` };
  }
}

// ذخیره گزارش جدید
export async function saveReportAction(name: string, config: ReportConfig, isShared = false) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "report.build"))) {
    return { error: "دسترسی ندارید." };
  }
  if (!name.trim()) return { error: "نام گزارش الزامی است." };

  try {
    const report = await prisma.savedReport.create({
      data: {
        name: name.trim(),
        ownerId: session.id,
        isShared,
        config: JSON.stringify(config),
      },
    });
    revalidatePath("/reports");
    return { report };
  } catch (err: any) {
    return { error: err.message };
  }
}

// دریافت گزارش‌های ذخیره شده
export async function getSavedReportsAction() {
  const session = await getSession();
  if (!session) return [];

  // نمایش گزارش‌های خود کاربر یا گزارش‌های به اشتراک گذاشته شده
  return prisma.savedReport.findMany({
    where: {
      OR: [
        { ownerId: session.id },
        { isShared: true },
      ],
    },
    include: { owner: true },
    orderBy: { createdAt: "desc" },
  });
}

// حذف گزارش ذخیره شده
export async function deleteSavedReportAction(id: number) {
  const session = await getSession();
  if (!session) return { error: "دسترسی ندارید." };

  const report = await prisma.savedReport.findUnique({ where: { id } });
  if (!report) return { error: "گزارش یافت نشد." };

  if (report.ownerId !== session.id && session.role !== 1) {
    return { error: "شما مالک این گزارش نیستید و اجازه حذف آن را ندارید." };
  }

  await prisma.savedReport.delete({ where: { id } });
  revalidatePath("/reports");
  return { ok: true };
}
