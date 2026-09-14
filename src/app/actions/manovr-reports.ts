"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";

export interface DriverReportFilterParams {
  driverId?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
  shift?: number | null; // 1: A, 2: B, 3: C, 4: D
  soloOnly?: boolean;
  breakdown?: "daily" | "weekly" | "monthly";
  driverType?: "all" | "regular" | "part_time";
}

export interface DriverShiftSummary {
  driverId: number;
  driverName: string;
  personnelCode: string;
  primaryShift: number;
  isPartTimeDriver?: boolean;
  orgPosition?: number;
  shiftA: number;
  shiftB: number;
  shiftC: number;
  shiftD: number;
  totalShunts: number;
  soloShunts: number;
  assistedShunts: number;
  soloPercentage: number;
}

export interface PeriodicBucket {
  periodKey: string;
  periodLabel: string;
  total: number;
  solo: number;
  assisted: number;
  shiftA: number;
  shiftB: number;
  shiftC: number;
  shiftD: number;
}

export interface ShuntingReportResponse {
  success: boolean;
  error?: string;
  summary: {
    totalOperations: number;
    soloOperations: number;
    assistedOperations: number;
    soloPercentage: number;
    shiftCounts: {
      A: number;
      B: number;
      C: number;
      D: number;
      other: number;
    };
  };
  driverSummaries: DriverShiftSummary[];
  periodicBreakdown: PeriodicBucket[];
  operations: any[];
}

/**
 * تعیین برچسب و کلید دوره بر اساس تقویم جلالی تهران
 */
function getJalaliPeriodInfo(date: Date, breakdown: "daily" | "weekly" | "monthly"): { key: string; label: string } {
  const tehranDate = new Date(date);

  if (breakdown === "monthly") {
    // ماهانه: فرمت ماه و سال شمسی
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "long",
    }).format(tehranDate);

    const sortKey = new Intl.DateTimeFormat("en-CA-u-ca-persian", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
    }).format(tehranDate);

    return { key: sortKey, label: parts };
  }

  if (breakdown === "weekly") {
    // هفتگی: محاسبه شنبه مبنای هفته در تقویم جلالی
    // در تقویم ایرانی شنبه = ۶ و یکشنبه = ۰ و ...
    const dayOfWeek = tehranDate.getDay(); // 0: یکشنبه, 6: شنبه
    // فاصله تا روز شنبه قبلی:
    const diffToSaturday = (dayOfWeek + 1) % 7;
    const startOfWeek = new Date(tehranDate);
    startOfWeek.setDate(startOfWeek.getDate() - diffToSaturday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const startLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      timeZone: "Asia/Tehran",
      month: "numeric",
      day: "numeric",
    }).format(startOfWeek);

    const endLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(endOfWeek);

    const sortKey = startOfWeek.toISOString().slice(0, 10);
    return { key: sortKey, label: `هفته ${startLabel} الی ${endLabel}` };
  }

  // روزانه: تاریخ کامل شمسی
  const dateStr = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(tehranDate);

  const sortKey = new Intl.DateTimeFormat("en-CA-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tehranDate);

  return { key: sortKey, label: dateStr };
}

/**
 * دریافت گزارش جامع عملکرد مانور راهبران به تفکیک شیفت، دوره و تک‌نفره (سولو)
 */
