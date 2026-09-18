"use client";

import React, { useState, useMemo } from "react";
import { type TrainMatrixRow, type TrainPerformanceManovrItem } from "@/lib/train-performance";
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
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* هدر مودال */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-xl font-bold shadow-2xs">
              🚆
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">
                  ریز مانورها و سوابق تردد قطار {trainRow.trainCode}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-primary/20 text-primary">
                  {trainRow.trainType === 0 ? "AC" : trainRow.trainType === 1 ? "DC" : "دیزل"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                موقعیت جاری: <b className="text-foreground">{trainRow.currentLineName}</b> | بازه زمانی:{" "}
                <b className="text-primary">{dateRangeLabel}</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* دکمه اکسل اختصاصی قطار */}
            <button
              type="button"
              onClick={handleExportTrainExcel}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs"
              title="خروجی اکسل از سوابق این قطار"
            >
              <span>{isExporting ? "⏳" : "📊"}</span>
              <span>اکسل قطار</span>
            </button>

            {/* دکمه بستن */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors text-sm"
              title="بستن پنجره"
            >
              ✕
            </button>
          </div>
        </div>

        {/* کارت‌های خلاصه وضعیت این قطار */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-border/60 bg-background/50">
          <div className="p-2.5 rounded-xl border border-border/70 bg-card shadow-2xs">
            <span className="text-[11px] text-muted-foreground font-medium block">کل مانورهای قطار</span>
            <span className="text-lg font-extrabold text-primary mt-0.5 block">{trainRow.totalManovrs} مانور</span>
          </div>
          <div className="p-2.5 rounded-xl border border-border/70 bg-card shadow-2xs">
            <span className="text-[11px] text-muted-foreground font-medium block">انتقال بین خطوط</span>
            <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 block">
              {trainRow.byCategory.lineChange}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-border/70 bg-card shadow-2xs">
            <span className="text-[11px] text-muted-foreground font-medium block">خروج به خط اصلی</span>
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {trainRow.byCategory.exit}
            </span>
          </div>
          <div className="p-2.5 rounded-xl border border-border/70 bg-card shadow-2xs">
            <span className="text-[11px] text-muted-foreground font-medium block">سایر مانورها (عادی/تست)</span>
            <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 block">
              {trainRow.byCategory.normal + trainRow.byCategory.permanent}
            </span>
          </div>
        </div>

        {/* نوار ابزار فیلتر و جستجوی داخلی مودال */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در مسیر، راهبر، ساعت یا توضیحات..."
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-hidden focus:border-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs text-muted-foreground hover:text-foreground px-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">نوع مانور:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-hidden focus:border-primary cursor-pointer"
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

        {/* جدول ریز مانورها */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredManovrs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <span className="text-3xl block mb-2">🔍</span>
              <span>هیچ مانوری با شرایط جستجوی فعلی برای این قطار یافت نشد.</span>
            </div>
          ) : (
            <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/70 text-muted-foreground font-bold border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">#</th>
                    <th className="py-2.5 px-3 text-start">زمان ثبت (تهران)</th>
                    <th className="py-2.5 px-3 text-start">نوع مانور</th>
                    <th className="py-2.5 px-3 text-start">مسیر حرکت (مبدأ ← مقصد)</th>
                    <th className="py-2.5 px-3 text-start">راهبر اصلی (۱)</th>
                    <th className="py-2.5 px-3 text-start">کمک‌راهبر (۲)</th>
                    <th className="py-2.5 px-3 text-center">مدت زمان</th>
                    <th className="py-2.5 px-3 text-start">وضعیت</th>
                    <th className="py-2.5 px-3 text-start">توضیحات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredManovrs.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2 px-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium whitespace-nowrap text-foreground">
                        {m.createdAtJalali}
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary">
                          {m.typeName}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold whitespace-nowrap">
                        <span className="text-muted-foreground">{m.sourceLine}</span>
                        <span className="mx-1.5 text-primary">←</span>
                        <span className="text-foreground">{m.destLine}</span>
                      </td>
                      <td className="py-2 px-3 text-foreground whitespace-nowrap font-medium">
                        {m.rahbar1Name}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                        {m.rahbar2Name}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-muted-foreground">
                        {m.durationMinutes !== null ? `${m.durationMinutes} د` : "—"}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          {m.statusName}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground max-w-xs truncate" title={m.description || ""}>
                        {m.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* فوتر مودال */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border/80 bg-muted/30 text-xs text-muted-foreground">
          <span>نمایش {filteredManovrs.length} از {trainRow.manovrs.length} مانور این قطار</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
}
