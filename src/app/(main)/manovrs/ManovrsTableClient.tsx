"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import ManovrRowActions from "./ManovrRowActions";
import DriverShuntingReportsView from "./components/DriverShuntingReportsView";
import TrainPerformanceView from "./TrainPerformanceView";
import { ManovrType, ManovrStatus, ConfirmationStatus } from "@/lib/enums";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { toast } from "@/components/ui/Toast";
import type { ListParams } from "@/lib/list-query";

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

interface TrainItem {
  id: number;
  code: string;
  type?: number;
  status?: number;
}

interface ManovrsTableClientProps {
  manovrs: any[];
  totalRows: number;
  params: ListParams;
  canEdit: boolean;
  canConfirm: boolean;
  canDelete: boolean;
  isAdmin?: boolean;
  manovrTypes?: LookupValue[];
  manovrStatuses?: LookupValue[];
  confirmationStatuses?: LookupValue[];
  shifts?: LookupValue[];
  drivers?: DriverItem[];
  trains?: TrainItem[];
}

function fmt(d: string | Date) {
  const dateObj = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    calendar: "persian",
    dateStyle: "short",
    timeStyle: "short",
  }).format(dateObj);
}

export default function ManovrsTableClient({
  manovrs,
  totalRows,
  params,
  canEdit,
  canConfirm,
  canDelete,
  isAdmin = false,
  manovrTypes,
  manovrStatuses,
  confirmationStatuses,
  shifts = [],
  drivers = [],
  trains = [],
}: ManovrsTableClientProps) {

  useLiveRefresh(["manovr_changed"]);
  const router = useRouter();
  const searchParams = useSearchParams();

  // تب فعال: فهرست تاریخچه مانورها، گزارش عملکرد راهبران یا کارنامه عملکرد قطارها
  const [activeTab, setActiveTab] = useState<"history" | "driver_reports" | "train_reports">(() => {
    const t = searchParams.get("tab");
    if (t === "driver_reports" || t === "train_reports") return t;
    return "history";
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // وضعیت فیلترها از URL مقداردهی می‌شوند
  const [filterTrainCode, setFilterTrainCode] = useState(searchParams.get("trainCode") || "");
  const [filterType, setFilterType] = useState(searchParams.get("typeFilter") || "");
  const [filterSourceLine, setFilterSourceLine] = useState(searchParams.get("srcLine") || "");
  const [filterDestLine, setFilterDestLine] = useState(searchParams.get("destLine") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("statusFilter") || "");
  const [filterConfirmation, setFilterConfirmation] = useState(searchParams.get("confFilter") || "");
  const [filterRahbar, setFilterRahbar] = useState(searchParams.get("rahbarFilter") || "");
  const [filterCreator, setFilterCreator] = useState(searchParams.get("creatorFilter") || "");

  const updateUrl = (newParams: Record<string, string | number | null | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") {
        sp.delete(k);
      } else {
        sp.set(k, String(v));
      }
    });
    router.push(`/manovrs?${sp.toString()}`);
  };

  // اعمال فیلترهای متنی به صورت Debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterTrainCode !== (searchParams.get("trainCode") || "")) {
        updateUrl({ trainCode: filterTrainCode, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filterTrainCode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterSourceLine !== (searchParams.get("srcLine") || "")) {
        updateUrl({ srcLine: filterSourceLine, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filterSourceLine]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterDestLine !== (searchParams.get("destLine") || "")) {
        updateUrl({ destLine: filterDestLine, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filterDestLine]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterRahbar !== (searchParams.get("rahbarFilter") || "")) {
        updateUrl({ rahbarFilter: filterRahbar, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filterRahbar]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterCreator !== (searchParams.get("creatorFilter") || "")) {
        updateUrl({ creatorFilter: filterCreator, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filterCreator]);

  const handleClearFilters = () => {
    setFilterTrainCode("");
    setFilterType("");
    setFilterSourceLine("");
    setFilterDestLine("");
    setFilterStatus("");
    setFilterConfirmation("");
    setFilterRahbar("");
    setFilterCreator("");
    router.push("/manovrs");
  };

  const statusPill = (s: number) =>
    s === 1 ? "p-warn" : s === 2 ? "p-good" : "p-crit";
  const confPill = (c: number) =>
    c === 1 ? "p-rail" : c === 2 ? "p-crit" : "p-mut";

  const getManovrTypeLabel = (code: number) => {
    return manovrTypes?.find((v) => v.code === code)?.label || ManovrType[code] || `مانور نوع ${code}`;
  };

  const getManovrStatusLabel = (code: number) => {
    return manovrStatuses?.find((v) => v.code === code)?.label || ManovrStatus[code] || `وضعیت ${code}`;
  };

  const getConfirmationStatusLabel = (code: number) => {
    return confirmationStatuses?.find((v) => v.code === code)?.label || ConfirmationStatus[code] || `نامشخص`;
  };

  const getShiftLabel = (shiftCode: number) => {
    const found = shifts.find((s) => s.code === shiftCode);
    if (found) return `شیفت ${found.label}`;
    if (shiftCode === 1) return "شیفت A";
    if (shiftCode === 2) return "شیفت B";
    if (shiftCode === 3) return "شیفت C";
    if (shiftCode === 4) return "شیفت D";
    return `شیفت ${shiftCode}`;
  };

  // تابع صدور اکسل برای ردیف‌های انتخاب‌شده یا کل جدول در دسترس
  const handleExportExcel = async (itemsToExport?: any[], filename?: string) => {
    const data = itemsToExport && itemsToExport.length > 0 ? itemsToExport : manovrs;
    if (!data || data.length === 0) {
      toast.warning("رکوردی برای صدور اکسل وجود ندارد.");
      return;
    }

    setIsExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("تاریخچه مانورها");
      worksheet.views = [{ rtl: true } as any];

      worksheet.columns = [
        { header: "کد مانور", key: "id", width: 12 },
        { header: "نوع مانور", key: "type", width: 22 },
        { header: "شماره قطار", key: "train", width: 14 },
        { header: "ریل مبدأ", key: "sourceLine", width: 18 },
        { header: "ریل مقصد", key: "destLine", width: 18 },
        { header: "راهبر اصلی (راهبر ۱)", key: "rahbar1", width: 22 },
        { header: "کمک‌راهبر (راهبر ۲)", key: "rahbar2", width: 22 },
        { header: "نحوه خدمه", key: "crewType", width: 18 },
        { header: "شیفت راهبر", key: "shift", width: 14 },
        { header: "کاربر ثبت‌کننده", key: "creator", width: 20 },
        { header: "زمان اجرای واقعی", key: "executionTime", width: 20 },
        { header: "زمان ثبت سند", key: "createdAt", width: 20 },
        { header: "وضعیت اجرا", key: "status", width: 16 },
        { header: "وضعیت تأییدیه", key: "confirmation", width: 16 },
        { header: "توضیحات", key: "description", width: 30 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1F3A5F" },
        };
        cell.font = {
          name: "Tahoma",
          bold: true,
          color: { argb: "FFFFFFFF" },
          size: 10.5,
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      data.forEach((m) => {
        const isSolo = Boolean(m.rahbar1Id && !m.rahbar2Id);
        worksheet.addRow({
          id: m.id,
          type: getManovrTypeLabel(m.type),
          train: m.train?.code || "—",
          sourceLine: m.sourceLine?.name || "—",
          destLine: m.destinationLine?.name || "—",
          rahbar1: m.rahbar1 ? `${m.rahbar1.firstName} ${m.rahbar1.lastName}`.trim() : "—",
          rahbar2: m.rahbar2 ? `${m.rahbar2.firstName} ${m.rahbar2.lastName}`.trim() : "—",
          crewType: isSolo ? "تک‌نفره (Solo)" : m.rahbar2 ? "با کمک‌راهبر" : "نامشخص",
          shift: m.rahbar1?.shift ? getShiftLabel(m.rahbar1.shift) : "—",
          creator: m.creator ? `${m.creator.firstName} ${m.creator.lastName}`.trim() : "سیستم",
          executionTime: m.executionTime ? fmt(m.executionTime) : "—",
          createdAt: m.createdAt ? fmt(m.createdAt) : "—",
          status: getManovrStatusLabel(m.status),
          confirmation: getConfirmationStatusLabel(m.confirmationStatus),
          description: m.description || "",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `manovrs-history-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`خروجی اکسل ${data.length} رکورد با موفقیت دریافت شد.`);
    } catch (err) {
      console.error(err);
      toast.error("خطا در صدور فایل اکسل تاریخچه مانورها.");
    } finally {
      setIsExporting(false);
    }
  };

  const columns = [
    { key: "id", label: "کد مانور", sortable: true, render: (m: any) => <span className="num">{m.id}</span> },
    { key: "type", label: "نوع مانور", sortable: true, render: (m: any) => getManovrTypeLabel(m.type) },
    {
      key: "route",
      label: "مسیر (مبدأ ← مقصد)",
      render: (m: any) => (
        <span>
          <span className="muted">{m.sourceLine?.name ?? "—"}</span>
          {" ← "}
          <b>{m.destinationLine?.name ?? "—"}</b>
        </span>
      ),
    },
    { key: "train", label: "قطار", sortable: false, render: (m: any) => <span className="num">{m.train?.code ?? "—"}</span> },
    {
      key: "rahbar",
      label: "راهبر ۱",
      sortable: false,
      render: (m: any) => {
        if (!m.rahbar1) return "—";
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span>{`${m.rahbar1.firstName} ${m.rahbar1.lastName}`}</span>
            {m.rahbar1.isPartTimeDriver && (
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
        );
      },
    },
    {
      key: "crew",
      label: "نحوه خدمه",
      sortable: false,
      render: (m: any) => {
        const isSolo = Boolean(m.rahbar1Id && !m.rahbar2Id);
        return isSolo ? (
          <span
            className="pill"
            style={{
              background: "rgba(234, 88, 12, 0.15)",
              color: "#ea580c",
              border: "1px solid rgba(234, 88, 12, 0.35)",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            تک‌نفره (Solo)
          </span>
        ) : m.rahbar2 ? (
          <span
            className="pill"
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              fontSize: "11px",
            }}
            title={`کمک‌راهبر: ${m.rahbar2.firstName} ${m.rahbar2.lastName}`}
          >
            با کمکی ({m.rahbar2.firstName})
          </span>
        ) : (
          <span className="muted">—</span>
        );
      },
    },
    {
      key: "creator",
      label: "کاربر ثبت‌کننده",
      sortable: false,
      render: (m: any) => (m.creator ? `${m.creator.firstName} ${m.creator.lastName}` : "سیستم"),
    },
    {
      key: "executionTime",
      label: "زمان اجرا",
      sortable: true,
      render: (m: any) => (
        <span className="num" style={{ fontWeight: "bold" }}>
          {fmt(m.executionTime || m.createdAt)}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "زمان ثبت سند",
      sortable: true,
      render: (m: any) => <span className="num muted">{fmt(m.createdAt)}</span>,
    },
    {
      key: "status",
      label: "وضعیت اجرا",
      sortable: true,
      render: (m: any) => (
        <span className={`pill ${statusPill(m.status)}`}>
          {getManovrStatusLabel(m.status)}
        </span>
      ),
    },
    {
      key: "confirmation",
      label: "تأییدیه",
      sortable: true,
      render: (m: any) => (
        <span className={`pill ${confPill(m.confirmationStatus)}`}>
          {getConfirmationStatusLabel(m.confirmationStatus)}
        </span>
      ),
    },
    ...((canEdit || canConfirm || canDelete)
      ? [
          {
            key: "actions",
            label: "عملیات",
            render: (m: any) => (
              <ManovrRowActions
                id={m.id}
                status={m.status}
                confirmation={m.confirmationStatus}
                canEdit={canEdit}
                canConfirm={canConfirm}
                canDelete={canDelete}
                isAdmin={isAdmin}
              />

            ),
          },
        ]
      : []),
  ];

  const hasAnyFilter =
    filterTrainCode ||
    filterType ||
    filterSourceLine ||
    filterDestLine ||
    filterStatus ||
    filterConfirmation ||
    filterRahbar ||
    filterCreator ||
    params.search;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* سوییچر تب‌های ماژول مانور */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "6px 8px",
          flexWrap: "wrap",
          gap: "8px",
          boxShadow: "0 2px 10px -3px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              updateUrl({ tab: "history" });
            }}
            className={`btn ${activeTab === "history" ? "primary" : "secondary"}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
              borderRadius: "8px",
              padding: "7px 16px",
              fontSize: "12.5px",
              boxShadow: activeTab === "history" ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
            }}
          >
            <span>📋 فهرست و تاریخچه مانورها</span>
            <span
              className="pill"
              style={{
                fontSize: "11px",
                background: activeTab === "history" ? "rgba(255,255,255,0.2)" : "var(--panel-2)",
                color: activeTab === "history" ? "#fff" : "var(--ink)",
              }}
            >
              {totalRows}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("driver_reports");
              updateUrl({ tab: "driver_reports" });
            }}
            className={`btn ${activeTab === "driver_reports" ? "primary" : "secondary"}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
              borderRadius: "8px",
              padding: "7px 16px",
              fontSize: "12.5px",
              boxShadow: activeTab === "driver_reports" ? "0 2px 8px rgba(234,88,12,0.3)" : "none",
            }}
          >
            <span>📊 گزارش شیفت راهبران</span>
            <span
              className="pill"
              style={{
                background: activeTab === "driver_reports" ? "#ea580c" : "rgba(234, 88, 12, 0.15)",
                color: activeTab === "driver_reports" ? "#fff" : "#ea580c",
                border: "1px solid rgba(234, 88, 12, 0.35)",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              راهبران
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("train_reports");
              updateUrl({ tab: "train_reports" });
            }}
            className={`btn ${activeTab === "train_reports" ? "primary" : "secondary"}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
              borderRadius: "8px",
              padding: "7px 16px",
              fontSize: "12.5px",
              boxShadow: activeTab === "train_reports" ? "0 2px 8px rgba(16,185,129,0.3)" : "none",
            }}
          >
            <span>🚦 گزارش عملکرد قطارها</span>
            <span
              className="pill"
              style={{
                background: activeTab === "train_reports" ? "#059669" : "rgba(16, 185, 129, 0.15)",
                color: activeTab === "train_reports" ? "#fff" : "#059669",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              کارنامه ناوگان
            </span>
          </button>
        </div>

        {activeTab === "history" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => handleExportExcel()}
              disabled={isExporting}
              className="btn sm primary"
              style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, borderRadius: "6px" }}
            >
              <span>{isExporting ? "⏳ در حال ساخت اکسل..." : "📥 خروجی اکسل جدول"}</span>
            </button>
          </div>
        )}
      </div>

      {/* نمایش بر اساس تب فعال */}
      {activeTab === "train_reports" ? (
        <TrainPerformanceView
          trains={trains}
          initialTrainCode={filterTrainCode}
        />
      ) : activeTab === "driver_reports" ? (
        <DriverShuntingReportsView
          drivers={drivers}
          shifts={shifts}
          manovrTypes={manovrTypes}
        />
      ) : (
        <div className="card" style={{ padding: "16px" }}>
          <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
            <h2>فهرست مانورهای پایانه</h2>
            <span className="spacer" />
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {/* دکمه خروجی اکسل جدول جاری */}
              <button
                type="button"
                onClick={() => handleExportExcel()}
                disabled={isExporting}
                className="btn sm primary"
                style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
              >
                <span>{isExporting ? "⏳ در حال ساخت اکسل..." : "📥 خروجی اکسل جدول"}</span>
              </button>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn sm ${hasAnyFilter ? "primary" : "secondary"}`}
                style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold" }}
              >
                <span>🔍 فیلترهای پیشرفته</span>
                {hasAnyFilter && (
                  <span className="pill p-warn" style={{ padding: "1px 6px", fontSize: "10px" }}>فعال</span>
                )}
              </button>
              <span className="pill p-mut">{totalRows} رکورد</span>
            </div>
          </div>

          {showFilters && (
            <div
              style={{
                padding: "16px 12px",
                backgroundColor: "var(--panel-2)",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "10px",
                }}
              >
                {/* ۱. کد قطار */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>شماره قطار</span>
                  <input
                    type="text"
                    className="input sm"
                    style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                    value={filterTrainCode}
                    onChange={(e) => setFilterTrainCode(e.target.value)}
                    placeholder="مثال: 103"
                  />
                </div>

                {/* ۲. نوع مانور */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>نوع مانور</span>
                  <select
                    className="input sm"
                    style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                    value={filterType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilterType(val);
                      updateUrl({ typeFilter: val, page: 1 });
                    }}
                  >
                    <option value="">همه انواع</option>
                    {manovrTypes?.map((t) => (
                      <option key={t.code} value={t.code}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* ۳. ریل مبدأ */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>خط ریل مبدأ</span>
                  <input
                    type="text"
                    className="input sm"
                    style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                    value={filterSourceLine}
                    onChange={(e) => setFilterSourceLine(e.target.value)}
                    placeholder="مثال: پارکینگ شمالی 1"
                  />
                </div>

                {/* ۴. ریل مقصد */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>خط ریل مقصد</span>
                  <input
                    type="text"
                    className="input sm"
                    style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                    value={filterDestLine}
                    onChange={(e) => setFilterDestLine(e.target.value)}
                    placeholder="مثال: خط اصلی"
                  />
                </div>

                {/* ۵. وضعیت اجرا */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>وضعیت اجرا</span>
                  <select
                    className="input sm"
                    style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                    value={filterStatus}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilterStatus(val);
                      updateUrl({ statusFilter: val, page: 1 });
                    }}
                  >
                    <option value="">همه وضعیت‌ها</option>
                    {manovrStatuses?.map((s) => (
                      <option key={s.code} value={s.code}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* ۶. وضعیت تأییدیه */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>تأییدیه</span>
                  <select
                    className="input sm"
                    style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                    value={filterConfirmation}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilterConfirmation(val);
                      updateUrl({ confFilter: val, page: 1 });
                    }}
                  >
                    <option value="">همه تأییدیه‌ها</option>
                    {confirmationStatuses?.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* ۷. راهبر مسئول */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>راهبر مسئول</span>
                  <input
                    type="text"
                    className="input sm"
                    style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                    value={filterRahbar}
                    onChange={(e) => setFilterRahbar(e.target.value)}
                    placeholder="مثال: علی"
                  />
                </div>

                {/* ۸. کاربر ثبت‌کننده */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>کاربر ثبت‌کننده</span>
                  <input
                    type="text"
                    className="input sm"
                    style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                    value={filterCreator}
                    onChange={(e) => setFilterCreator(e.target.value)}
                    placeholder="مثال: محمد"
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
                  تعداد نتایج یافت‌شده: <b>{totalRows}</b> رکورد
                </span>
                {hasAnyFilter && (
                  <button
                    className="btn sm danger"
                    onClick={handleClearFilters}
                    style={{ padding: "4px 10px", height: "28px", fontSize: "11px" }}
                  >
                    🧹 پاک کردن فیلترها
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: "14px" }}>
            <DataTable
              tableName="manovrs"
              columns={columns}
              data={manovrs}
              searchPlaceholder="جستجو بر اساس قطار یا توضیحات..."
              searchFields={["id"]}
              enableSelection={true}
              bulkActions={[
                {
                  key: "exportSelected",
                  label: "خروجی اکسل ردیف‌های انتخاب‌شده",
                  variant: "accent",
                  onClick: (selectedItems) =>
                    handleExportExcel(selectedItems, `manovrs-selected-${Date.now()}.xlsx`),
                },
              ]}
              server={{
                page: params.page,
                pageSize: params.pageSize,
                totalRows,
                onPageChange: (p) => updateUrl({ page: p }),
                onPageSizeChange: (ps) => updateUrl({ pageSize: ps, page: 1 }),
                search: params.search,
                onSearchChange: (s) => updateUrl({ search: s, page: 1 }),
                sortCol: params.sortField,
                sortDir: params.sortDir,
                onSortChange: (col, dir) => updateUrl({ sort: col, dir }),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