export async function getDriverShuntingReport(
  params: DriverReportFilterParams
): Promise<ShuntingReportResponse> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "نشست کاربری نامعتبر است. لطفاً مجدداً وارد شوید.",
      summary: {
        totalOperations: 0,
        soloOperations: 0,
        assistedOperations: 0,
        soloPercentage: 0,
        shiftCounts: { A: 0, B: 0, C: 0, D: 0, other: 0 },
      },
      driverSummaries: [],
      periodicBreakdown: [],
      operations: [],
    };
  }

  const canView = (await hasPerm(session, "manovr.report")) || (await hasPerm(session, "manovr.view"));
  if (!canView) {
    return {
      success: false,
      error: "شما دسترسی لازم برای مشاهده گزارش‌های مانور را ندارید.",
      summary: {
        totalOperations: 0,
        soloOperations: 0,
        assistedOperations: 0,
        soloPercentage: 0,
        shiftCounts: { A: 0, B: 0, C: 0, D: 0, other: 0 },
      },
      driverSummaries: [],
      periodicBreakdown: [],
      operations: [],
    };
  }

  try {
    const andConditions: any[] = [];

    // فیلتر بازه تاریخی بر مبنای زمان واقعی اجرای مانور
    if (params.fromDate) {
      andConditions.push({ executionTime: { gte: new Date(params.fromDate) } });
    }
    if (params.toDate) {
      andConditions.push({ executionTime: { lte: new Date(params.toDate) } });
    }

    // فیلتر راهبر مشخص
    if (params.driverId && params.driverId > 0) {
      andConditions.push({ rahbar1Id: params.driverId });
    }

    // فیلتر شیفت راهبر (A:1, B:2, C:3, D:4)
    if (params.shift && params.shift > 0) {
      andConditions.push({ rahbar1: { shift: params.shift } });
    }

    // فیلتر اختصاصی مانورهای تک‌نفره (Solo)
    if (params.soloOnly) {
      andConditions.push({ rahbar1Id: { not: null }, rahbar2Id: null });
    }

    // فیلتر نوع راهبر (همه، راهبر دائم، راهبر غیردائم)
    if (params.driverType === "part_time") {
      andConditions.push({ rahbar1: { isPartTimeDriver: true } });
    } else if (params.driverType === "regular") {
      andConditions.push({ rahbar1: { orgPosition: 1, isPartTimeDriver: false } });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const rawManovrs = await prisma.manovr.findMany({
      where,
      orderBy: { executionTime: "desc" },
      include: {
        rahbar1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            personnelCode: true,
            shift: true,
            orgPosition: true,
            isPartTimeDriver: true,
          },
        },
        rahbar2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            personnelCode: true,
          },
        },
        train: {
          select: {
            id: true,
            code: true,
            type: true,
          },
        },
        sourceLine: {
          select: {
            id: true,
            name: true,
          },
        },
        destinationLine: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    let totalOperations = rawManovrs.length;
    let soloOperations = 0;
    let assistedOperations = 0;

    const shiftCounts = { A: 0, B: 0, C: 0, D: 0, other: 0 };
    const driverMap: Map<number, DriverShiftSummary> = new Map();
    const periodMap: Map<string, PeriodicBucket> = new Map();

    const breakdownType = params.breakdown || "daily";

    for (const m of rawManovrs) {
      // مانور تک‌نفره: راهبر ۱ ثبت شده و راهبر ۲ خالی است
      const isSolo = Boolean(m.rahbar1Id && !m.rahbar2Id);
      if (isSolo) {
        soloOperations++;
      } else if (m.rahbar2Id) {
        assistedOperations++;
      }

      // تعیین شیفت راهبر ۱
      const driverShift = m.rahbar1?.shift;
      if (driverShift === 1) shiftCounts.A++;
      else if (driverShift === 2) shiftCounts.B++;
      else if (driverShift === 3) shiftCounts.C++;
      else if (driverShift === 4) shiftCounts.D++;
      else shiftCounts.other++;

      // تجمیع به ازای راهبر
      if (m.rahbar1) {
        const dId = m.rahbar1.id;
        let driverRecord = driverMap.get(dId);
        if (!driverRecord) {
          driverRecord = {
            driverId: dId,
            driverName: `${m.rahbar1.firstName} ${m.rahbar1.lastName}`.trim(),
            personnelCode: m.rahbar1.personnelCode || "—",
            primaryShift: m.rahbar1.shift,
            isPartTimeDriver: Boolean(m.rahbar1.isPartTimeDriver),
            orgPosition: m.rahbar1.orgPosition,
            shiftA: 0,
            shiftB: 0,
            shiftC: 0,
            shiftD: 0,
            totalShunts: 0,
            soloShunts: 0,
            assistedShunts: 0,
            soloPercentage: 0,
          };
          driverMap.set(dId, driverRecord);
        }

        driverRecord.totalShunts++;
        if (isSolo) {
          driverRecord.soloShunts++;
        } else {
          driverRecord.assistedShunts++;
        }

        if (driverShift === 1) driverRecord.shiftA++;
        else if (driverShift === 2) driverRecord.shiftB++;
        else if (driverShift === 3) driverRecord.shiftC++;
        else if (driverShift === 4) driverRecord.shiftD++;

        driverRecord.soloPercentage =
          driverRecord.totalShunts > 0
            ? Math.round((driverRecord.soloShunts / driverRecord.totalShunts) * 100)
            : 0;
      }

      // تجمیع دوره‌ای (روزانه / هفتگی / ماهانه)
      const execDate = m.executionTime ? new Date(m.executionTime) : new Date(m.createdAt);
      const { key, label } = getJalaliPeriodInfo(execDate, breakdownType);

      let periodBucket = periodMap.get(key);
      if (!periodBucket) {
        periodBucket = {
          periodKey: key,
          periodLabel: label,
          total: 0,
          solo: 0,
          assisted: 0,
          shiftA: 0,
          shiftB: 0,
          shiftC: 0,
          shiftD: 0,
        };
        periodMap.set(key, periodBucket);
      }

      periodBucket.total++;
      if (isSolo) periodBucket.solo++;
      else periodBucket.assisted++;

      if (driverShift === 1) periodBucket.shiftA++;
      else if (driverShift === 2) periodBucket.shiftB++;
      else if (driverShift === 3) periodBucket.shiftC++;
      else if (driverShift === 4) periodBucket.shiftD++;
    }

    const driverSummaries = Array.from(driverMap.values()).sort(
      (a, b) => b.totalShunts - a.totalShunts
    );

    // مرتب‌سازی دوره‌ها به صورت صعودی
    const periodicBreakdown = Array.from(periodMap.values()).sort((a, b) =>
      a.periodKey.localeCompare(b.periodKey)
    );

    const soloPercentage =
      totalOperations > 0 ? Math.round((soloOperations / totalOperations) * 100) : 0;

    return {
      success: true,
      summary: {
        totalOperations,
        soloOperations,
        assistedOperations,
        soloPercentage,
        shiftCounts,
      },
      driverSummaries,
      periodicBreakdown,
      operations: rawManovrs,
    };
  } catch (error: any) {
    console.error("Error generating driver shunting report:", error);
    return {
      success: false,
      error: error?.message || "خطا در استخراج گزارش عملکرد مانور راهبران.",
      summary: {
        totalOperations: 0,
        soloOperations: 0,
        assistedOperations: 0,
        soloPercentage: 0,
        shiftCounts: { A: 0, B: 0, C: 0, D: 0, other: 0 },
      },
      driverSummaries: [],
      periodicBreakdown: [],
      operations: [],
    };
  }
}
