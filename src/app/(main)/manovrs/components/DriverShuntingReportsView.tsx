"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import JalaliDateTimePicker from "@/components/JalaliDateTimePicker";
import { toast } from "@/components/ui/Toast";
import {
  getDriverShuntingReport,
  type DriverShiftSummary,
  type PeriodicBucket,
  type ShuntingReportResponse,
} from "@/app/actions/manovr-reports";

interface LookupValue {
  code: number;
  label: string;
  color: string | null;
}

interface DriverItem {
  id: number;
  firstName: string;
  lastName: string;
  personnelCode: string | null;
  shift: number;
  isPartTimeDriver?: boolean;
  orgPosition?: number;
}

interface DriverShuntingReportsViewProps {
  drivers: DriverItem[];
  shifts?: LookupValue[];
  manovrTypes?: LookupValue[];
}

export default function DriverShuntingReportsView({
  drivers,
  shifts = [],
  manovrTypes = [],
}: DriverShuntingReportsViewProps) {
  // فیلترهای گزارش
  const [selectedDriverId, setSelectedDriverId] = useState<number | "all">("all");
  const [selectedShift, setSelectedShift] = useState<number | "all">("all");
  const [driverType, setDriverType] = useState<"all" | "regular" | "part_time">("all");
  const [breakdown, setBreakdown] = useState<"daily" | "weekly" | "monthly">("daily");
  const [soloOnly, setSoloOnly] = useState<boolean>(false);
  const [activeDatePreset, setActiveDatePreset] = useState<"today" | "week" | "month" | "all">("all");

  // جستجوی درون جدول
  const [driverSearchQuery, setDriverSearchQuery] = useState("");
  const [opsSearchQuery, setOpsSearchQuery] = useState("");
  const [opsCrewFilter, setOpsCrewFilter] = useState<"all" | "solo" | "assisted">("all");

  // مرتب‌سازی جدول راهبران
  const [sortField, setSortField] = useState<"name" | "shunts" | "solo" | "assisted" | "percent">("shunts");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // بازه زمانی پیش‌فرض: کل تاریخچه به صورت پیش‌فرض تا تمامی مانورها دیده شوند
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<ShuntingReportResponse["summary"]>({
    totalOperations: 0,
    soloOperations: 0,
    assistedOperations: 0,
    soloPercentage: 0,
    shiftCounts: { A: 0, B: 0, C: 0, D: 0, other: 0 },
  });
  const [driverSummaries, setDriverSummaries] = useState<DriverShiftSummary[]>([]);
  const [periodicBreakdown, setPeriodicBreakdown] = useState<PeriodicBucket[]>([]);
  const [operations, setOperations] = useState<any[]>([]);

  // زیرنمای فعال در تب گزارش
  const [activeSubView, setActiveSubView] = useState<"matrix" | "periodic" | "operations">("matrix");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // واکشی داده‌های گزارش از سرور
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getDriverShuntingReport({
        driverId: selectedDriverId === "all" ? null : selectedDriverId,
        shift: selectedShift === "all" ? null : selectedShift,
        fromDate: fromDate || null,
        toDate: toDate || null,
        soloOnly,
        breakdown,
        driverType,
      });

      if (res.success) {
        setReportData(res.summary);
        setDriverSummaries(res.driverSummaries);
        setPeriodicBreakdown(res.periodicBreakdown);
        setOperations(res.operations);
      } else {
        toast.error(res.error || "خطا در بارگذاری گزارش مانور.");
      }
    } catch (err) {
      console.error(err);
      toast.error("خطای غیرمنتظره در ارتباط با سرور.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDriverId, selectedShift, fromDate, toDate, soloOnly, breakdown, driverType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // تنظیم میانبرهای بازه زمانی
  const handleQuickRange = (type: "today" | "week" | "month" | "all") => {
    setActiveDatePreset(type);
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    setToDate(now.toISOString());

    if (type === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      setFromDate(start.toISOString());
    } else if (type === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      setFromDate(start.toISOString());
    } else if (type === "month") {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      setFromDate(start.toISOString());
    } else if (type === "all") {
      setFromDate("");
    }
  };

  const getShiftLabel = (code: number) => {
    const found = shifts.find((s) => s.code === code);
    if (found) return `شیفت ${found.label}`;
    if (code === 1) return "شیفت A";
    if (code === 2) return "شیفت B";
    if (code === 3) return "شیفت C";
    if (code === 4) return "شیفت D";
    return `شیفت ${code}`;
  };

  const getShiftBadgeClass = (code: number) => {
    if (code === 1) return { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6", border: "rgba(59, 130, 246, 0.35)" };
    if (code === 2) return { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981", border: "rgba(16, 185, 129, 0.35)" };
    if (code === 3) return { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.35)" };
    if (code === 4) return { bg: "rgba(139, 92, 246, 0.15)", text: "#8b5cf6", border: "rgba(139, 92, 246, 0.35)" };
    return { bg: "var(--panel-2)", text: "var(--ink-soft)", border: "var(--line)" };
  };

  const getManovrTypeLabel = (typeCode: number) => {
    return manovrTypes.find((t) => t.code === typeCode)?.label || `نوع ${typeCode}`;
  };

  // فیلتر و مرتب‌سازی جدول راهبران
  const filteredDriverSummaries = useMemo(() => {
    let list = [...driverSummaries];

    if (driverSearchQuery.trim()) {
      const q = driverSearchQuery.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.driverName.toLowerCase().includes(q) ||
          d.personnelCode.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: any = a.totalShunts;
      let valB: any = b.totalShunts;

      if (sortField === "name") {
        valA = a.driverName;
        valB = b.driverName;
        return sortOrder === "asc"
          ? valA.localeCompare(valB, "fa")
          : valB.localeCompare(valA, "fa");
      }
      if (sortField === "shunts") {
        valA = a.totalShunts;
        valB = b.totalShunts;
      } else if (sortField === "solo") {
        valA = a.soloShunts;
        valB = b.soloShunts;
      } else if (sortField === "assisted") {
        valA = a.assistedShunts;
        valB = b.assistedShunts;
      } else if (sortField === "percent") {
        valA = a.soloPercentage;
        valB = b.soloPercentage;
      }

      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    return list;
  }, [driverSummaries, driverSearchQuery, sortField, sortOrder]);

  // فیلتر فهرست ریز مانورها
  const filteredOperations = useMemo(() => {
    let list = [...operations];

    if (opsCrewFilter === "solo") {
      list = list.filter((op) => op.rahbar1Id && !op.rahbar2Id);
    } else if (opsCrewFilter === "assisted") {
      list = list.filter((op) => op.rahbar2Id);
    }

    if (opsSearchQuery.trim()) {
      const q = opsSearchQuery.trim().toLowerCase();
      list = list.filter((op) => {
        const train = op.train?.code?.toLowerCase() || "";
        const r1 = op.rahbar1 ? `${op.rahbar1.firstName} ${op.rahbar1.lastName}`.toLowerCase() : "";
        const r2 = op.rahbar2 ? `${op.rahbar2.firstName} ${op.rahbar2.lastName}`.toLowerCase() : "";
        const sLine = op.sourceLine?.name?.toLowerCase() || "";
        const dLine = op.destinationLine?.name?.toLowerCase() || "";
        return (
          train.includes(q) ||
          r1.includes(q) ||
          r2.includes(q) ||
          sLine.includes(q) ||
          dLine.includes(q) ||
          String(op.id).includes(q)
        );
      });
    }

    return list;
  }, [operations, opsCrewFilter, opsSearchQuery]);

  // خروجی جامع اکسل راست‌چین بدون ستون‌های اضافی شیفت
  const handleExportExcel = async () => {
    if (operations.length === 0 && driverSummaries.length === 0) {
      toast.warning("داده‌ای برای خروجی اکسل یافت نشد.");
      return;
    }

    setIsExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();

      // ۱. شیت خلاصه عملکرد راهبران (ساده، دقیق و حرفه‌ای بدون ستون‌های زاید شیفت)
      const wsDrivers = workbook.addWorksheet("عملکرد راهبران");
      wsDrivers.views = [{ rtl: true } as any];

      wsDrivers.columns = [
        { header: "ردیف", key: "index", width: 8 },
        { header: "نام و نام خانوادگی راهبر", key: "driverName", width: 25 },
        { header: "کد پرسنلی", key: "personnelCode", width: 15 },
        { header: "شیفت سازمانی", key: "primaryShift", width: 16 },
        { header: "تعداد مانور", key: "totalShunts", width: 16 },
        { header: "مانور تک‌نفره (Solo)", key: "soloShunts", width: 20 },
        { header: "مانور با کمک‌راهبر", key: "assistedShunts", width: 18 },
        { header: "سهم سولو (%)", key: "soloPercentage", width: 16 },
      ];

      const driverHead = wsDrivers.getRow(1);
      driverHead.height = 28;
      driverHead.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
        cell.font = { name: "Tahoma", bold: true, color: { argb: "FFFFFFFF" }, size: 10.5 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      filteredDriverSummaries.forEach((d, idx) => {
        wsDrivers.addRow({
          index: idx + 1,
          driverName: d.driverName,
          personnelCode: d.personnelCode,
          primaryShift: getShiftLabel(d.primaryShift),
          totalShunts: d.totalShunts,
          soloShunts: d.soloShunts,
          assistedShunts: d.assistedShunts,
          soloPercentage: `${d.soloPercentage}%`,
        });
      });

      // ۲. شیت تفکیک دوره‌ای (روزانه / هفتگی / ماهانه)
      const wsPeriodic = workbook.addWorksheet(
        breakdown === "daily" ? "تفکیک روزانه" : breakdown === "weekly" ? "تفکیک هفتگی" : "تفکیک ماهانه"
      );
      wsPeriodic.views = [{ rtl: true } as any];

      wsPeriodic.columns = [
        { header: "دوره زمانی", key: "periodLabel", width: 25 },
        { header: "تعداد مانور", key: "total", width: 16 },
        { header: "مانور تک‌نفره (Solo)", key: "solo", width: 20 },
        { header: "مانور با کمک‌راهبر", key: "assisted", width: 18 },
        { header: "سهم سولو (%)", key: "soloPct", width: 16 },
      ];

      const periodicHead = wsPeriodic.getRow(1);
      periodicHead.height = 28;
      periodicHead.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
        cell.font = { name: "Tahoma", bold: true, color: { argb: "FFFFFFFF" }, size: 10.5 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      periodicBreakdown.forEach((p) => {
        const soloPct = p.total > 0 ? Math.round((p.solo / p.total) * 100) : 0;
        wsPeriodic.addRow({
          periodLabel: p.periodLabel,
          total: p.total,
          solo: p.solo,
          assisted: p.assisted,
          soloPct: `${soloPct}%`,
        });
      });

      // ۳. شیت ریز عملیات مانور
      const wsOps = workbook.addWorksheet("ریز عملیات مانور");
      wsOps.views = [{ rtl: true } as any];

      wsOps.columns = [
        { header: "کد مانور", key: "id", width: 12 },
        { header: "نوع مانور", key: "type", width: 20 },
        { header: "شماره قطار", key: "train", width: 14 },
        { header: "ریل مبدأ", key: "sourceLine", width: 18 },
        { header: "ریل مقصد", key: "destLine", width: 18 },
        { header: "راهبر اصلی (راهبر ۱)", key: "rahbar1", width: 22 },
        { header: "کمک‌راهبر (راهبر ۲)", key: "rahbar2", width: 22 },
        { header: "نحوه خدمه", key: "crewType", width: 18 },
        { header: "شیفت راهبر", key: "shift", width: 14 },
        { header: "زمان اجرا", key: "executionTime", width: 20 },
      ];

      const opsHead = wsOps.getRow(1);
      opsHead.height = 28;
      opsHead.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
        cell.font = { name: "Tahoma", bold: true, color: { argb: "FFFFFFFF" }, size: 10.5 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      operations.forEach((op) => {
        const isSolo = Boolean(op.rahbar1Id && !op.rahbar2Id);
        wsOps.addRow({
          id: op.id,
          type: getManovrTypeLabel(op.type),
          train: op.train?.code || "—",
          sourceLine: op.sourceLine?.name || "—",
          destLine: op.destinationLine?.name || "—",
          rahbar1: op.rahbar1 ? `${op.rahbar1.firstName} ${op.rahbar1.lastName}` : "—",
          rahbar2: op.rahbar2 ? `${op.rahbar2.firstName} ${op.rahbar2.lastName}` : "—",
          crewType: isSolo ? "تک‌نفره (Solo)" : op.rahbar2Id ? "با کمک‌راهبر" : "نامشخص",
          shift: op.rahbar1?.shift ? getShiftLabel(op.rahbar1.shift) : "—",
          executionTime: op.executionTime
            ? new Date(op.executionTime).toLocaleString("fa-IR", {
                timeZone: "Asia/Tehran",
                calendar: "persian",
              })
            : "—",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `driver-shunting-report-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("خروجی اکسل گزارش عملکرد راهبران با موفقیت دانلود شد.");
    } catch (err) {
      console.error(err);
      toast.error("خطا در ایجاد فایل اکسل گزارش.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSortToggle = (field: "name" | "shunts" | "solo" | "assisted" | "percent") => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* ۱. نوار فیلترهای پیشرفته گزارش راهبران و شیفت‌ها */}
      <div
        className="card"
        style={{
          padding: "16px",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          boxShadow: "0 4px 20px -5px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "14px",
            borderBottom: "1px solid var(--line)",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                border: "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              📊
            </div>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: "bold", margin: 0, color: "var(--ink)" }}>
                گزارش عملکرد مانور راهبران و شیفت‌ها
              </h2>
              <span style={{ fontSize: "11.5px", color: "var(--ink-soft)" }}>
                آمار تحلیلی عملیات مانور، ردیابی فعالیت‌های تک‌نفره (Solo) و تفکیک دوره‌ای
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={handleExportExcel}
              disabled={isExporting || isLoading}
              className="btn sm primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 600,
                borderRadius: "8px",
                padding: "8px 16px",
              }}
            >
              <span>{isExporting ? "⏳ در حال ساخت اکسل..." : "📥 خروجی اکسل گزارش"}</span>
            </button>
            <button
              onClick={fetchReport}
              disabled={isLoading}
              className="btn sm secondary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                borderRadius: "8px",
                padding: "8px 14px",
              }}
            >
              <span>{isLoading ? "در حال دریافت..." : "🔄 به‌روزرسانی"}</span>
            </button>
          </div>
        </div>

        {/* فیلترها و دراپ‌داون‌ها */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "12px",
            paddingTop: "14px",
          }}
        >
          {/* انتخاب راهبر */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)" }}>
              👤 راهبر مانور
            </label>
            <select
              className="input sm"
              style={{ height: "34px", fontSize: "12px", borderRadius: "6px" }}
              value={selectedDriverId}
              onChange={(e) =>
                setSelectedDriverId(e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">همه راهبران ({drivers.length} نفر)</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName} {d.isPartTimeDriver ? "(غیردائم)" : ""} {d.personnelCode ? `(${d.personnelCode})` : ""}{" "}
                  {d.shift ? `[شیفت ${d.shift === 1 ? "A" : d.shift === 2 ? "B" : d.shift === 3 ? "C" : "D"}]` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* فیلتر نوع صلاحیت راهبر */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)" }}>
              🏷 صلاحیت راهبر
            </label>
            <select
              className="input sm"
              style={{ height: "34px", fontSize: "12px", borderRadius: "6px" }}
              value={driverType}
              onChange={(e) => setDriverType(e.target.value as any)}
            >
              <option value="all">همه صلاحیت‌ها (رسمی و غیردائم)</option>
              <option value="regular">فقط راهبران رسمی/دائم</option>
              <option value="part_time">فقط راهبران غیردائم</option>
            </select>
          </div>

          {/* فیلتر شیفت کاری (A, B, C, D) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)" }}>
              ⏱ شیفت کاری
            </label>
            <select
              className="input sm"
              style={{ height: "34px", fontSize: "12px", borderRadius: "6px" }}
              value={selectedShift}
              onChange={(e) =>
                setSelectedShift(e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">همه شیفت‌ها (A, B, C, D)</option>
              <option value="1">شیفت A</option>
              <option value="2">شیفت B</option>
              <option value="3">شیفت C</option>
              <option value="4">شیفت D</option>
            </select>
          </div>

          {/* نوع تفکیک دوره‌ای (روزانه / هفتگی / ماهانه) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)" }}>
              📅 نوع تفکیک دوره‌ای
            </label>
            <div style={{ display: "flex", gap: "4px" }}>
              {[
                { id: "daily", label: "روزانه" },
                { id: "weekly", label: "هفتگی" },
                { id: "monthly", label: "ماهانه" },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBreakdown(b.id as any)}
                  className={`btn sm ${breakdown === b.id ? "primary" : "secondary"}`}
                  style={{
                    flex: 1,
                    padding: "4px 8px",
                    fontSize: "11px",
                    height: "34px",
                    borderRadius: "6px",
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* فیلتر بازه زمانی: از تاریخ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)" }}>
              از تاریخ (اجرای مانور)
            </label>
            <JalaliDateTimePicker
              value={fromDate}
              onChange={(val) => {
                setFromDate(val);
                setActiveDatePreset("all");
              }}
            />
          </div>

          {/* فیلتر بازه زمانی: تا تاریخ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)" }}>
              تا تاریخ (اجرای مانور)
            </label>
            <JalaliDateTimePicker
              value={toDate}
              onChange={(val) => {
                setToDate(val);
                setActiveDatePreset("all");
              }}
            />
          </div>
        </div>

        {/* نوار میانبرهای تاریخ و سوییچ مانورهای تک‌نفره */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: "1px dashed var(--line)",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "var(--ink-soft)", fontWeight: 600 }}>بازه سریع:</span>
            {[
              { id: "today", label: "امروز" },
              { id: "week", label: "۷ روز گذشته" },
              { id: "month", label: "۳۰ روز اخیر" },
              { id: "all", label: "کل تاریخچه" },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`btn sm ${activeDatePreset === preset.id ? "primary" : "secondary"}`}
                style={{
                  fontSize: "11px",
                  padding: "2px 10px",
                  height: "28px",
                  borderRadius: "6px",
                  fontWeight: activeDatePreset === preset.id ? "bold" : "normal",
                }}
                onClick={() => handleQuickRange(preset.id as any)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* فیلتر سولو: تفکیک مانور تک‌نفره */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              userSelect: "none",
              background: soloOnly ? "rgba(234, 88, 12, 0.15)" : "var(--panel-2)",
              padding: "5px 12px",
              borderRadius: "8px",
              border: soloOnly ? "1px solid #ea580c" : "1px solid var(--line)",
              color: soloOnly ? "#ea580c" : "var(--ink)",
              transition: "all 0.2s ease",
            }}
          >
            <input
              type="checkbox"
              checked={soloOnly}
              onChange={(e) => setSoloOnly(e.target.checked)}
              style={{ accentColor: "#ea580c", cursor: "pointer", width: "16px", height: "16px" }}
            />
            <span>🎯 فقط مانورهای تک‌نفره (بدون کمک‌راهبر / Solo)</span>
          </label>
        </div>
      </div>

      {/* ۲. کارت‌های آماری شاخص‌های کلیدی (KPI Cards) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
        }}
      >
        {/* کارت کل مانورها */}
        <div
          className="card"
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            background: "linear-gradient(135deg, rgba(30, 58, 95, 0.15), transparent)",
            border: "1px solid rgba(59, 130, 246, 0.35)",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>
              کل عملیات مانور
            </span>
            <span style={{ fontSize: "20px" }}>🚂</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--ink)" }}>
            {reportData.totalOperations.toLocaleString("fa-IR")}
          </div>
          <div style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
            مجموع مانورهای انجام‌شده در بازه زمانی تعیین‌شده
          </div>
        </div>

        {/* کارت مانورهای تک‌نفره (Solo) */}
        <div
          className="card"
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            background: "linear-gradient(135deg, rgba(234, 88, 12, 0.15), transparent)",
            border: "1px solid rgba(234, 88, 12, 0.4)",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#ea580c", fontWeight: 600 }}>
              مانورهای تک‌نفره (Solo)
            </span>
            <span style={{ fontSize: "20px" }}>👤</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#ea580c" }}>
            {reportData.soloOperations.toLocaleString("fa-IR")}
          </div>
          <div style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
            عملیات مستقل توسط یک راهبر (بدون حضور کمکی)
          </div>
        </div>

        {/* کارت مانورهای با کمک‌راهبر */}
        <div
          className="card"
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), transparent)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#10b981", fontWeight: 600 }}>
              مانور با کمک‌راهبر
            </span>
            <span style={{ fontSize: "20px" }}>👥</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#10b981" }}>
            {reportData.assistedOperations.toLocaleString("fa-IR")}
          </div>
          <div style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
            عملیات مشترک با همراهی راهبر کمکی (راهبر ۱ و ۲)
          </div>
        </div>

        {/* کارت درصد مانورهای تک‌نفره */}
        <div
          className="card"
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            background: "linear-gradient(135deg, rgba(147, 51, 234, 0.15), transparent)",
            border: "1px solid rgba(147, 51, 234, 0.35)",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#9333ea", fontWeight: 600 }}>
              سهم عملیات انفرادی (Solo)
            </span>
            <span style={{ fontSize: "20px" }}>📈</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#9333ea" }}>
            {reportData.soloPercentage}٪
          </div>
          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "var(--line)",
              borderRadius: "4px",
              overflow: "hidden",
              marginTop: "4px",
            }}
          >
            <div
              style={{
                width: `${reportData.soloPercentage}%`,
                height: "100%",
                backgroundColor: "#9333ea",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* ۳. نوارهای آماری تعاملی شیفت‌های چهارگانه A, B, C, D */}
      <div
        className="card"
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          flexWrap: "wrap",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "10px",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
          توزیع مانورها بر اساس شیفت‌های کاری:
        </span>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1 }}>
          {[
            { key: 1, label: "شیفت A", count: reportData.shiftCounts.A, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.35)" },
            { key: 2, label: "شیفت B", count: reportData.shiftCounts.B, color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.35)" },
            { key: 3, label: "شیفت C", count: reportData.shiftCounts.C, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.35)" },
            { key: 4, label: "شیفت D", count: reportData.shiftCounts.D, color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)", border: "rgba(139, 92, 246, 0.35)" },
          ].map((s) => {
            const isSelected = selectedShift === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelectedShift(isSelected ? "all" : s.key)}
                style={{
                  padding: "4px 14px",
                  background: isSelected ? s.color : s.bg,
                  color: isSelected ? "#fff" : "var(--ink)",
                  border: `1px solid ${s.border}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontWeight: isSelected ? "bold" : 500,
                  boxShadow: isSelected ? `0 2px 8px ${s.border}` : "none",
                }}
                title={`کلیک برای فیلتر شیفت ${s.label}`}
              >
                <span style={{ color: isSelected ? "#fff" : s.color, fontWeight: "bold" }}>
                  {s.label}:
                </span>
                <span>{s.count.toLocaleString("fa-IR")} مانور</span>
                {isSelected && (
                  <span style={{ fontSize: "10px", background: "rgba(0,0,0,0.2)", padding: "1px 6px", borderRadius: "10px" }}>
                    ✓ فعال
                  </span>
                )}
              </button>
            );
          })}

          {selectedShift !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedShift("all")}
              className="btn sm danger"
              style={{ padding: "4px 10px", fontSize: "11px", height: "30px", borderRadius: "6px" }}
            >
              حذف فیلتر شیفت
            </button>
          )}
        </div>
      </div>

      {/* ۴. تب‌های زیرنما: عملکرد راهبران | تفکیک دوره‌ای | ریز مانورها */}
      <div className="card" style={{ padding: "16px", borderRadius: "12px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--line)",
            paddingBottom: "12px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveSubView("matrix")}
              className={`btn sm ${activeSubView === "matrix" ? "primary" : "secondary"}`}
              style={{ fontWeight: 600, fontSize: "12px", borderRadius: "8px", padding: "6px 14px" }}
            >
              👥 عملکرد راهبران ({filteredDriverSummaries.length} نفر)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView("periodic")}
              className={`btn sm ${activeSubView === "periodic" ? "primary" : "secondary"}`}
              style={{ fontWeight: 600, fontSize: "12px", borderRadius: "8px", padding: "6px 14px" }}
            >
              📅 تفکیک {breakdown === "daily" ? "روزانه" : breakdown === "weekly" ? "هفتگی" : "ماهانه"} ({periodicBreakdown.length} دوره)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView("operations")}
              className={`btn sm ${activeSubView === "operations" ? "primary" : "secondary"}`}
              style={{ fontWeight: 600, fontSize: "12px", borderRadius: "8px", padding: "6px 14px" }}
            >
              🔍 فهرست ریز مانورها ({filteredOperations.length} رکورد)
            </button>
          </div>

          <span style={{ fontSize: "11.5px", color: "var(--ink-soft)" }}>
            {isLoading ? "در حال دریافت اطلاعات..." : `تعداد رکوردهای مانور: ${operations.length}`}
          </span>
        </div>

        {/* ۴.۱. زیرنمای ۱: جدول عملکرد راهبران (ساده، دقیق و حرفه‌ای بدون ستون‌های زاید شیفت) */}
        {activeSubView === "matrix" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
            {/* نوار جستجو در جدول راهبران */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ position: "relative", minWidth: "240px", maxWidth: "340px", flex: 1 }}>
                <input
                  type="text"
                  className="input sm"
                  style={{
                    height: "32px",
                    fontSize: "12px",
                    paddingRight: "10px",
                    borderRadius: "6px",
                    width: "100%",
                  }}
                  placeholder="جستجو در نام یا کد پرسنلی راهبر..."
                  value={driverSearchQuery}
                  onChange={(e) => setDriverSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>مرتب‌سازی:</span>
                <button
                  type="button"
                  onClick={() => handleSortToggle("shunts")}
                  className={`btn sm ${sortField === "shunts" ? "primary" : "secondary"}`}
                  style={{ fontSize: "11px", padding: "3px 8px", height: "26px", borderRadius: "6px" }}
                >
                  تعداد مانور {sortField === "shunts" && (sortOrder === "desc" ? "↓" : "↑")}
                </button>
                <button
                  type="button"
                  onClick={() => handleSortToggle("solo")}
                  className={`btn sm ${sortField === "solo" ? "primary" : "secondary"}`}
                  style={{ fontSize: "11px", padding: "3px 8px", height: "26px", borderRadius: "6px" }}
                >
                  سولو {sortField === "solo" && (sortOrder === "desc" ? "↓" : "↑")}
                </button>
                <button
                  type="button"
                  onClick={() => handleSortToggle("percent")}
                  className={`btn sm ${sortField === "percent" ? "primary" : "secondary"}`}
                  style={{ fontSize: "11px", padding: "3px 8px", height: "26px", borderRadius: "6px" }}
                >
                  درصد {sortField === "percent" && (sortOrder === "desc" ? "↓" : "↑")}
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "12.5px", textAlign: "center" }}>
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th
                      style={{ textAlign: "right", cursor: "pointer" }}
                      onClick={() => handleSortToggle("name")}
                      title="مرتب‌سازی بر اساس نام"
                    >
                      نام و نام خانوادگی راهبر {sortField === "name" && (sortOrder === "desc" ? "↓" : "↑")}
                    </th>
                    <th>کد پرسنلی</th>
                    <th>شیفت سازمانی</th>
                    <th
                      style={{ fontWeight: "bold", cursor: "pointer", color: "var(--accent)" }}
                      onClick={() => handleSortToggle("shunts")}
                      title="مرتب‌سازی بر اساس تعداد مانور"
                    >
                      تعداد مانور {sortField === "shunts" && (sortOrder === "desc" ? "↓" : "↑")}
                    </th>
                    <th
                      style={{ color: "#ea580c", cursor: "pointer" }}
                      onClick={() => handleSortToggle("solo")}
                      title="مرتب‌سازی بر اساس سولو"
                    >
                      تک‌نفره (Solo) {sortField === "solo" && (sortOrder === "desc" ? "↓" : "↑")}
                    </th>
                    <th
                      style={{ color: "#10b981", cursor: "pointer" }}
                      onClick={() => handleSortToggle("assisted")}
                      title="مرتب‌سازی بر اساس کمکی"
                    >
                      با کمک‌راهبر {sortField === "assisted" && (sortOrder === "desc" ? "↓" : "↑")}
                    </th>
                    <th
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSortToggle("percent")}
                      title="مرتب‌سازی بر اساس سهم سولو"
                    >
                      سهم سولو (%) {sortField === "percent" && (sortOrder === "desc" ? "↓" : "↑")}
                    </th>
                    <th style={{ width: "90px" }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDriverSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "28px", color: "var(--ink-soft)" }}>
                        هیچ سابقه‌ای مطابق با فیلترهای انتخابی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredDriverSummaries.map((d, index) => {
                      const badgeStyle = getShiftBadgeClass(d.primaryShift);
                      return (
                        <tr key={d.driverId} style={{ transition: "background 0.15s ease" }}>
                          <td className="num muted" style={{ fontSize: "11px" }}>
                            {index + 1}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "50%",
                                  backgroundColor: badgeStyle.bg,
                                  color: badgeStyle.text,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "11px",
                                  fontWeight: "bold",
                                }}
                              >
                                {d.driverName.charAt(0)}
                              </div>
                              <span>{d.driverName}</span>
                              {d.isPartTimeDriver && (
                                <span
                                  className="pill"
                                  style={{
                                    fontSize: "10px",
                                    padding: "1px 6px",
                                    background: "rgba(245, 158, 11, 0.15)",
                                    color: "#d97706",
                                    border: "1px solid rgba(245, 158, 11, 0.35)",
                                    fontWeight: 600,
                                    borderRadius: "4px",
                                  }}
                                  title="راهبر غیردائم پایانه"
                                >
                                  غیردائم
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="num">{d.personnelCode}</td>
                          <td>
                            <span
                              className="pill"
                              style={{
                                background: badgeStyle.bg,
                                color: badgeStyle.text,
                                border: `1px solid ${badgeStyle.border}`,
                                fontSize: "11px",
                                fontWeight: "bold",
                              }}
                            >
                              {getShiftLabel(d.primaryShift)}
                            </span>
                          </td>
                          <td className="num" style={{ fontWeight: "bold", fontSize: "14px", color: "var(--ink)" }}>
                            {d.totalShunts.toLocaleString("fa-IR")}
                          </td>
                          <td className="num" style={{ fontWeight: "bold", color: "#ea580c" }}>
                            {d.soloShunts.toLocaleString("fa-IR")}
                          </td>
                          <td className="num" style={{ color: "#10b981", fontWeight: 500 }}>
                            {d.assistedShunts.toLocaleString("fa-IR")}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              <div
                                style={{
                                  width: "50px",
                                  height: "5px",
                                  backgroundColor: "var(--line)",
                                  borderRadius: "3px",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${d.soloPercentage}%`,
                                    height: "100%",
                                    backgroundColor:
                                      d.soloPercentage >= 80
                                        ? "#ea580c"
                                        : d.soloPercentage >= 50
                                        ? "#f59e0b"
                                        : "#10b981",
                                    borderRadius: "3px",
                                  }}
                                />
                              </div>
                              <span
                                className={`pill ${
                                  d.soloPercentage >= 80
                                    ? "p-crit"
                                    : d.soloPercentage >= 40
                                    ? "p-warn"
                                    : "p-good"
                                }`}
                                style={{ fontSize: "11px", minWidth: "40px" }}
                              >
                                {d.soloPercentage}٪
                              </span>
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDriverId(d.driverId);
                                setActiveSubView("operations");
                              }}
                              className="btn sm secondary"
                              style={{ fontSize: "11px", padding: "2px 8px", height: "24px", borderRadius: "5px" }}
                              title="مشاهده ریز مانورهای این راهبر"
                            >
                              ریز مانورها
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {filteredDriverSummaries.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "var(--panel-2)", fontWeight: "bold" }}>
                      <td colSpan={4} style={{ textAlign: "right", padding: "10px 14px" }}>
                        مجموع عملکرد راهبران:
                      </td>
                      <td className="num" style={{ fontSize: "14px", color: "var(--ink)" }}>
                        {filteredDriverSummaries.reduce((acc, c) => acc + c.totalShunts, 0).toLocaleString("fa-IR")}
                      </td>
                      <td className="num" style={{ color: "#ea580c" }}>
                        {filteredDriverSummaries.reduce((acc, c) => acc + c.soloShunts, 0).toLocaleString("fa-IR")}
                      </td>
                      <td className="num" style={{ color: "#10b981" }}>
                        {filteredDriverSummaries.reduce((acc, c) => acc + c.assistedShunts, 0).toLocaleString("fa-IR")}
                      </td>
                      <td>
                        <span className="pill p-mut">
                          {reportData.soloPercentage}٪
                        </span>
                      </td>
                      <td>—</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ۴.۲. زیرنمای ۲: جدول تفکیک دوره‌ای (روزانه / هفتگی / ماهانه) */}
        {activeSubView === "periodic" && (
          <div style={{ overflowX: "auto", marginTop: "14px" }}>
            <table className="table" style={{ width: "100%", fontSize: "12.5px", textAlign: "center" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "right" }}>
                    دوره زمانی ({breakdown === "daily" ? "روزانه" : breakdown === "weekly" ? "هفتگی" : "ماهانه"})
                  </th>
                  <th style={{ fontWeight: "bold" }}>تعداد مانور</th>
                  <th style={{ color: "#ea580c" }}>مانورهای تک‌نفره (Solo)</th>
                  <th style={{ color: "#10b981" }}>مانور با کمک‌راهبر</th>
                  <th>سهم سولو (%)</th>
                  <th style={{ textAlign: "right", width: "200px" }}>نسبت بصری عملیات</th>
                </tr>
              </thead>
              <tbody>
                {periodicBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "28px", color: "var(--ink-soft)" }}>
                      هیچ داده‌ای در بازه زمانی تعیین‌شده یافت نشد.
                    </td>
                  </tr>
                ) : (
                  periodicBreakdown.map((p) => {
                    const soloPct = p.total > 0 ? Math.round((p.solo / p.total) * 100) : 0;
                    return (
                      <tr key={p.periodKey}>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{p.periodLabel}</td>
                        <td className="num" style={{ fontWeight: "bold", fontSize: "14px", color: "var(--ink)" }}>
                          {p.total.toLocaleString("fa-IR")}
                        </td>
                        <td className="num" style={{ color: "#ea580c", fontWeight: 600 }}>
                          {p.solo.toLocaleString("fa-IR")}
                        </td>
                        <td className="num" style={{ color: "#10b981" }}>
                          {p.assisted.toLocaleString("fa-IR")}
                        </td>
                        <td>
                          <span
                            className={`pill ${
                              soloPct >= 80 ? "p-crit" : soloPct >= 40 ? "p-warn" : "p-good"
                            }`}
                            style={{ fontSize: "11px" }}
                          >
                            {soloPct}٪
                          </span>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              width: "100%",
                              height: "8px",
                              borderRadius: "4px",
                              overflow: "hidden",
                              backgroundColor: "var(--line)",
                            }}
                          >
                            <div
                              style={{
                                width: `${soloPct}%`,
                                backgroundColor: "#ea580c",
                              }}
                              title={`سولو: ${p.solo}`}
                            />
                            <div
                              style={{
                                width: `${100 - soloPct}%`,
                                backgroundColor: "#10b981",
                              }}
                              title={`کمکی: ${p.assisted}`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {periodicBreakdown.length > 0 && (
                <tfoot>
                  <tr style={{ background: "var(--panel-2)", fontWeight: "bold" }}>
                    <td style={{ textAlign: "right", padding: "10px 14px" }}>جمع کل دوره‌ها:</td>
                    <td className="num" style={{ fontSize: "14px" }}>
                      {periodicBreakdown.reduce((acc, c) => acc + c.total, 0).toLocaleString("fa-IR")}
                    </td>
                    <td className="num" style={{ color: "#ea580c" }}>
                      {periodicBreakdown.reduce((acc, c) => acc + c.solo, 0).toLocaleString("fa-IR")}
                    </td>
                    <td className="num" style={{ color: "#10b981" }}>
                      {periodicBreakdown.reduce((acc, c) => acc + c.assisted, 0).toLocaleString("fa-IR")}
                    </td>
                    <td>
                      <span className="pill p-mut">{reportData.soloPercentage}٪</span>
                    </td>
                    <td>—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* ۴.۳. زیرنمای ۳: فهرست ریز مانورهای استخراج‌شده */}
        {activeSubView === "operations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
            {/* نوار جستجو و فیلتر خدمه */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ position: "relative", minWidth: "240px", maxWidth: "340px", flex: 1 }}>
                <input
                  type="text"
                  className="input sm"
                  style={{
                    height: "32px",
                    fontSize: "12px",
                    paddingRight: "10px",
                    borderRadius: "6px",
                    width: "100%",
                  }}
                  placeholder="جستجو در قطار، خط، راهبر، کد مانور..."
                  value={opsSearchQuery}
                  onChange={(e) => setOpsSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>نوع خدمه:</span>
                <button
                  type="button"
                  onClick={() => setOpsCrewFilter("all")}
                  className={`btn sm ${opsCrewFilter === "all" ? "primary" : "secondary"}`}
                  style={{ fontSize: "11px", padding: "3px 8px", height: "26px", borderRadius: "6px" }}
                >
                  همه ({operations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOpsCrewFilter("solo")}
                  className={`btn sm ${opsCrewFilter === "solo" ? "primary" : "secondary"}`}
                  style={{ fontSize: "11px", padding: "3px 8px", height: "26px", borderRadius: "6px" }}
                >
                  فقط سولو ({reportData.soloOperations})
                </button>
                <button
                  type="button"
                  onClick={() => setOpsCrewFilter("assisted")}
                  className={`btn sm ${opsCrewFilter === "assisted" ? "primary" : "secondary"}`}
                  style={{ fontSize: "11px", padding: "3px 8px", height: "26px", borderRadius: "6px" }}
                >
                  با کمک‌راهبر ({reportData.assistedOperations})
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", fontSize: "12.5px", textAlign: "center" }}>
                <thead>
                  <tr>
                    <th>کد مانور</th>
                    <th>نوع مانور</th>
                    <th>قطار</th>
                    <th>مسیر (مبدأ ← مقصد)</th>
                    <th style={{ textAlign: "right" }}>راهبر اصلی</th>
                    <th style={{ textAlign: "right" }}>کمک‌راهبر</th>
                    <th>نحوه خدمه</th>
                    <th>شیفت</th>
                    <th>زمان اجرا</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOperations.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "28px", color: "var(--ink-soft)" }}>
                        هیچ مانوری مطابق با فیلترها یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredOperations.map((op) => {
                      const isSolo = Boolean(op.rahbar1Id && !op.rahbar2Id);
                      return (
                        <tr key={op.id}>
                          <td className="num" style={{ fontWeight: "bold" }}>
                            {op.id}
                          </td>
                          <td>{getManovrTypeLabel(op.type)}</td>
                          <td className="num">{op.train?.code || "—"}</td>
                          <td>
                            <span className="muted">{op.sourceLine?.name || "—"}</span>
                            {" ← "}
                            <b>{op.destinationLine?.name || "—"}</b>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            {op.rahbar1 ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <span>{`${op.rahbar1.firstName} ${op.rahbar1.lastName}`}</span>
                                {op.rahbar1.isPartTimeDriver && (
                                  <span
                                    className="pill"
                                    style={{
                                      fontSize: "10px",
                                      padding: "1px 5px",
                                      background: "rgba(245, 158, 11, 0.15)",
                                      color: "#d97706",
                                      border: "1px solid rgba(245, 158, 11, 0.35)",
                                      fontWeight: 600,
                                    }}
                                    title="راهبر غیردائم پایانه"
                                  >
                                    غیردائم
                                  </span>
                                )}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {op.rahbar2 ? (
                              `${op.rahbar2.firstName} ${op.rahbar2.lastName}`
                            ) : (
                              <span className="muted">بدون کمکی</span>
                            )}
                          </td>
                          <td>
                            {isSolo ? (
                              <span
                                className="pill"
                                style={{
                                  background: "rgba(234, 88, 12, 0.15)",
                                  color: "#ea580c",
                                  border: "1px solid rgba(234, 88, 12, 0.4)",
                                  fontWeight: 600,
                                }}
                              >
                                تک‌نفره (Solo)
                              </span>
                            ) : (
                              <span className="pill p-good">با کمک‌راهبر</span>
                            )}
                          </td>
                          <td>
                            <span className="pill p-mut">
                              {op.rahbar1?.shift ? getShiftLabel(op.rahbar1.shift) : "—"}
                            </span>
                          </td>
                          <td className="num" style={{ fontWeight: 600 }}>
                            {op.executionTime
                              ? new Intl.DateTimeFormat("fa-IR", {
                                  timeZone: "Asia/Tehran",
                                  calendar: "persian",
                                  dateStyle: "short",
                                  timeStyle: "short",
                                }).format(new Date(op.executionTime))
                              : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
