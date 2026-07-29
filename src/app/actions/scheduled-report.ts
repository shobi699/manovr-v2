"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, type Session } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { audit } from "@/lib/audit";
import { resolveScheduledOutputDir } from "@/lib/report-output";

// دسترسی خواندن: گزارش خود کاربر یا گزارش اشتراکی
// دسترسی تغییر: فقط مالک گزارش یا مدیر سیستم
async function loadScheduleForMutation(id: number, session: Session) {
  const schedule = await prisma.scheduledReport.findUnique({
    where: { id },
    include: { savedReport: true },
  });
  if (!schedule) return { error: "برنامه زمان‌بندی یافت نشد." as const };
  if (schedule.savedReport.ownerId !== session.id && session.role !== 1 && session.role !== 4) {
    return { error: "شما مالک این گزارش نیستید." as const };
  }
  return { schedule };
}

export async function createScheduledReport(
  savedReportId: number,
  cron: string,
  format: string,
  recipients: string,
  outputDir: string
) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "report.build"))) {
    return { error: "دسترسی ندارید." };
  }

  if (!cron || !format || !recipients || !outputDir) {
    return { error: "همه فیلدها الزامی هستند." };
  }

  const fmt = format.toLowerCase().trim();
  if (fmt !== "excel" && fmt !== "pdf") {
    return { error: "فرمت گزارش باید excel یا pdf باشد." };
  }

  const cronParts = cron.trim().split(/\s+/);
  if (cronParts.length < 5) {
    return { error: "عبارت زمان‌بندی (کرون) نامعتبر است." };
  }

  const recipientIds = recipients
    .split(",")
    .map((id) => parseInt(id.trim()))
    .filter((id) => !isNaN(id));

  if (recipientIds.length === 0) {
    return { error: "حداقل یک دریافت‌کننده معتبر الزامی است." };
  }

  // بررسی دسترسی مالکیت بر گزارش ذخیره‌شده
  const savedReport = await prisma.savedReport.findUnique({
    where: { id: savedReportId },
  });
  if (!savedReport) {
    return { error: "گزارش ذخیره‌شده یافت نشد." };
  }
  if (savedReport.ownerId !== session.id && !savedReport.isShared) {
    return { error: "شما دسترسی به این گزارش ذخیره‌شده را ندارید." };
  }

  // اعتبارسنجی مسیر خروجی داخل محدوده مجاز
  const resolvedDir = resolveScheduledOutputDir(outputDir);
  if (!resolvedDir) {
    return { error: "مسیر خروجی نامعتبر است." };
  }

  try {
    const report = await prisma.scheduledReport.create({
      data: {
        savedReportId,
        cron: cron.trim(),
        format: fmt,
        recipients: recipientIds.join(","),
        outputDir: outputDir.trim(),
        isActive: true,
      },
      include: { savedReport: true },
    });

    await audit(
      session,
      "scheduledReport",
      report.id,
      "CREATE",
      null,
      report,
      `برنامه زمان‌بندی جدیدی برای گزارش '${report.savedReport.name}' ایجاد گردید.`
    );

    revalidatePath("/reports");
    return { report };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getScheduledReports() {
  const session = await getSession();
  if (!session) return [];

  try {
    return await prisma.scheduledReport.findMany({
      where: {
        savedReport: {
          OR: [{ ownerId: session.id }, { isShared: true }],
        },
      },
      include: { savedReport: true },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function toggleScheduledReport(id: number, isActive: boolean) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "report.build"))) {
    return { error: "دسترسی ندارید." };
  }

  const { schedule, error: ownerError } = await loadScheduleForMutation(id, session);
  if (ownerError || !schedule) {
    return { error: ownerError || "خطا در بررسی دسترسی" };
  }

  try {
    const after = await prisma.scheduledReport.update({
      where: { id },
      data: { isActive },
    });

    const statusWord = isActive ? "فعال" : "غیرفعال";
    await audit(
      session,
      "scheduledReport",
      id,
      "UPDATE",
      schedule,
      after,
      `برنامه زمان‌بندی گزارش شماره ${id} ${statusWord} گردید.`
    );

    revalidatePath("/reports");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteScheduledReport(id: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "report.build"))) {
    return { error: "دسترسی ندارید." };
  }

  const { schedule, error: ownerError } = await loadScheduleForMutation(id, session);
  if (ownerError || !schedule) {
    return { error: ownerError || "خطا در بررسی دسترسی" };
  }

  try {
    await prisma.scheduledReport.delete({ where: { id } });

    await audit(
      session,
      "scheduledReport",
      id,
      "DELETE",
      schedule,
      null,
      `برنامه زمان‌بندی گزارش شماره ${id} با موفقیت حذف شد.`
    );

    revalidatePath("/reports");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
