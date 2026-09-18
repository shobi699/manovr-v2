"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  getTrainPerformanceStatsAction,
  type TrainPerformanceStats,
  type TrainPerformanceFilter,
  type TrainMatrixRow,
} from "@/app/actions/train-performance";
import { toast } from "@/components/ui/Toast";
import ExcelJS from "exceljs";
import TrainSearchableCombobox from "./components/TrainSearchableCombobox";
import TrainColumnFilterPopover from "./components/TrainColumnFilterPopover";
import TrainPerformanceDrilldownModal from "./components/TrainPerformanceDrilldownModal";

interface TrainItem {
  id: number;
  code: string;
  type?: number;
  status?: number;
}

interface TrainPerformanceViewProps {
  trains?: TrainItem[];
  initialTrainCode?: string;
}

export default function TrainPerformanceView({
  trains = [],
  initialTrainCode = "",
}: TrainPerformanceViewProps) {
  // فیلتر قطار انتخابی (پیش‌فرض کل ناوگان یا قطار مشخص شده در URL)
  const [selectedTrainId, setSelectedTrainId] = useState<number | "all">(() => {
    if (initialTrainCode) {
      const match = trains.find((t) => t.code === initialTrainCode);
      if (match) return match.id;
    }
    return "all";
  });

  // فیلتر بازه زمانی سریع (پیش‌فرض کل تاریخچه جهت نمایش بی‌نقص مانورهای تاریخی)
  const [datePreset, setDatePreset] = useState<"today" | "week" | "month" | "custom" | "all">("all");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // فیلتر سراسری جستجوی متنی در جدول
  const [tableSearch, setTableSearch] = useState("");

  // فیلتر نوع مانور (جامع تمام کدهای مانور)
  const [selectedManeuverTypeFilter, setSelectedManeuverTypeFilter] = useState<string>("all");

  // فیلترهای اکسل‌گونه سرستون‌ها
  const [trainCodeFilter, setTrainCodeFilter] = useState<Set<string>>(new Set());
  const [trainTypeFilter, setTrainTypeFilter] = useState<Set<string>>(new Set());
  const [currentLineFilter, setCurrentLineFilter] = useState<Set<string>>(new Set());

  // مرتب‌سازی سرستون‌ها
  const [sortColumn, setSortColumn] = useState<string | null>("totalManovrs");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>("desc");

  // قطار انتخاب‌شده برای مودال ریز مانورها
  const [drilldownTrain, setDrilldownTrain] = useState<TrainMatrixRow | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [stats, setStats] = useState<TrainPerformanceStats | null>(null);

  // واکشی داده‌های آمار عملکرد و ماتریس قطارها
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getTrainPerformanceStatsAction({
        trainId: selectedTrainId,
        datePreset,
        startDate: datePreset === "custom" && customStart ? customStart : undefined,
        endDate: datePreset === "custom" && customEnd ? customEnd : undefined,
      });

      if (res.success && res.data) {
        setStats(res.data);
      } else {
        toast.error(res.error || "خطا در دریافت اطلاعات عملکرد ناوگان");
      }
    } catch {
      toast.error("برقراری ارتباط با پایگاه داده ناموفق بود.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedTrainId, datePreset, customStart, customEnd]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // استخراج مقادیر یکتا برای فیلترهای اکسل‌گونه سرستون‌ها
  const distinctTrainCodes = useMemo(() => {
    if (!stats?.matrix) return [];
    return Array.from(new Set(stats.matrix.map((r) => r.trainCode))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [stats?.matrix]);

  const distinctTrainTypes = useMemo(() => {
    if (!stats?.matrix) return [];
    const types = new Set<string>();
    stats.matrix.forEach((r) => {
      types.add(r.trainType === 0 ? "AC" : r.trainType === 1 ? "DC" : "دیزل");
    });
    return Array.from(types);
  }, [stats?.matrix]);

  const distinctCurrentLines = useMemo(() => {
    if (!stats?.matrix) return [];
    return Array.from(new Set(stats.matrix.map((r) => r.currentLineName))).sort();
  }, [stats?.matrix]);

  // فیلتر کردن و مرتب‌سازی ردیف‌های ماتریس قطارها به سبک اکسل
  const filteredMatrix = useMemo(() => {
    if (!stats?.matrix) return [];
    let rows = [...stats.matrix];

    // ۱. فیلتر جستجوی سراسری
    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.trainCode.toLowerCase().includes(q) ||
          r.currentLineName.toLowerCase().includes(q) ||
          (r.trainType === 0 ? "ac" : r.trainType === 1 ? "dc" : "دیزل").includes(q)
      );
    }

    // ۲. فیلتر نوع مانور انتخابی (نمایش قطارهایی که حداقل یک مورد از این نوع مانور داشته‌اند)
    if (selectedManeuverTypeFilter !== "all") {
      const typeNum = Number(selectedManeuverTypeFilter);
      rows = rows.filter((r) => (r.byDetailedType[typeNum] || 0) > 0);
    }

    // ۳. فیلتر سرستون شماره قطار
    if (trainCodeFilter.size > 0) {
      rows = rows.filter((r) => trainCodeFilter.has(r.trainCode));
    }

    // ۴. فیلتر سرستون نوع قطار
    if (trainTypeFilter.size > 0) {
      rows = rows.filter((r) => {
        const typeStr = r.trainType === 0 ? "AC" : r.trainType === 1 ? "DC" : "دیزل";
        return trainTypeFilter.has(typeStr);
      });
    }

    // ۵. فیلتر سرستون ریل جاری
    if (currentLineFilter.size > 0) {
      rows = rows.filter((r) => currentLineFilter.has(r.currentLineName));
    }

    // ۶. مرتب‌سازی سرستون‌ها
    if (sortColumn && sortDirection) {
      rows.sort((a, b) => {
        let comparison = 0;
        if (sortColumn === "trainCode") {
          comparison = a.trainCode.localeCompare(b.trainCode, undefined, { numeric: true });
        } else if (sortColumn === "totalManovrs") {
          comparison = a.totalManovrs - b.totalManovrs;
        } else if (sortColumn === "lineChange") {
          comparison = a.byCategory.lineChange - b.byCategory.lineChange;
        } else if (sortColumn === "permanent") {
          comparison = a.byCategory.permanent - b.byCategory.permanent;
        } else if (sortColumn === "exit") {
          comparison = a.byCategory.exit - b.byCategory.exit;
        } else if (sortColumn === "normal") {
          comparison = a.byCategory.normal - b.byCategory.normal;
        } else if (sortColumn === "currentLine") {
          comparison = a.currentLineName.localeCompare(b.currentLineName);
        }
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return rows;
  }, [
    stats?.matrix,
    tableSearch,
    selectedManeuverTypeFilter,
    trainCodeFilter,
    trainTypeFilter,
    currentLineFilter,
    sortColumn,
    sortDirection,
  ]);

  // محاسبات جمع کل ردیف‌های جدول ماتریس (Table Totals)
  const tableTotals = useMemo(() => {
    let totalManovrs = 0;
    let totalLineChange = 0;
    let totalPermanent = 0;
    let totalExit = 0;
    let totalNormal = 0;

    filteredMatrix.forEach((r) => {
      totalManovrs += r.totalManovrs;
      totalLineChange += r.byCategory.lineChange;
      totalPermanent += r.byCategory.permanent;
      totalExit += r.byCategory.exit;
      totalNormal += r.byCategory.normal;
    });

    return {
      trainsCount: filteredMatrix.length,
      activeTrainsCount: filteredMatrix.filter((r) => r.totalManovrs > 0).length,
      totalManovrs,
      totalLineChange,
      totalPermanent,
      totalExit,
      totalNormal,
    };
  }, [filteredMatrix]);

  // خروجی استاندارد اکسل راست‌چین دو شیت (شیت ۱: ماتریس عملکرد قطارها، شیت ۲: ریز سوابق)
  const handleExportExcel = async () => {
    if (!stats || filteredMatrix.length === 0) {
      toast.info("رکوردی جهت خروجی اکسل در بازه انتخابی وجود ندارد.");
      return;
    }

    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "سامانه مانور فتح‌آباد";
      workbook.created = new Date();

      // شیت ۱: ماتریس عملکرد قطارها
      const wsMatrix = workbook.addWorksheet("ماتریس_عملکرد_قطارها", {
        views: [{ rtl: true } as any],
      });

      wsMatrix.mergeCells("A1:H1");
      const titleCell = wsMatrix.getCell("A1");
      titleCell.value = `کارنامه و ماتریس عملکرد ناوگان قطارها — بازه: ${stats.effectiveRangeJalali?.label || "کل تاریخچه"}`;
      titleCell.font = { name: "Tahoma", size: 12, bold: true, color: { argb: "FF1E3A8A" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      wsMatrix.getRow(1).height = 32;

      const matrixHeaders = [
        "ردیف",
        "شماره قطار",
        "نوع قطار",
        "موقعیت جاری (خط)",
        "کل مانورها",
        "انتقال خطوط",
        "انتقال دائم",
        "خروج به خط اصلی",
        "عادی / تست / سرویس",
      ];

      const mHeaderRow = wsMatrix.addRow(matrixHeaders);
      mHeaderRow.height = 26;
      mHeaderRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
        cell.font = { name: "Tahoma", bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      filteredMatrix.forEach((r, idx) => {
        const typeStr = r.trainType === 0 ? "AC" : r.trainType === 1 ? "DC" : "دیزل";
        const row = wsMatrix.addRow([
          idx + 1,
          r.trainCode,
          typeStr,
          r.currentLineName,
          r.totalManovrs,
          r.byCategory.lineChange,
          r.byCategory.permanent,
          r.byCategory.exit,
          r.byCategory.normal,
        ]);
        row.height = 22;
        row.eachCell((cell, colNum) => {
          cell.font = { name: "Tahoma", size: 9 };
          cell.alignment = { vertical: "middle", horizontal: colNum <= 4 ? "center" : "center" };
          if (idx % 2 === 1) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          }
        });
      });

      // ردیف جمع کل ماتریس
      const totalRow = wsMatrix.addRow([
        "مجموع کل",
        `${tableTotals.trainsCount} قطار`,
        "—",
        "—",
        tableTotals.totalManovrs,
        tableTotals.totalLineChange,
        tableTotals.totalPermanent,
        tableTotals.totalExit,
        tableTotals.totalNormal,
      ]);
      totalRow.height = 25;
      totalRow.eachCell((cell) => {
        cell.font = { name: "Tahoma", bold: true, size: 9.5 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      wsMatrix.columns = [
        { width: 8 },
        { width: 14 },
        { width: 12 },
        { width: 20 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
        { width: 18 },
      ];

      // شیت ۲: ریز سوابق و مانورها
      const wsDetails = workbook.addWorksheet("ریز_سوابق_مانورها", {
        views: [{ rtl: true } as any],
      });

      wsDetails.mergeCells("A1:J1");
      const dTitleCell = wsDetails.getCell("A1");
      dTitleCell.value = `ریز سوابق مانورهای ناوگان — بازه: ${stats.effectiveRangeJalali?.label || "کل تاریخچه"}`;
      dTitleCell.font = { name: "Tahoma", size: 12, bold: true, color: { argb: "FF0F766E" } };
      dTitleCell.alignment = { vertical: "middle", horizontal: "center" };
      wsDetails.getRow(1).height = 30;

      const detailHeaders = [
        "ردیف",
        "شماره قطار",
        "زمان ثبت (تهران)",
        "نوع مانور",
        "ریل مبدأ",
        "ریل مقصد",
        "راهبر اصلی (۱)",
        "کمک‌راهبر (۲)",
        "وضعیت",
        "مدت (دقیقه)",
        "توضیحات",
      ];
      const dHeaderRow = wsDetails.addRow(detailHeaders);
      dHeaderRow.height = 25;
      dHeaderRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
        cell.font = { name: "Tahoma", bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      stats.manovrs.forEach((m, idx) => {
        const row = wsDetails.addRow([
          idx + 1,
          m.trainCode,
          m.createdAtJalali,
          m.typeName,
          m.sourceLine,
          m.destLine,
          m.rahbar1Name,
          m.rahbar2Name,
          m.statusName,
          m.durationMinutes !== null ? m.durationMinutes : "—",
          m.description || "—",
        ]);
        row.height = 20;
        row.eachCell((cell, colNum) => {
          cell.font = { name: "Tahoma", size: 8.5 };
          cell.alignment = { vertical: "middle", horizontal: colNum === 1 || colNum === 2 || colNum === 10 ? "center" : "right" };
          if (idx % 2 === 1) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          }
        });
      });

      wsDetails.columns = [
        { width: 8 },
        { width: 12 },
        { width: 22 },
        { width: 20 },
        { width: 18 },
        { width: 18 },
        { width: 20 },
        { width: 20 },
        { width: 14 },
        { width: 14 },
        { width: 35 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Train_Performance_Matrix_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("فایل اکسل جامع کارنامه و ماتریس عملکرد قطارها با موفقیت دانلود شد.");
    } catch {
      toast.error("تولید فایل اکسل با خطا مواجه شد.");
    } finally {
      setIsExporting(false);
    }
  };

  // پیش‌نمایش چاپ مرورگر با ایزولاسیون اختصاصی محدوده جدول
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* استایل اختصاصی چاپ برای ایزولاسیون کامل محدوده جدول */}
      <style jsx global>{`
        @media print {
          /* مخفی کردن تمام بخش‌های صفحه */
          body * {
            visibility: hidden !important;
          }
          /* فقط و فقط محدوده چاپ کارنامه عملکرد آشکار باشد */
          #train-performance-print-area,
          #train-performance-print-area * {
            visibility: visible !important;
          }
          #train-performance-print-area {
            position: absolute !important;
            inset-inline-start: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 12px !important;
            background: white !important;
            color: black !important;
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
            font-size: 10px !important;
            color: black !important;
          }
          th {
            background-color: #f1f5f9 !important;
          }
        }
      `}</style>

      {/* ۱. نوار ابزار بالا و فیلترهای کنترلی */}
      <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-2xs transition-all no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* انتخابگر ناوگان با جستجو */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
              انتخاب ناوگان:
            </span>
            <TrainSearchableCombobox
              trains={trains}
              selectedTrainId={selectedTrainId}
              onSelect={(id) => setSelectedTrainId(id)}
            />

            {/* کارت مشخصات قطار انتخابی */}
            {stats?.trainInfo && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-xl text-xs font-semibold">
                <span>موقعیت جاری: <b>{stats.trainInfo.currentLineName}</b></span>
                {stats.trainInfo.hasKafshak && (
                  <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md">
                    کفشک
                  </span>
                )}
                {stats.trainInfo.noAtp && (
                  <span className="bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-md">
                    بدون ATP
                  </span>
                )}
              </div>
            )}
          </div>

          {/* فیلترهای زمانی سریع */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground me-1">بازه زمانی:</span>
            <button
              type="button"
              onClick={() => setDatePreset("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                datePreset === "all"
                  ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              کل تاریخچه
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("today")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                datePreset === "today"
                  ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("week")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                datePreset === "week"
                  ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              این هفته
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("month")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                datePreset === "month"
                  ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              این ماه
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("custom")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                datePreset === "custom"
                  ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              بازه دلخواه
            </button>
          </div>
        </div>

        {/* فیلتر سفارشی تاریخ در صورت انتخاب custom */}
        {datePreset === "custom" && (
          <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">از تاریخ:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-background border border-border rounded-xl px-3 py-1 text-xs focus:ring-2 focus:ring-primary/40 outline-hidden"
            />
            <span className="text-xs font-semibold text-muted-foreground">تا تاریخ:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-background border border-border rounded-xl px-3 py-1 text-xs focus:ring-2 focus:ring-primary/40 outline-hidden"
            />
            <button
              type="button"
              onClick={fetchStats}
              className="px-3 py-1 rounded-xl text-xs font-semibold bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 transition-colors"
            >
              اعمال بازه
            </button>
          </div>
        )}
      </div>

      {/* ۲. بنر برجسته و واضح نمایش بازه زمانی فعال (UI شفاف) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-primary/10 via-background to-primary/5 border border-primary/20 rounded-2xl px-5 py-3 shadow-2xs no-print">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
            📅
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">بازه زمانی فعال گزارش:</span>
            <span className="text-sm font-bold text-foreground">
              {stats?.effectiveRangeJalali?.label || "در حال دریافت بازه زمانی..."}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* دکمه خروجی اکسل */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs"
            title="دانلود فایل اکسل کامل ماتریس ناوگان"
          >
            <span>{isExporting ? "⏳" : "📊"}</span>
            <span>خروجی اکسل ماتریس</span>
          </button>

          {/* دکمه چاپ اختصاصی */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-2xs"
            title="چاپ اختصاصی فقط محدوده جدول"
          >
            <span>🖨️</span>
            <span>چاپ گزارش ماتریس</span>
          </button>
        </div>
      </div>

      {/* ۳. کارت‌های شاخص‌های کلیدی عملکرد (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* کل مانورها */}
        <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-medium block">کل مانورهای ناوگان</span>
            <span className="text-2xl font-extrabold text-foreground mt-1 block">
              {isLoading ? "..." : (stats?.totalManovrs || 0).toLocaleString("fa-IR")}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              {tableTotals.activeTrainsCount} قطار فعال در بازه
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl font-bold">
            🚦
          </div>
        </div>

        {/* انتقال بین خطوط */}
        <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-medium block">انتقال بین خطوط</span>
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 block">
              {isLoading ? "..." : (stats?.byType?.lineChange || 0).toLocaleString("fa-IR")}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">جابجایی‌های داخلی پایانه</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl font-bold">
            🔄
          </div>
        </div>

        {/* خروج به خط اصلی */}
        <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-medium block">خروجی به خط اصلی</span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {isLoading ? "..." : (stats?.byType?.exit || 0).toLocaleString("fa-IR")}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">اعزام‌های انجام‌شده به خط</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-bold">
            🏁
          </div>
        </div>

        {/* دائم و عادی */}
        <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-medium block">انتقال دائم و سرویس‌ها</span>
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 block">
              {isLoading
                ? "..."
                : ((stats?.byType?.permanent || 0) + (stats?.byType?.normal || 0)).toLocaleString("fa-IR")}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">شستشو، تراش، دائم و تست</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl font-bold">
            🛠️
          </div>
        </div>
      </div>

      {/* ۴. محدوده چاپ اختصاصی و جدول ماتریسی قطارها */}
      <div id="train-performance-print-area" className="bg-card border border-border/70 rounded-2xl p-5 shadow-2xs">
        {/* سربرگ رسمی چاپی (فقط هنگام پرینت نمایش داده می‌شود) */}
        <div className="hidden print:block border-b-2 border-black pb-3 mb-4 text-center">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">شرکت بهره‌برداری راه‌آهن شهری تهران و حومه</span>
            <h1 className="text-base font-extrabold">کارنامه جامع ماتریس تردد و عملکرد ناوگان — خط یک</h1>
            <span className="text-xs font-bold">پایانه فتح‌آباد</span>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-gray-700">
            <span>بازه زمانی گزارش: {stats?.effectiveRangeJalali?.label}</span>
            <span>تعداد کل مانورهای بازه: {stats?.totalManovrs || 0}</span>
            <span>تاریخ صدور چاپ: {new Date().toLocaleDateString("fa-IR")}</span>
          </div>
        </div>

        {/* نوار فیلترهای درون جدول (جستجوی سراسری + فیلتر جامع انواع مانورها) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 no-print">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="جستجوی سریع پلاک قطار یا خط جاری..."
                className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-hidden focus:border-primary"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* فیلتر جامع تمام انواع مانورها */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                فیلتر نوع مانور:
              </span>
              <select
                value={selectedManeuverTypeFilter}
                onChange={(e) => setSelectedManeuverTypeFilter(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-hidden focus:border-primary cursor-pointer max-w-[200px]"
              >
                <option value="all">همه انواع مانور (کل شاخه‌ها)</option>
                {stats?.allManovrTypes?.map((mt) => (
                  <option key={mt.code} value={mt.code}>
                    {mt.label} {mt.count > 0 ? `(${mt.count})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>نمایش <b>{filteredMatrix.length}</b> قطار</span>
            {(trainCodeFilter.size > 0 || trainTypeFilter.size > 0 || currentLineFilter.size > 0 || tableSearch) && (
              <button
                type="button"
                onClick={() => {
                  setTrainCodeFilter(new Set());
                  setTrainTypeFilter(new Set());
                  setCurrentLineFilter(new Set());
                  setTableSearch("");
                  setSelectedManeuverTypeFilter("all");
                }}
                className="text-red-500 hover:underline font-semibold"
              >
                (پاکسازی فیلترهای اکسل)
              </button>
            )}
          </div>
        </div>

        {/* جدول ماتریسی قطارمحور */}
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            <span className="text-2xl block mb-2 animate-spin">⏳</span>
            <span>در حال محاسبه و استخراج ماتریس عملکرد قطارها...</span>
          </div>
        ) : filteredMatrix.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            <span className="text-3xl block mb-2">🚦</span>
            <span>هیچ رکوردی با فیلترهای انتخابی یافت نشد.</span>
            {datePreset !== "all" && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setDatePreset("all")}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 transition-colors"
                >
                  مشاهده کل تاریخچه مانورها
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-border/80 rounded-xl shadow-2xs">
            <table className="w-full text-xs text-start">
              <thead className="bg-muted/70 text-muted-foreground font-bold border-b border-border">
                <tr>
                  <th className="py-3 px-3 text-center w-12">#</th>

                  {/* سرستون شماره قطار با فیلتر اکسل */}
                  <th className="py-3 px-3 text-start">
                    <div className="flex items-center gap-1.5">
                      <span>شماره قطار</span>
                      <TrainColumnFilterPopover
                        columnKey="trainCode"
                        title="شماره قطار"
                        distinctValues={distinctTrainCodes}
                        selectedValues={trainCodeFilter}
                        onFilterChange={setTrainCodeFilter}
                        sortDirection={sortColumn === "trainCode" ? sortDirection : null}
                        onSortChange={(dir) => {
                          setSortColumn(dir ? "trainCode" : null);
                          setSortDirection(dir);
                        }}
                      />
                    </div>
                  </th>

                  {/* سرستون نوع قطار با فیلتر اکسل */}
                  <th className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>نوع</span>
                      <TrainColumnFilterPopover
                        columnKey="trainType"
                        title="نوع قطار"
                        distinctValues={distinctTrainTypes}
                        selectedValues={trainTypeFilter}
                        onFilterChange={setTrainTypeFilter}
                        sortDirection={null}
                        onSortChange={() => {}}
                      />
                    </div>
                  </th>

                  {/* سرستون ریل جاری با فیلتر اکسل */}
                  <th className="py-3 px-3 text-start">
                    <div className="flex items-center gap-1.5">
                      <span>موقعیت جاری (خط)</span>
                      <TrainColumnFilterPopover
                        columnKey="currentLine"
                        title="خط جاری"
                        distinctValues={distinctCurrentLines}
                        selectedValues={currentLineFilter}
                        onFilterChange={setCurrentLineFilter}
                        sortDirection={sortColumn === "currentLine" ? sortDirection : null}
                        onSortChange={(dir) => {
                          setSortColumn(dir ? "currentLine" : null);
                          setSortDirection(dir);
                        }}
                      />
                    </div>
                  </th>

                  {/* سرستون جمع کل مانورها */}
                  <th className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span>کل مانورها</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSortColumn("totalManovrs");
                          setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        title="مرتب‌سازی بر اساس تعداد کل مانورها"
                      >
                        {sortColumn === "totalManovrs" && sortDirection === "asc" ? "↑" : "↓"}
                      </button>
                    </div>
                  </th>

                  {/* سرستون‌های تفکیک شاخه‌ها */}
                  <th className="py-3 px-3 text-center">انتقال خطوط</th>
                  <th className="py-3 px-3 text-center">انتقال دائم</th>
                  <th className="py-3 px-3 text-center">خروج به اصلی</th>
                  <th className="py-3 px-3 text-center">عادی / سرویس</th>

                  {/* ستون عملیات ریز مانورها */}
                  <th className="py-3 px-3 text-center no-print w-32">ریز مانورها</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredMatrix.map((r, idx) => {
                  const hasManovrs = r.totalManovrs > 0;
                  return (
                    <tr
                      key={r.trainId}
                      className={`hover:bg-muted/40 transition-colors ${
                        hasManovrs ? "bg-card" : "opacity-60 bg-muted/10"
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-foreground">
                        <span className="flex items-center gap-1.5">
                          <span>🚆</span>
                          <span>قطار {r.trainCode}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.trainType === 0
                              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                              : r.trainType === 1
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                              : "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                          }`}
                        >
                          {r.trainType === 0 ? "AC" : r.trainType === 1 ? "DC" : "دیزل"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-foreground font-medium">{r.currentLineName}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block min-w-[28px] px-2 py-0.5 rounded-full text-xs font-extrabold ${
                            hasManovrs
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.totalManovrs}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-blue-600 dark:text-blue-400">
                        {r.byCategory.lineChange > 0 ? r.byCategory.lineChange : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-amber-600 dark:text-amber-400">
                        {r.byCategory.permanent > 0 ? r.byCategory.permanent : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {r.byCategory.exit > 0 ? r.byCategory.exit : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-muted-foreground">
                        {r.byCategory.normal > 0 ? r.byCategory.normal : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center no-print">
                        <button
                          type="button"
                          onClick={() => setDrilldownTrain(r)}
                          disabled={!hasManovrs}
                          className={`flex items-center justify-center gap-1 w-full py-1 px-2.5 rounded-lg text-xs font-semibold transition-all shadow-2xs ${
                            hasManovrs
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                          }`}
                          title={hasManovrs ? `مشاهده ${r.totalManovrs} مانور قطار ${r.trainCode}` : "مانوری ثبت نشده"}
                        >
                          <span>🔍</span>
                          <span>ریز مانورها</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* فوتر جمع کل جدول ماتریس */}
              <tfoot className="bg-muted/80 font-bold border-t-2 border-border text-foreground">
                <tr>
                  <td colSpan={4} className="py-3 px-3 text-start">
                    مجموع ردیف‌های فعال ({tableTotals.trainsCount} قطار)
                  </td>
                  <td className="py-3 px-3 text-center font-extrabold text-primary text-sm">
                    {tableTotals.totalManovrs}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                    {tableTotals.totalLineChange}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                    {tableTotals.totalPermanent}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {tableTotals.totalExit}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-muted-foreground">
                    {tableTotals.totalNormal}
                  </td>
                  <td className="py-3 px-3 text-center no-print">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ۵. مودال تفصیلی ریز مانورهای قطار انتخابی */}
      {drilldownTrain && (
        <TrainPerformanceDrilldownModal
          trainRow={drilldownTrain}
          dateRangeLabel={stats?.effectiveRangeJalali?.label || "کل تاریخچه"}
          onClose={() => setDrilldownTrain(null)}
        />
      )}
    </div>
  );
}
