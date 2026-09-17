"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { ManovrType, ManovrStatus } from "@/lib/enums";
import {
  calculateDateRange,
  categorizeManovrType,
  toTehranJalali,
  type TrainPerformanceFilter,
  type TrainPerformanceManovrItem,
  type TrainPerformanceResponse,
} from "@/lib/train-performance";

export type {
  TrainPerformanceFilter,
  TrainPerformanceManovrItem,
  TrainPerformanceStats,
  TrainPerformanceResponse,
} from "@/lib/train-performance";

/**
 * سرور اکشن دریافت جامع آمار و سوابق عملکرد قطار / کل ناوگان
 */
export async function getTrainPerformanceStatsAction(
  filter: TrainPerformanceFilter
): Promise<TrainPerformanceResponse> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "لطفاً ابتدا وارد سامانه شوید." };
  }

  if (!(await hasPerm(session, "manovr.report")) && !(await hasPerm(session, "manovr.view"))) {
    return { success: false, error: "دسترسی مشاهده گزارش عملکرد ناوگان را ندارید." };
  }

  try {
    const { start, end } = calculateDateRange(
      filter.datePreset || "all",
      filter.startDate,
      filter.endDate
    );

    // شرط فیلتر پایگاه داده
    const where: any = {
      status: { not: 3 }, // مانورهای حذف‌شده در گزارش عملکرد محاسبه نمی‌شوند
    };

    if (filter.trainId && filter.trainId !== "all") {
      where.trainId = Number(filter.trainId);
    }

    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = start;
      if (end) where.createdAt.lte = end;
    }

    // واکشی مشخصات قطار در صورت انتخاب قطار مشخص
    let trainInfo = null;
    if (filter.trainId && filter.trainId !== "all") {
      const train = await prisma.train.findUnique({
        where: { id: Number(filter.trainId) },
        include: { line: true },
      });
      if (train) {
        trainInfo = {
          id: train.id,
          code: train.code,
          type: train.type,
          status: train.status,
          currentLineName: train.line?.name || "نامشخص",
          hasKafshak: train.hasKafshak,
          noAtp: train.noAtp,
          noLicense: train.noLicense,
        };
      }
    }

    // واکشی مانورها
    const rawManovrs = await prisma.manovr.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        train: { select: { id: true, code: true } },
        sourceLine: { select: { id: true, name: true } },
        destinationLine: { select: { id: true, name: true } },
        rahbar1: { select: { id: true, firstName: true, lastName: true } },
        rahbar2: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const byType = {
      lineChange: 0,
      permanent: 0,
      exit: 0,
      normal: 0,
    };

    const driverCounts = new Map<number, { id: number; name: string; count: number }>();
    const lineCounts = new Map<number, { id: number; name: string; count: number }>();

    const processedManovrs: TrainPerformanceManovrItem[] = rawManovrs.map((m) => {
      // تفکیک نوع مانور
      const cat = categorizeManovrType(m.type);
      byType[cat]++;

      // شمارش راهبران
      if (m.rahbar1) {
        const id = m.rahbar1.id;
        const name = `${m.rahbar1.firstName} ${m.rahbar1.lastName}`.trim();
        const existing = driverCounts.get(id) || { id, name, count: 0 };
        existing.count++;
        driverCounts.set(id, existing);
      }
      if (m.rahbar2) {
        const id = m.rahbar2.id;
        const name = `${m.rahbar2.firstName} ${m.rahbar2.lastName}`.trim();
        const existing = driverCounts.get(id) || { id, name, count: 0 };
        existing.count++;
        driverCounts.set(id, existing);
      }

      // شمارش خطوط ترددشده
      if (m.sourceLine) {
        const id = m.sourceLine.id;
        const name = m.sourceLine.name;
        const existing = lineCounts.get(id) || { id, name, count: 0 };
        existing.count++;
        lineCounts.set(id, existing);
      }
      if (m.destinationLine && m.destinationLine.id !== m.sourceLine?.id) {
        const id = m.destinationLine.id;
        const name = m.destinationLine.name;
        const existing = lineCounts.get(id) || { id, name, count: 0 };
        existing.count++;
        lineCounts.set(id, existing);
      }

      // محاسبه مدت زمان مانور (به دقیقه)
      let durationMinutes: number | null = null;
      if (m.finishedAt && m.createdAt) {
        const diffMs = new Date(m.finishedAt).getTime() - new Date(m.createdAt).getTime();
        if (diffMs > 0) {
          durationMinutes = Math.round(diffMs / (1000 * 60));
        }
      }

      return {
        id: m.id,
        type: m.type,
        typeName: ManovrType[m.type] || `نوع ${m.type}`,
        status: m.status,
        statusName: ManovrStatus[m.status] || `وضعیت ${m.status}`,
        sourceLine: m.sourceLine?.name || "—",
        destLine: m.destinationLine?.name || "—",
        rahbar1Name: m.rahbar1 ? `${m.rahbar1.firstName} ${m.rahbar1.lastName}`.trim() : "—",
        rahbar2Name: m.rahbar2 ? `${m.rahbar2.firstName} ${m.rahbar2.lastName}`.trim() : "—",
        createdAt: m.createdAt.toISOString(),
        createdAtJalali: toTehranJalali(m.createdAt),
        finishedAtJalali: toTehranJalali(m.finishedAt),
        durationMinutes,
        description: m.description,
        trainCode: m.train?.code || "—",
        trainId: m.train?.id || 0,
      };
    });

    // لیست برترین راهبران و خطوط
    const topDrivers = Array.from(driverCounts.values()).sort((a, b) => b.count - a.count);
    const topLines = Array.from(lineCounts.values()).sort((a, b) => b.count - a.count);

    return {
      success: true,
      data: {
        totalManovrs: rawManovrs.length,
        byType,
        totalDriversCount: driverCounts.size,
        uniqueLinesCount: lineCounts.size,
        topDrivers,
        topLines,
        manovrs: processedManovrs,
        trainInfo,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "خطا در واکشی آمار عملکرد ناوگان قطارها",
    };
  }
}
