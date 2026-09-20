"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import DataTable from "@/components/DataTable";
import {
  getDiagnosticLogsAction,
  getAdminReportAction,
  downloadDiagnosticLogFileAction,
} from "@/app/actions/logs";
import type { DiagnosticLogEntry, LogLevel, LogCategory } from "@/lib/logger";
import { toast } from "@/components/ui/Toast";

interface AuditLog {
  id: number;
  actorId: number | null;
  actorName: string;
  entity: string;
  entityId: number;
  action: string;
  changes: string;
  summary: string;
  createdAt: string;
}

interface AuditLogsClientProps {
  initialLogs: AuditLog[];
}

export default function AuditLogsClient({ initialLogs }: AuditLogsClientProps) {
  // تب فعال: ردپای ممیزی اطلاعات یا لاگ‌های تشخیصی سیستم
  const [activeTab, setActiveTab] = useState<"audit_trail" | "system_diagnostics">("audit_trail");

  // وضعیت‌های تب ردپای ممیزی
  const [logs] = useState<AuditLog[]>(initialLogs);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // وضعیت‌های تب لاگ‌های تشخیصی
  const [diagLogs, setDiagLogs] = useState<DiagnosticLogEntry[]>([]);
  const [diagLoading, setDiagLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<LogLevel | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<LogCategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // واکشی لاگ‌های تشخیصی
  const fetchDiagnosticLogs = useCallback(async () => {
    setDiagLoading(true);
    try {
      const res = await getDiagnosticLogsAction({
        limit: 150,
        level: levelFilter === "ALL" ? undefined : levelFilter,
        category: categoryFilter === "ALL" ? undefined : categoryFilter,
        search: searchQuery,
      });
      setDiagLogs(res);
    } catch {
      toast.error("دریافت لاگ‌های تشخیصی سیستم با خطا مواجه شد.");
    } finally {
      setDiagLoading(false);
    }
  }, [levelFilter, categoryFilter, searchQuery]);

  // لود لاگ‌های تشخیصی هنگام سوییچ به تب دوم
  useEffect(() => {
    if (activeTab === "system_diagnostics") {
      fetchDiagnosticLogs();
    }
  }, [activeTab, fetchDiagnosticLogs]);

  // کپی یک‌کلیکی گزارش Markdown برای ادمین
  const handleCopyAdminReport = async () => {
    setIsCopying(true);
    try {
      const report = await getAdminReportAction();
      await navigator.clipboard.writeText(report);
      toast.success("گزارش جامع وضعیت و خطاهای سیستم در کلیپ‌بورد کپی شد.");
    } catch {
      toast.error("امکان دسترسی به کلیپ‌بورد فراهم نشد.");
    } finally {
      setIsCopying(false);
    }
  };

  // دانلود فایل متنی لاگ دیسک
  const handleDownloadLogFile = async () => {
    setIsDownloading(true);
    try {
      const { content, filename } = await downloadDiagnosticLogFileAction();
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `manovr-diagnostics-${Date.now()}.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("فایل متنی لاگ‌های تشخیصی دریافت گردید.");
    } catch {
      toast.error("دریافت فایل لاگ سیستم امکان‌پذیر نبود.");
    } finally {
      setIsDownloading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE": return "#10b981"; // green
      case "UPDATE": return "#3b82f6"; // blue
      case "DELETE": return "var(--crit)"; // red
      case "CONFIRM": return "var(--accent)"; // gold
      default: return "var(--ink-soft)";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "CREATE": return "ایجاد";
      case "UPDATE": return "ویرایش";
      case "DELETE": return "حذف";
      case "CONFIRM": return "تأییدیه";
      default: return action;
    }
  };

  // ستون‌های جدول ردپای ممیزی اطلاعات
  const columns = [
    { key: "id", label: "کد لاگ", sortable: true, render: (r: any) => <span className="num">{r.id}</span> },
    { key: "actorName", label: "کاربر عامل", sortable: true, render: (r: any) => <b>{r.actorName}</b> },
    { key: "entity", label: "موجودیت", sortable: true, render: (r: any) => <code className="num">{r.entity}</code> },
    { key: "entityId", label: "شناسه رکورد", sortable: true, render: (r: any) => <span className="num">{r.entityId}</span> },
    {
      key: "action",
      label: "نوع اقدام",
      sortable: true,
      render: (r: any) => (
        <span 
          style={{ 
            fontSize: "11px", 
            padding: "2px 8px", 
            borderRadius: "6px", 
            backgroundColor: getActionColor(r.action) + "18", 
            color: getActionColor(r.action),
            fontWeight: "bold"
          }}
        >
          {getActionLabel(r.action)}
        </span>
      ),
    },
    { key: "summary", label: "شرح عملیات", render: (r: any) => <span>{r.summary}</span> },
    {
      key: "createdAt",
      label: "زمان ثبت",
      sortable: true,
      render: (r: any) => (
        <span className="num muted" style={{ fontSize: "12px" }}>
          {new Date(r.createdAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", calendar: "persian" })}
        </span>
      ),
    },
    {
      key: "details",
      label: "جزئیات تغییرات",
      render: (r: any) => (
        <button 
          onClick={() => setSelectedLog(r)} 
          className="btn sm outline"
          style={{ fontSize: "11px", padding: "4px 8px" }}
        >
          🔍 مشاهده جزئیات فیلدی
        </button>
      ),
    },
  ];

  // آمار خلاصه لاگ‌های تشخیصی
  const diagSummary = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    let infoCount = 0;
    diagLogs.forEach((l) => {
      if (l.level === "ERROR") errorCount++;
      else if (l.level === "WARN") warnCount++;
      else if (l.level === "INFO") infoCount++;
    });
    return { errorCount, warnCount, infoCount, total: diagLogs.length };
  }, [diagLogs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} dir="rtl">
      {/* هدر سوییچر دو زبانه */}
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
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("audit_trail")}
            className={`btn ${activeTab === "audit_trail" ? "primary" : "secondary"}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
              borderRadius: "8px",
              padding: "7px 16px",
              fontSize: "12.5px",
            }}
          >
            <span>📜 ردپای ممیزی اطلاعات (Audit Trail)</span>
            <span
              className="pill"
              style={{
                fontSize: "11px",
                background: activeTab === "audit_trail" ? "rgba(255,255,255,0.2)" : "var(--panel-2)",
                color: activeTab === "audit_trail" ? "#fff" : "var(--ink)",
              }}
            >
              {logs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("system_diagnostics")}
            className={`btn ${activeTab === "system_diagnostics" ? "primary" : "secondary"}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 600,
              borderRadius: "8px",
              padding: "7px 16px",
              fontSize: "12.5px",
            }}
          >
            <span>🩺 لاگ‌های تشخیصی و خطاهای سیستم</span>
            <span
              className="pill"
              style={{
                background: activeTab === "system_diagnostics" ? "#ef4444" : "rgba(239, 68, 68, 0.15)",
                color: activeTab === "system_diagnostics" ? "#fff" : "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              عیب‌یابی دیسک
            </span>
          </button>
        </div>

        {/* دکمه‌های عملیاتی ادمین در تب عیب‌یابی */}
        {activeTab === "system_diagnostics" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleCopyAdminReport}
              disabled={isCopying}
              className="btn sm"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "var(--accent)",
                color: "#fff",
                fontWeight: 600,
                borderRadius: "6px",
              }}
            >
              <span>{isCopying ? "در حال آماده‌سازی..." : "📋 کپی گزارش خطا برای ادمین"}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadLogFile}
              disabled={isDownloading}
              className="btn sm secondary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 600,
                borderRadius: "6px",
              }}
            >
              <span>{isDownloading ? "در حال دانلود..." : "📥 دانلود فایل لاگ (.log)"}</span>
            </button>
            <button
              type="button"
              onClick={fetchDiagnosticLogs}
              disabled={diagLoading}
              className="btn sm outline"
              style={{ borderRadius: "6px" }}
              title="بروزرسانی لاگ‌ها"
            >
              <span>🔄</span>
            </button>
          </div>
        )}
      </div>

      {/* نمایش محتوا بر اساس تب فعال */}
      {activeTab === "audit_trail" ? (
        /* تب ۱: جدول ردپای ممیزی اطلاعات */
        <div className="card" style={{ padding: "20px" }}>
          <DataTable
            tableName="audit_logs"
            columns={columns}
            data={logs}
            searchPlaceholder="جستجو بر اساس نام کاربر یا نوع شرح..."
            searchFields={["actorName", "summary"]}
          />
        </div>
      ) : (
        /* تب ۲: لاگ‌های تشخیصی و خطاهای سیستم */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* کارت‌های شاخص خطاهای تشخیصی */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">کل وقایع اخیر</span>
                <span className="text-xl font-bold text-foreground mt-1 block">{diagSummary.total}</span>
              </div>
              <span className="text-2xl">📋</span>
            </div>
            <div className="bg-card border border-red-500/30 rounded-xl p-4 flex items-center justify-between shadow-xs bg-red-500/5">
              <div>
                <span className="text-xs text-red-600 dark:text-red-400 block font-semibold">خطاهای بحرانی (ERROR)</span>
                <span className="text-xl font-bold text-red-600 dark:text-red-400 mt-1 block">{diagSummary.errorCount}</span>
              </div>
              <span className="text-2xl">🔴</span>
            </div>
            <div className="bg-card border border-amber-500/30 rounded-xl p-4 flex items-center justify-between shadow-xs bg-amber-500/5">
              <div>
                <span className="text-xs text-amber-600 dark:text-amber-400 block font-semibold">هشدارها (WARN)</span>
                <span className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">{diagSummary.warnCount}</span>
              </div>
              <span className="text-2xl">🟡</span>
            </div>
            <div className="bg-card border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between shadow-xs bg-emerald-500/5">
              <div>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-semibold">اطلاع‌رسانی (INFO)</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">{diagSummary.infoCount}</span>
              </div>
              <span className="text-2xl">🟢</span>
            </div>
          </div>

          {/* فیلترها و جستجوی لاگ‌های تشخیصی */}
          <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">فیلتر سطح:</span>
              <button
                type="button"
                onClick={() => setLevelFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  levelFilter === "ALL" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                همه
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("ERROR")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  levelFilter === "ERROR" ? "bg-red-600 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                🔴 فقط خطاها
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("WARN")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  levelFilter === "WARN" ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                🟡 فقط هشدارها
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("INFO")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  levelFilter === "INFO" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                🟢 فقط اطلاع‌رسانی
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground cursor-pointer"
              >
                <option value="ALL">همه دسته‌ها (Category)</option>
                <option value="DATABASE">دیتابیس (DATABASE)</option>
                <option value="NETWORK">شبکه و اشتراک (NETWORK)</option>
                <option value="SYNC">همگام‌سازی آفلاین (SYNC)</option>
                <option value="AUTH">احراز هویت و سشن (AUTH)</option>
                <option value="SYSTEM">سیستمی و سخت‌افزار (SYSTEM)</option>
              </select>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در پیام، استک‌ترس..."
                className="bg-background border border-border rounded-lg px-3 py-1 text-xs text-foreground placeholder:text-muted-foreground w-48 lg:w-60 focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          {/* لیست کارت‌های لاگ تشخیصی */}
          <div className="flex flex-col gap-2.5">
            {diagLoading ? (
              <div className="card p-12 text-center text-muted-foreground">
                <div className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span>در حال خواندن لاگ‌های تشخیصی دیسک و حافظه...</span>
                </div>
              </div>
            ) : diagLogs.length === 0 ? (
              <div className="card p-12 text-center text-muted-foreground">
                <span>هیچ رویدادی مطابق فیلترهای انتخابی ثبت نشده است.</span>
              </div>
            ) : (
              diagLogs.map((entry) => {
                const isExpanded = expandedLogId === entry.id;
                const isError = entry.level === "ERROR";
                const isWarn = entry.level === "WARN";

                return (
                  <div
                    key={entry.id}
                    className={`card p-3.5 transition-all ${
                      isError
                        ? "border-s-4 border-s-red-500 hover:border-red-500/60"
                        : isWarn
                        ? "border-s-4 border-s-amber-500 hover:border-amber-500/60"
                        : "border-s-4 border-s-emerald-500 hover:border-emerald-500/60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isError
                              ? "bg-red-500/15 text-red-600 dark:text-red-400"
                              : isWarn
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {entry.level}
                        </span>
                        <span className="bg-muted px-2 py-0.5 rounded-md text-[10px] font-mono text-muted-foreground">
                          {entry.category}
                        </span>
                        <span className="text-xs font-semibold text-foreground">{entry.message}</span>
                      </div>

                      <div className="flex items-center gap-3 ms-auto">
                        <span className="text-[11px] font-mono text-muted-foreground dir-ltr">
                          {entry.timestampJalali}
                        </span>
                        {(entry.details || entry.stack) && (
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : entry.id)}
                            className="text-xs text-primary hover:underline font-medium cursor-pointer"
                          >
                            {isExpanded ? "بستن جزئیات ▲" : "مشاهده جزئیات ▼"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* جزئیات تکمیلی و استک‌ترس به صورت آکاردئونی */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2 text-xs">
                        {entry.details && (
                          <div>
                            <span className="text-muted-foreground font-semibold">توضیحات خطا:</span>
                            <div className="mt-1 p-2 bg-muted/60 rounded-lg text-foreground font-mono text-[11px] break-words">
                              {entry.details}
                            </div>
                          </div>
                        )}
                        {entry.stack && (
                          <div>
                            <span className="text-muted-foreground font-semibold">ردیابی پشته (Stack Trace):</span>
                            <pre
                              dir="ltr"
                              className="mt-1 p-2.5 bg-neutral-900 text-neutral-200 rounded-lg font-mono text-[10px] overflow-x-auto max-h-48 whitespace-pre-wrap text-left"
                            >
                              {entry.stack}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* مودال نمایش جزئیات تغییرات فیلدی تب ۱ */}
      {selectedLog && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
          }}
        >
          <div 
            className="card" 
            style={{ 
              width: "100%", 
              maxWidth: "640px", 
              padding: "24px", 
              display: "flex", 
              flexDirection: "column", 
              gap: "16px",
              maxHeight: "85vh",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "bold" }}>
                جزئیات فیلدی لاگ شماره {selectedLog.id}
              </h3>
              <button 
                onClick={() => setSelectedLog(null)} 
                className="btn sm outline" 
                style={{ fontSize: "20px", padding: "2px 8px", border: "none" }}
              >
                ×
              </button>
            </div>

            <div>
              <span className="muted" style={{ fontSize: "11px" }}>خلاصه تغییر:</span>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", fontWeight: "bold", color: "var(--accent)" }}>
                {selectedLog.summary}
              </p>
            </div>

            <div>
              <span className="muted" style={{ fontSize: "11px" }}>تغییرات فیلدهای دیتابیس (JSON Diff):</span>
              <div 
                dir="ltr" 
                style={{ 
                  backgroundColor: "var(--panel-2)", 
                  padding: "16px", 
                  borderRadius: "8px", 
                  marginTop: "8px", 
                  overflowX: "auto",
                  fontSize: "12px",
                  maxHeight: "300px"
                }}
              >
                {(() => {
                  try {
                    const diffObj = JSON.parse(selectedLog.changes);
                    if (Object.keys(diffObj).length === 0) {
                      return <span style={{ color: "var(--ink-soft)" }}>هیچ تغییر فیلدی (دیتا فیلتر) ثبت نشده است.</span>;
                    }
                    return (
                      <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--ink)" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--line)" }}>
                            <th style={{ textAlign: "left", padding: "8px" }}>Field</th>
                            <th style={{ textAlign: "left", padding: "8px", color: "var(--crit)" }}>Old Value</th>
                            <th style={{ textAlign: "left", padding: "8px", color: "#10b981" }}>New Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(diffObj).map(([field, vals]: [string, any]) => (
                            <tr key={field} style={{ borderBottom: "1px dashed var(--line-soft)" }}>
                              <td style={{ padding: "8px", fontWeight: "bold" }}>{field}</td>
                              <td style={{ padding: "8px", color: "var(--crit)" }}>{String(vals.old ?? "null")}</td>
                              <td style={{ padding: "8px", color: "#10b981" }}>{String(vals.new ?? "null")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  } catch {
                    return <pre>{selectedLog.changes}</pre>;
                  }
                })()}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button onClick={() => setSelectedLog(null)} className="btn primary">بستن پنجره</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
