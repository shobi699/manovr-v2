"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { audit } from "@/lib/audit";

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

  try {
    const report = await prisma.scheduledReport.create({
      data: {
        savedReportId,
        cron: cron.trim(),
        format,
        recipients: recipients.trim(),
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

  try {
    const before = await prisma.scheduledReport.findUnique({ where: { id } });
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
      before,
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

  try {
    const before = await prisma.scheduledReport.findUnique({ where: { id } });
    await prisma.scheduledReport.delete({ where: { id } });

    await audit(
      session,
      "scheduledReport",
      id,
      "DELETE",
      before,
      null,
      `برنامه زمان‌بندی گزارش شماره ${id} با موفقیت حذف شد.`
    );

    revalidatePath("/reports");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
