"use client";

import React, { useState } from "react";
import DataTable from "@/components/DataTable";

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
  const [logs] = useState<AuditLog[]>(initialLogs);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* جدول کل لاگ‌ها */}
      <div className="card" style={{ padding: "20px" }}>
        <DataTable
          tableName="audit_logs"
          columns={columns}
          data={logs}
          searchPlaceholder="جستجو بر اساس نام کاربر یا نوع شرح..."
          searchFields={["actorName", "summary"]}
        />
      </div>

      {/* مودال نمایش جزئیات تغییرات فیلدی */}
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
