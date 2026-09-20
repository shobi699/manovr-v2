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

export interface TrainMatrixRow {
  trainId: number;
  trainCode: string;
  trainType: number;
  trainStatus: number;
  currentLineName: string;
  hasKafshak: boolean;
  noAtp: boolean;
  noLicense: boolean;
  totalManovrs: number;
  byDetailedType: Record<number, number>;
  byCategory: {
    lineChange: number;
    permanent: number;
    exit: number;
    normal: number;
  };
  manovrs: TrainPerformanceManovrItem[];
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
  matrix: TrainMatrixRow[];
  allManovrTypes: Array<{ code: number; label: string; count: number }>;
  effectiveRangeJalali: {
    start: string;
    end: string;
    label: string;
  };
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
export function toTehranJalali(date: Date | string | null | undefined): string {
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
    const rawStart = customStart ? new Date(customStart) : null;
    const rawEnd = customEnd ? new Date(customEnd) : null;
    const start = rawStart && !isNaN(rawStart.getTime()) ? rawStart : null;
    const end = rawEnd && !isNaN(rawEnd.getTime()) ? rawEnd : null;

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
    const currentDay = now.getDay();
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
