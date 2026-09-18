"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { ManovrType, ManovrStatus } from "@/lib/enums";
import { getCachedLookup } from "@/lib/lookups";
import {
  calculateDateRange,
  categorizeManovrType,
  toTehranJalali,
  type TrainPerformanceFilter,
  type TrainPerformanceManovrItem,
  type TrainPerformanceResponse,
  type TrainMatrixRow,
} from "@/lib/train-performance";

export type {
  TrainPerformanceFilter,
  TrainPerformanceManovrItem,
  TrainPerformanceStats,
  TrainPerformanceResponse,
  TrainMatrixRow,
} from "@/lib/train-performance";

/**
 * سرور اکشن دریافت جامع آمار، ماتریس عملکرد قطارها و ریز سوابق مانور بر مبنای تقویم جلالی تهران
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

    // محاسبه برچسب بازه تاریخی جلالی موثر
    const startJalali = start ? toTehranJalali(start).split(" ")[0] : "ابتدای ثبت سوابق";
    const endJalali = end ? toTehranJalali(end).split(" ")[0] : "اکنون";
    const rangeLabel = !start && !end ? "کل تاریخچه مانورها" : `از ${startJalali} تا ${endJalali}`;

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

    // واکشی همزمان قطارها، مانورها و تعاریف انواع مانور
    const [allTrains, rawManovrs, lookupTypes] = await Promise.all([
      prisma.train.findMany({
        where: filter.trainId && filter.trainId !== "all" 
          ? { id: Number(filter.trainId) } 
          : { isDisposed: false },
        include: { line: { select: { name: true } } },
        orderBy: { code: "asc" },
      }),
      prisma.manovr.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          train: { select: { id: true, code: true, type: true, status: true, lineId: true } },
          sourceLine: { select: { id: true, name: true } },
          destinationLine: { select: { id: true, name: true } },
          rahbar1: { select: { id: true, firstName: true, lastName: true } },
          rahbar2: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      getCachedLookup("manovr_type"),
    ]);

    // نقشه نام انواع مانورها (ترکیب لوک‌آپ دیتابیس و اینام کلاینتی)
    const manovrTypeMap = new Map<number, string>();
    const lookupList = lookupTypes?.values || [];
    lookupList.forEach((lt) => manovrTypeMap.set(lt.code, lt.label));
    // پوشش انواع پیش‌فرض در صورت نبود در دیتابیس
    for (let code = 1; code <= 24; code++) {
      if (!manovrTypeMap.has(code) && (ManovrType as any)[code]) {
        manovrTypeMap.set(code, (ManovrType as any)[code]);
      }
    }

    // واکشی مشخصات قطار در صورت انتخاب قطار مشخص
    let trainInfo = null;
    if (filter.trainId && filter.trainId !== "all") {
      const selectedTrain = allTrains.find((t) => t.id === Number(filter.trainId));
      if (selectedTrain) {
        trainInfo = {
          id: selectedTrain.id,
          code: selectedTrain.code,
          type: selectedTrain.type,
          status: selectedTrain.status,
          currentLineName: selectedTrain.line?.name || "نامشخص",
          hasKafshak: selectedTrain.hasKafshak,
          noAtp: selectedTrain.noAtp,
          noLicense: selectedTrain.noLicense,
        };
      }
    }

    const byType = {
      lineChange: 0,
      permanent: 0,
      exit: 0,
      normal: 0,
    };

    const typeCounter = new Map<number, number>();
    const driverCounts = new Map<number, { id: number; name: string; count: number }>();
    const lineCounts = new Map<number, { id: number; name: string; count: number }>();
    const trainManovrsMap = new Map<number, TrainPerformanceManovrItem[]>();

    const processedManovrs: TrainPerformanceManovrItem[] = rawManovrs.map((m) => {
      // تفکیک نوع مانور
      const cat = categorizeManovrType(m.type);
      byType[cat]++;
      typeCounter.set(m.type, (typeCounter.get(m.type) || 0) + 1);

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

      const item: TrainPerformanceManovrItem = {
        id: m.id,
        type: m.type,
        typeName: manovrTypeMap.get(m.type) || ManovrType[m.type] || `نوع ${m.type}`,
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

      if (m.trainId) {
        const existingList = trainManovrsMap.get(m.trainId) || [];
        existingList.push(item);
        trainManovrsMap.set(m.trainId, existingList);
      }

      return item;
    });

    // لیست برترین راهبران و خطوط
    const topDrivers = Array.from(driverCounts.values()).sort((a, b) => b.count - a.count);
    const topLines = Array.from(lineCounts.values()).sort((a, b) => b.count - a.count);

    // تشکیل ماتریس سطر به سطر هر قطار (Train-Centric Performance Matrix)
    const trainMatrix: TrainMatrixRow[] = allTrains.map((train) => {
      const trainManovrs = trainManovrsMap.get(train.id) || [];
      const byDetailedType: Record<number, number> = {};
      const trainCat = {
        lineChange: 0,
        permanent: 0,
        exit: 0,
        normal: 0,
      };

      trainManovrs.forEach((tm) => {
        byDetailedType[tm.type] = (byDetailedType[tm.type] || 0) + 1;
        const c = categorizeManovrType(tm.type);
        trainCat[c]++;
      });

      return {
        trainId: train.id,
        trainCode: train.code,
        trainType: train.type,
        trainStatus: train.status,
        currentLineName: train.line?.name || "نامشخص",
        hasKafshak: train.hasKafshak,
        noAtp: train.noAtp,
        noLicense: train.noLicense,
        totalManovrs: trainManovrs.length,
        byDetailedType,
        byCategory: trainCat,
        manovrs: trainManovrs,
      };
    });

    // مرتب‌سازی ماتریس: قطارهایی که در این بازه مانور داشته‌اند در ابتدا (به ترتیب تعداد مانور نزولی)، سپس سایر قطارها
    trainMatrix.sort((a, b) => {
      if (b.totalManovrs !== a.totalManovrs) {
        return b.totalManovrs - a.totalManovrs;
      }
      return a.trainCode.localeCompare(b.trainCode, undefined, { numeric: true });
    });

    // ساخت لیست تمامی انواع مانور موجود همراه با تعداد در این بازه
    const allManovrTypesList: Array<{ code: number; label: string; count: number }> = [];
    manovrTypeMap.forEach((label, code) => {
      allManovrTypesList.push({
        code,
        label,
        count: typeCounter.get(code) || 0,
      });
    });
    // سورت بر اساس کد نوع مانور
    allManovrTypesList.sort((a, b) => a.code - b.code);

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
        matrix: trainMatrix,
        allManovrTypes: allManovrTypesList,
        effectiveRangeJalali: {
          start: startJalali,
          end: endJalali,
          label: rangeLabel,
        },
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
