"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { ManovrType, ManovrStatus } from "@/lib/enums";

export interface TrainPerformanceFilter {
  trainId?: number | "all" | null;
  datePreset?: "today" | "week" | "month" | "custom" | "all";
  startDate?: string | null; // ISO string or YYYY-MM-DD
  endDate?: string | null;   // ISO string or YYYY-MM-DD
}

export interface TrainPerformanceManovrItem {
  id: number;
  type: number;
  typeName: string;
  status: number;
  statusName: string;
  sourceLine: string;
  destLine: string;
  rahbar1Name: string;
  rahbar2Name: string;
  createdAt: string;
  createdAtJalali: string;
  finishedAtJalali: string;
  durationMinutes: number | null;
  description: string | null;
  trainCode: string;
  trainId: number;
}

export interface TrainPerformanceStats {
  totalManovrs: number;
  byType: {
    lineChange: number; // انتقال بین خطوط
    permanent: number;  // انتقال دائم
    exit: number;       // خروجی به خط اصلی
    normal: number;     // سایر مانورهای عادی / تست
  };
  totalDriversCount: number;
  uniqueLinesCount: number;
  topDrivers: Array<{ id: number; name: string; count: number }>;
  topLines: Array<{ id: number; name: string; count: number }>;
  manovrs: TrainPerformanceManovrItem[];
  trainInfo?: {
    id: number;
    code: string;
    type: number;
    status: number;
    currentLineName?: string;
    hasKafshak: boolean;
    noAtp: boolean;
    noLicense: boolean;
  } | null;
}

export interface TrainPerformanceResponse {
  success: boolean;
  error?: string;
  data?: TrainPerformanceStats;
}

/**
 * تبدیل تاریخ به رشته فارسی شمسی با منطقه زمانی تهران
 */
function toTehranJalali(date: Date | string | null | undefined): string {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("fa-IR", {
      timeZone: "Asia/Tehran",
      calendar: "persian",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

/**
 * محاسبه تاریخ آغاز و پایان بر مبنای بازه‌های زمانی سریع ایران
 */
export function calculateDateRange(
  preset: "today" | "week" | "month" | "custom" | "all" = "all",
  customStart?: string | null,
  customEnd?: string | null
): { start: Date | null; end: Date | null } {
  if (preset === "all") {
    return { start: null, end: null };
  }

  if (preset === "custom") {
    const start = customStart ? new Date(customStart) : null;
    const end = customEnd ? new Date(customEnd) : null;
    if (end) {
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }

  // مبنای زمان فعلی تهران
  const now = new Date();
  
  if (preset === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (preset === "week") {
    // در ایران هفته از شنبه شروع می‌شود.
    // روز 6 در getDay معادل شنبه (Saturday) است. (0: یکشنبه, ..., 6: شنبه)
    const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    // فاصله تا روز شنبه گذشته: اگر شنبه است (6) فاصله 0، اگر یکشنبه (0) فاصله 1، و غیره
    const daysSinceSaturday = (currentDay + 1) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - daysSinceSaturday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (preset === "month") {
    // محاسبه ابتدای ماه شمسی فعلی
    // از Intl برای استخراج روز جاری در ماه شمسی استفاده می‌کنیم
    try {
      const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
        timeZone: "Asia/Tehran",
        day: "numeric",
      }).formatToParts(now);
      const dayPart = parts.find((p) => p.type === "day");
      const currentJalaliDay = dayPart ? parseInt(dayPart.value, 10) : 1;

      const start = new Date(now);
      start.setDate(now.getDate() - (currentJalaliDay - 1));
      start.setHours(0, 0, 0, 0);

      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } catch {
      // فال‌بک ۳۰ روز اخیر
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }

  return { start: null, end: null };
}

/**
 * دسته‌بندی انواع مانورها در ۴ شاخه اصلی گزارش عملکرد
 */
export function categorizeManovrType(type: number): "lineChange" | "permanent" | "exit" | "normal" {
  // انتقال دائم
  if ([21, 22, 23, 24].includes(type)) {
    return "permanent";
  }
  // خروجی‌ها به خط اصلی
  if ([16, 17, 18].includes(type)) {
    return "exit";
  }
  // جابجایی و انتقال بین خطوط
  if ([2, 10, 19].includes(type)) {
    return "lineChange";
  }
  // سایر مانورهای عادی / تست / سرویس
  return "normal";
}

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
