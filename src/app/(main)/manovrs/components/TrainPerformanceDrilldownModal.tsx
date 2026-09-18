"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { type TrainMatrixRow } from "@/lib/train-performance";
import ExcelJS from "exceljs";
import { toast } from "@/components/ui/Toast";

interface TrainPerformanceDrilldownModalProps {
  trainRow: TrainMatrixRow;
  dateRangeLabel: string;
  onClose: () => void;
}

export default function TrainPerformanceDrilldownModal({
  trainRow,
  dateRangeLabel,
  onClose,
}: TrainPerformanceDrilldownModalProps) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  // اطمینان از قرارگیری در کلاینت و قفل کردن اسکرول صفحه زیرین
  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // بستن با کلید Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // فیلتر داخلی مانورهای قطار
  const filteredManovrs = useMemo(() => {
    let list = trainRow.manovrs || [];

    if (selectedType !== "all") {
      const typeNum = Number(selectedType);
      list = list.filter((m) => m.type === typeNum);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.typeName.toLowerCase().includes(q) ||
          m.sourceLine.toLowerCase().includes(q) ||
          m.destLine.toLowerCase().includes(q) ||
          m.rahbar1Name.toLowerCase().includes(q) ||
          m.rahbar2Name.toLowerCase().includes(q) ||
          m.createdAtJalali.includes(q) ||
          (m.description && m.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [trainRow.manovrs, selectedType, search]);

  // استخراج انواع مانورهای منحصربه‌فرد انجام‌شده روی این قطار
  const uniqueTypes = useMemo(() => {
    const map = new Map<number, string>();
    (trainRow.manovrs || []).forEach((m) => {
      map.set(m.type, m.typeName);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [trainRow.manovrs]);

  // صدور اکسل اختصاصی سوابق این قطار
  const handleExportTrainExcel = async () => {
    if (filteredManovrs.length === 0) {
      toast.warning("رکوردی جهت صدور اکسل وجود ندارد.");
      return;
    }

    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "سامانه مانور فتح‌آباد";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet(`قطار_${trainRow.trainCode}`, {
        views: [{ rtl: true } as any],
      });

      worksheet.mergeCells("A1:J1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `کارنامه و ریز سوابق مانورهای قطار ${trainRow.trainCode} — بازه: ${dateRangeLabel}`;
      titleCell.font = { name: "Tahoma", size: 12, bold: true, color: { argb: "FF1E3A8A" } };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 32;

      const headers = [
        "ردیف",
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

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
        cell.font = { name: "Tahoma", bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      filteredManovrs.forEach((m, idx) => {
        const row = worksheet.addRow([
          idx + 1,
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
        row.height = 22;
        row.eachCell((cell, colNum) => {
          cell.font = { name: "Tahoma", size: 9 };
          cell.alignment = {
            vertical: "middle",
            horizontal: colNum === 1 || colNum === 9 ? "center" : "right",
          };
          if (idx % 2 === 1) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          }
        });
      });

      worksheet.columns = [
        { width: 8 },
        { width: 22 },
        { width: 20 },
        { width: 18 },
        { width: 18 },
        { width: 20 },
        { width: 20 },
        { width: 16 },
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
      a.download = `Train_${trainRow.trainCode}_History_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`فایل اکسل سوابق قطار ${trainRow.trainCode} دانلود شد.`);
    } catch {
      toast.error("خطا در ایجاد خروجی اکسل.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!mounted) return null;

  // رندر از طریق Portal مستقیماً روی body جهت قرارگیری کامل روی سایدبار و رفع مشکل Stacking Context
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 opacity-100"
        style={{ backgroundColor: "var(--panel, #ffffff)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* هدر مودال با پس‌زمینه کاملاً مات */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800"
          style={{ backgroundColor: "var(--panel-2, #f1f5f9)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl font-bold shadow-xs">
              🚆
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  ریز مانورها و سوابق تردد قطار {trainRow.trainCode}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  {trainRow.trainType === 0 ? "AC" : trainRow.trainType === 1 ? "DC" : "دیزل"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                موقعیت جاری: <b className="text-slate-900 dark:text-white">{trainRow.currentLineName}</b> | بازه زمانی:{" "}
                <b className="text-blue-700 dark:text-blue-400">{dateRangeLabel}</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* دکمه اکسل اختصاصی قطار */}
            <button
              type="button"
              onClick={handleExportTrainExcel}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
              title="خروجی اکسل از سوابق این قطار"
            >
              <span>{isExporting ? "⏳" : "📊"}</span>
              <span>اکسل قطار</span>
            </button>

            {/* دکمه بستن */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors text-sm font-bold shadow-2xs"
              title="بستن پنجره (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* کارت‌های خلاصه وضعیت این قطار با پس‌زمینه مات و مرزهای مشخص */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
          style={{ backgroundColor: "var(--ground, #f8fafc)" }}
        >
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">کل مانورهای قطار</span>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 block">
              {trainRow.totalManovrs} مانور
            </span>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">انتقال بین خطوط</span>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 block">
              {trainRow.byCategory.lineChange}
            </span>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">خروج به خط اصلی</span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {trainRow.byCategory.exit}
            </span>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">سایر مانورها (عادی/تست)</span>
            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 block">
              {trainRow.byCategory.normal + trainRow.byCategory.permanent}
            </span>
          </div>
        </div>

        {/* نوار ابزار فیلتر و جستجوی داخلی مودال */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40"
          style={{ backgroundColor: "var(--panel-2, #f1f5f9)" }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm">
            <div className="relative w-full">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو در مسیر، راهبر، ساعت یا توضیحات..."
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-slate-900 dark:text-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white px-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
              نوع مانور:
            </span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-hidden focus:border-blue-500 cursor-pointer text-slate-900 dark:text-white"
            >
              <option value="all">همه انواع مانور ({trainRow.manovrs.length})</option>
              {uniqueTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* جدول ریز مانورها با پس‌زمینه کاملاً سفید / تیره مات */}
        <div
          className="flex-1 overflow-y-auto px-6 py-4 bg-white dark:bg-slate-900"
          style={{ backgroundColor: "var(--panel, #ffffff)" }}
        >
          {filteredManovrs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-sm">
              <span className="text-3xl block mb-2">🔍</span>
              <span>هیچ مانوری با شرایط جستجوی فعلی برای این قطار یافت نشد.</span>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
              <table className="w-full text-xs text-start border-collapse">
                <thead
                  className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold"
                  style={{ backgroundColor: "var(--panel-2, #f1f5f9)" }}
                >
                  <tr>
                    <th className="py-3 px-3 text-center w-12 border-e border-slate-200 dark:border-slate-700">#</th>
                    <th className="py-3 px-3 text-start border-e border-slate-200 dark:border-slate-700">زمان ثبت (تهران)</th>
                    <th className="py-3 px-3 text-start border-e border-slate-200 dark:border-slate-700">نوع مانور</th>
                    <th className="py-3 px-3 text-start border-e border-slate-200 dark:border-slate-700">مسیر حرکت (مبدأ ← مقصد)</th>
                    <th className="py-3 px-3 text-start border-e border-slate-200 dark:border-slate-700">راهبر اصلی (۱)</th>
                    <th className="py-3 px-3 text-start border-e border-slate-200 dark:border-slate-700">کمک‌راهبر (۲)</th>
                    <th className="py-3 px-3 text-center border-e border-slate-200 dark:border-slate-700">مدت زمان</th>
                    <th className="py-3 px-3 text-start border-e border-slate-200 dark:border-slate-700">وضعیت</th>
                    <th className="py-3 px-3 text-start">توضیحات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredManovrs.map((m, idx) => (
                    <tr
                      key={m.id}
                      className={
                        idx % 2 === 0
                          ? "bg-white dark:bg-slate-900 hover:bg-blue-50/60 dark:hover:bg-slate-800/80 transition-colors"
                          : "bg-slate-50 dark:bg-slate-800/40 hover:bg-blue-50/60 dark:hover:bg-slate-800/80 transition-colors"
                      }
                    >
                      <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 font-mono border-e border-slate-100 dark:border-slate-800">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold whitespace-nowrap text-slate-900 dark:text-white border-e border-slate-100 dark:border-slate-800">
                        {m.createdAtJalali}
                      </td>
                      <td className="py-2.5 px-3 border-e border-slate-100 dark:border-slate-800">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-600/15 text-blue-700 dark:text-blue-300">
                          {m.typeName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap border-e border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400">{m.sourceLine}</span>
                        <span className="mx-1.5 text-blue-600 dark:text-blue-400">←</span>
                        <span className="text-slate-900 dark:text-white">{m.destLine}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 whitespace-nowrap font-medium border-e border-slate-100 dark:border-slate-800">
                        {m.rahbar1Name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap border-e border-slate-100 dark:border-slate-800">
                        {m.rahbar2Name}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 dark:text-slate-300 border-e border-slate-100 dark:border-slate-800">
                        {m.durationMinutes !== null ? `${m.durationMinutes} د` : "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap border-e border-slate-100 dark:border-slate-800">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          {m.statusName}
                        </span>
                      </td>
                      <td
                        className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate"
                        title={m.description || ""}
                      >
                        {m.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* فوتر مودال با پس‌زمینه مات */}
        <div
          className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300"
          style={{ backgroundColor: "var(--panel-2, #f1f5f9)" }}
        >
          <span className="font-medium">
            نمایش <b className="text-slate-900 dark:text-white">{filteredManovrs.length}</b> از{" "}
            <b>{trainRow.manovrs.length}</b> مانور ثبت‌شده برای این قطار
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-xs"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
