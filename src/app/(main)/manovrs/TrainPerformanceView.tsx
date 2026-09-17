"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  getTrainPerformanceStatsAction,
  type TrainPerformanceStats,
  type TrainPerformanceFilter,
} from "@/app/actions/train-performance";
import { toast } from "@/components/ui/Toast";
import ExcelJS from "exceljs";

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

  // فیلتر بازه زمانی سریع
  const [datePreset, setDatePreset] = useState<"today" | "week" | "month" | "custom" | "all">("month");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // جستجو در جدول مانورهای قطار
  const [tableSearch, setTableSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "lineChange" | "permanent" | "exit" | "normal">("all");

  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [stats, setStats] = useState<TrainPerformanceStats | null>(null);

  // واکشی داده‌های آمار عملکرد قطار
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

  // فیلتر کردن مانورهای جدول
  const filteredManovrs = useMemo(() => {
    if (!stats || !stats.manovrs) return [];
    let list = stats.manovrs;

    if (typeFilter !== "all") {
      list = list.filter((m) => {
        if (typeFilter === "permanent") return [21, 22, 23, 24].includes(m.type);
        if (typeFilter === "exit") return [16, 17, 18].includes(m.type);
        if (typeFilter === "lineChange") return [2, 10, 19].includes(m.type);
        return ![21, 22, 23, 24, 16, 17, 18, 2, 10, 19].includes(m.type);
      });
    }

    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.trainCode.toLowerCase().includes(q) ||
          m.typeName.toLowerCase().includes(q) ||
          m.sourceLine.toLowerCase().includes(q) ||
          m.destLine.toLowerCase().includes(q) ||
          m.rahbar1Name.toLowerCase().includes(q) ||
          m.rahbar2Name.toLowerCase().includes(q) ||
          (m.description && m.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [stats, typeFilter, tableSearch]);

  // خروجی استاندارد اکسل راست‌چین با ExcelJS
  const handleExportExcel = async () => {
    if (!stats || stats.manovrs.length === 0) {
      toast.info("رکوردی جهت خروجی اکسل در بازه انتخابی وجود ندارد.");
      return;
    }

    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "سامانه مانور فتح‌آباد";
      workbook.created = new Date();

      const selectedTrainObj = trains.find((t) => t.id === selectedTrainId);
      const sheetName = selectedTrainId === "all" ? "کارنامه_کل_ناوگان" : `قطار_${selectedTrainObj?.code || selectedTrainId}`;
      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ rtl: true } as any],
      });

      // ردیف عنوان
      worksheet.mergeCells("A1:K1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `گزارش جامع کارنامه و عملکرد ${
        selectedTrainId === "all" ? "کل ناوگان قطارها" : `قطار شماره ${selectedTrainObj?.code || ""}`
      } — پایانه فتح‌آباد`;
      titleCell.font = { name: "Tahoma", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E3A8A" },
      };
      worksheet.getRow(1).height = 35;

      // ردیف خلاصه شاخص‌ها
      worksheet.mergeCells("A2:K2");
      const subCell = worksheet.getCell("A2");
      subCell.value = `تعداد کل مانورها: ${stats.totalManovrs} | انتقال خطوط: ${stats.byType.lineChange} | دائم: ${stats.byType.permanent} | خروج: ${stats.byType.exit} | سایر: ${stats.byType.normal} | تعداد راهبران: ${stats.totalDriversCount} | خطوط تردد: ${stats.uniqueLinesCount}`;
      subCell.font = { name: "Tahoma", size: 10, bold: true };
      subCell.alignment = { vertical: "middle", horizontal: "center" };
      subCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
      worksheet.getRow(2).height = 25;

      // هدر جدول
      const headers = [
        "ردیف",
        "شماره قطار",
        "تاریخ و زمان ثبت",
        "نوع مانور",
        "خط مبدا",
        "خط مقصد",
        "راهبر اول",
        "راهبر دوم",
        "وضعیت",
        "مدت (دقیقه)",
        "توضیحات",
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF334155" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      // افزودن داده‌ها
      filteredManovrs.forEach((m, idx) => {
        const row = worksheet.addRow([
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
        row.height = 24;
        row.eachCell((cell, colNumber) => {
          cell.font = { name: "Tahoma", size: 9 };
          cell.alignment = {
            vertical: "middle",
            horizontal: colNumber === 1 || colNumber === 2 || colNumber === 10 ? "center" : "right",
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
          if (idx % 2 === 1) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            };
          }
        });
      });

      // تنظیم عرض ستون‌ها
      worksheet.columns = [
        { width: 8 },
        { width: 14 },
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
      a.download = `Train_Performance_${selectedTrainObj?.code || "Fleet"}_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("فایل اکسل کارنامه عملکرد با قالب راست‌چین دانلود شد.");
    } catch {
      toast.error("تولید فایل اکسل با خطا مواجه شد.");
    } finally {
      setIsExporting(false);
    }
  };

  // پیش‌نمایش چاپ مرورگر
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:m-0 print:p-0" dir="rtl">
      {/* هدر کنترلی و فیلترهای بالا */}
      <div className="bg-card border border-border/70 rounded-2xl p-5 shadow-xs transition-all no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* انتخابگر قطار */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
              انتخاب ناوگان:
            </span>
            <div className="relative min-w-[220px]">
              <select
                value={selectedTrainId}
                onChange={(e) => {
                  const val = e.target.value === "all" ? "all" : Number(e.target.value);
                  setSelectedTrainId(val);
                }}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all outline-hidden cursor-pointer"
              >
                <option value="all">🚦 همه ناوگان (کل قطارها)</option>
                {trains.map((t) => (
                  <option key={t.id} value={t.id}>
                    قطار {t.code} {t.type === 0 ? "(AC)" : t.type === 1 ? "(DC)" : t.type === 2 ? "(دیزل)" : ""}
                  </option>
                ))}
              </select>
            </div>

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
              onClick={() => setDatePreset("today")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                datePreset === "today"
                  ? "bg-primary text-primary-foreground shadow-xs"
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
                  ? "bg-primary text-primary-foreground shadow-xs"
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
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              این ماه
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                datePreset === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              کل تاریخچه
            </button>
            <button
              type="button"
              onClick={() => setDatePreset("custom")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                datePreset === "custom"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              بازه دلخواه...
            </button>

            {/* دکمه‌های خروجی و چاپ */}
            <div className="flex items-center gap-2 ms-auto">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExporting || isLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <span>{isExporting ? "در حال استخراج..." : "اکسل راست‌چین"}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-all shadow-xs cursor-pointer"
              >
                <span>چاپ کارنامه</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* فیلتر سفارشی بازه تاریخ */}
        {datePreset === "custom" && (
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">از تاریخ:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground"
            />
            <span className="text-xs text-muted-foreground">تا تاریخ:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground"
            />
            <button
              type="button"
              onClick={fetchStats}
              className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium cursor-pointer"
            >
              اعمال فیلتر
            </button>
          </div>
        )}
      </div>

      {/* بخش چاپ — عنوان گزارش در برگه چاپی */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h1 className="text-lg font-bold">سامانه مدیریت پایانه فتح‌آباد — کارنامه و گزارش عملکرد قطار</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedTrainId === "all" ? "تحلیل جامع کل ناوگان" : `قطار شماره ${trains.find((t) => t.id === selectedTrainId)?.code || ""}`} | تاریخ چاپ: {new Date().toLocaleDateString("fa-IR")}
        </p>
      </div>

      {/* کارت‌های شاخص‌های عملکرد (KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* کارت کل مانورها */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">کل عملیات مانور</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {isLoading ? "..." : (stats?.totalManovrs || 0).toLocaleString("fa-IR")}
            </span>
            <span className="text-xs text-muted-foreground font-normal">عملیات ثبت‌شده</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>در بازه انتخابی</span>
            <span className="text-primary font-medium">{datePreset === "today" ? "روزانه" : datePreset === "week" ? "هفتگی" : datePreset === "month" ? "ماهانه" : "کامل"}</span>
          </div>
        </div>

        {/* کارت تفکیک انواع مانور */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">ترکیب انواع مانور</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between bg-muted/50 px-2 py-1 rounded-lg">
              <span className="text-muted-foreground text-[11px]">خط به خط:</span>
              <b className="text-foreground">{stats?.byType.lineChange || 0}</b>
            </div>
            <div className="flex justify-between bg-muted/50 px-2 py-1 rounded-lg">
              <span className="text-muted-foreground text-[11px]">دائم:</span>
              <b className="text-foreground">{stats?.byType.permanent || 0}</b>
            </div>
            <div className="flex justify-between bg-muted/50 px-2 py-1 rounded-lg">
              <span className="text-muted-foreground text-[11px]">خروج:</span>
              <b className="text-foreground">{stats?.byType.exit || 0}</b>
            </div>
            <div className="flex justify-between bg-muted/50 px-2 py-1 rounded-lg">
              <span className="text-muted-foreground text-[11px]">عادی/تست:</span>
              <b className="text-foreground">{stats?.byType.normal || 0}</b>
            </div>
          </div>
        </div>

        {/* کارت راهبران مشارکت‌کننده */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">راهبران هدایت‌کننده</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {isLoading ? "..." : (stats?.totalDriversCount || 0).toLocaleString("fa-IR")}
            </span>
            <span className="text-xs text-muted-foreground font-normal">نفر راهبر مجزا</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground truncate">
            {stats?.topDrivers && stats.topDrivers.length > 0 ? (
              <span>بیشترین تردد: <b>{stats.topDrivers[0]?.name}</b> ({stats.topDrivers[0]?.count} مانور)</span>
            ) : (
              <span>بدون ثبت راهبر</span>
            )}
          </div>
        </div>

        {/* کارت خطوط و ریل‌های ترددشده */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">خطوط ترددشده</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {isLoading ? "..." : (stats?.uniqueLinesCount || 0).toLocaleString("fa-IR")}
            </span>
            <span className="text-xs text-muted-foreground font-normal">خط مستقل در پایانه</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground truncate">
            {stats?.topLines && stats.topLines.length > 0 ? (
              <span>بیشترین جابجایی: <b>{stats.topLines[0]?.name}</b></span>
            ) : (
              <span>بدون ثبت خط</span>
            )}
          </div>
        </div>
      </div>

      {/* بخش جدول سوابق و جزئیات مانورهای قطار */}
      <div className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
        {/* فیلترهای درون‌جدولی */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/20 no-print">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">ریز سوابق مانورها</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
              {filteredManovrs.length} رکورد
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* فیلتر دسته مانور */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground cursor-pointer"
            >
              <option value="all">همه انواع مانور</option>
              <option value="lineChange">انتقال خط به خط</option>
              <option value="permanent">انتقال دائم</option>
              <option value="exit">خروجی‌ها به خط اصلی</option>
              <option value="normal">عادی / تست / سایر</option>
            </select>

            {/* جستجوی متنی */}
            <div className="relative">
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="جستجو در خط، راهبر، توضیحات..."
                className="bg-background border border-border rounded-xl ps-8 pe-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary w-48 lg:w-64"
              />
              <svg className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* جدول مانورها */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3">شماره قطار</th>
                <th className="py-3 px-3">تاریخ و زمان ثبت</th>
                <th className="py-3 px-3">نوع مانور</th>
                <th className="py-3 px-3">خط مبدا</th>
                <th className="py-3 px-3">خط مقصد</th>
                <th className="py-3 px-3">راهبر اول</th>
                <th className="py-3 px-3">راهبر دوم</th>
                <th className="py-3 px-3 text-center">وضعیت</th>
                <th className="py-3 px-3 text-center">مدت (دقیقه)</th>
                <th className="py-3 px-4">توضیحات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>در حال بارگذاری اطلاعات عملکرد ناوگان...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredManovrs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    هیچ رکوردی برای قطار و بازه انتخابی ثبت نشده است.
                  </td>
                </tr>
              ) : (
                filteredManovrs.map((m, index) => (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 text-center text-muted-foreground">{index + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-foreground">{m.trainCode}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono text-[11px] dir-ltr text-right">
                      {m.createdAtJalali}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-foreground">{m.typeName}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="bg-muted px-2 py-0.5 rounded-md text-foreground">{m.sourceLine}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="bg-muted px-2 py-0.5 rounded-md text-foreground">{m.destLine}</span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-foreground">{m.rahbar1Name}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{m.rahbar2Name}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          m.status === 2
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : m.status === 1
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {m.statusName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {m.durationMinutes !== null ? (
                        <span>{m.durationMinutes}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground max-w-xs truncate" title={m.description || ""}>
                      {m.description || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
