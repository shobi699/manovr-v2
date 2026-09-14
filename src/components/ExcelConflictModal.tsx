"use client";

import React, { useState, useMemo } from "react";
import {
  Warning,
  ArrowClockwise,
  SkipForward,
  CheckCircle,
  X,
  User,
  IdentificationCard,
  Phone,
  Buildings,
  Clock,
  MapPin,
  FileXls,
} from "@phosphor-icons/react";
import type {
  ImportConflictItem,
  ImportPersonnelRow,
  BatchImportPayload,
} from "@/lib/excel-import-types";

interface ExcelConflictModalProps {
  isOpen: boolean;
  conflicts: ImportConflictItem[];
  nonConflicting: ImportPersonnelRow[];
  isSubmitting?: boolean;
  onConfirm: (payload: BatchImportPayload) => void;
  onCancel: () => void;
}

export default function ExcelConflictModal({
  isOpen,
  conflicts,
  nonConflicting,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: ExcelConflictModalProps) {
  // مدیریت اکشن هر تعارض: id -> "update" | "skip"
  const [resolutions, setResolutions] = useState<Record<string, "update" | "skip">>(() => {
    const init: Record<string, "update" | "skip"> = {};
    conflicts.forEach((c) => {
      init[c.id] = c.action || "update";
    });
    return init;
  });

  // اگر پراپ‌ها تغییر کرد، استیت محلی را همگام می‌کنیم
  React.useEffect(() => {
    const init: Record<string, "update" | "skip"> = {};
    conflicts.forEach((c) => {
      init[c.id] = c.action || "update";
    });
    setResolutions(init);
  }, [conflicts]);

  const updateCount = useMemo(() => {
    return Object.values(resolutions).filter((a) => a === "update").length;
  }, [resolutions]);

  const skipCount = useMemo(() => {
    return Object.values(resolutions).filter((a) => a === "skip").length;
  }, [resolutions]);

  if (!isOpen) return null;

  const handleSetSingleResolution = (id: string, action: "update" | "skip") => {
    setResolutions((prev) => ({ ...prev, [id]: action }));
  };

  const handleSelectAll = (action: "update" | "skip") => {
    const updated: Record<string, "update" | "skip"> = {};
    conflicts.forEach((c) => {
      updated[c.id] = action;
    });
    setResolutions(updated);
  };

  const handleSubmit = () => {
    const payloadResolutions = conflicts.map((c) => ({
      rowIndex: c.rowIndex,
      existingId: c.existingRecord.id,
      action: resolutions[c.id] || "update",
      data: c.newRecord,
    }));

    onConfirm({
      newRecords: nonConflicting,
      resolutions: payloadResolutions,
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99998,
        padding: "16px",
      }}
      dir="rtl"
    >
      <div
        style={{
          backgroundColor: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "920px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          animation: "modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* هدر مدال */}
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--line)",
            backgroundColor: "rgba(245, 158, 11, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                backgroundColor: "rgba(245, 158, 11, 0.15)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Warning size={24} weight="bold" color="#f59e0b" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "var(--ink)" }}>
                مدیریت تعارضات و موارد تکراری فایل اکسل
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ink-soft)" }}>
                تعداد {conflicts.length} سطر با اطلاعات موجود در پایگاه‌داده تداخل دارند. نحوه همگام‌سازی را انتخاب فرمایید:
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              background: "transparent",
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              color: "var(--ink-faint)",
              padding: "8px",
              borderRadius: "8px",
              display: "flex",
            }}
            title="بستن"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* نوار آمار و ابزار دسته‌جمعی */}
        <div
          style={{
            padding: "14px 24px",
            backgroundColor: "var(--panel-2)",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          {/* نشان‌های آماری */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.2)",
              }}
            >
              <CheckCircle size={15} weight="fill" />
              {nonConflicting.length} پرسنل جدید (درج خودکار)
            </span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                backgroundColor: "rgba(245, 158, 11, 0.1)",
                color: "#f59e0b",
                border: "1px solid rgba(245, 158, 11, 0.2)",
              }}
            >
              <Warning size={15} weight="fill" />
              {conflicts.length} مورد دارای تعارض
            </span>
          </div>

          {/* کلیدهای تغییر سریع همه موارد */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => handleSelectAll("update")}
              className="btn sm secondary"
              style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px" }}
            >
              <ArrowClockwise size={14} weight="bold" />
              به‌روزرسانی همه ({conflicts.length})
            </button>
            <button
              type="button"
              onClick={() => handleSelectAll("skip")}
              className="btn sm secondary"
              style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px" }}
            >
              <SkipForward size={14} weight="bold" />
              صرف‌نظر از همه ({conflicts.length})
            </button>
          </div>
        </div>

        {/* لیست تعارضات با اسکرول نرم */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            flex: 1,
          }}
        >
          {conflicts.map((conflict, idx) => {
            const currentAction = resolutions[conflict.id] || "update";
            const isUpdate = currentAction === "update";

            return (
              <div
                key={conflict.id}
                style={{
                  backgroundColor: "var(--panel)",
                  border: isUpdate ? "1px solid var(--accent)" : "1px solid var(--line)",
                  borderRadius: "14px",
                  padding: "16px",
                  boxShadow: isUpdate ? "0 4px 14px -3px rgba(37, 99, 235, 0.15)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {/* هدر کارت تعارض */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "14px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        backgroundColor: "var(--panel-2)",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                      }}
                    >
                      ردیف {conflict.rowIndex} اکسل
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#f59e0b",
                        backgroundColor: "rgba(245, 158, 11, 0.1)",
                        padding: "4px 10px",
                        borderRadius: "20px",
                      }}
                    >
                      {conflict.conflictReason}
                    </span>
                  </div>

                  {/* انتخابگر وضعیت رادیویی شکیل */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => handleSetSingleResolution(conflict.id, "update")}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: isUpdate ? "1px solid var(--accent)" : "1px solid var(--line)",
                        backgroundColor: isUpdate ? "var(--accent)" : "transparent",
                        color: isUpdate ? "#ffffff" : "var(--ink-soft)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <ArrowClockwise size={14} weight="bold" />
                      به‌روزرسانی رکورد
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetSingleResolution(conflict.id, "skip")}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: !isUpdate ? "1px solid #ef4444" : "1px solid var(--line)",
                        backgroundColor: !isUpdate ? "rgba(239, 68, 68, 0.1)" : "transparent",
                        color: !isUpdate ? "#ef4444" : "var(--ink-soft)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <SkipForward size={14} weight="bold" />
                      صرف‌نظر (نادیده‌گرفتن)
                    </button>
                  </div>
                </div>

                {/* مقایسه دو ستونه: موجود در سامانه vs ورودی جدید اکسل */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                  }}
                >
                  {/* ستون راست: داده‌های فعلی پایگاه داده */}
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      backgroundColor: "var(--panel-2)",
                      border: "1px solid var(--line-soft)",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-soft)", marginBottom: "8px" }}>
                      🏛️ اطلاعات فعلی در پایگاه‌داده:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={14} color="var(--ink-faint)" />
                        <span style={{ fontWeight: 600 }}>{conflict.existingRecord.firstName} {conflict.existingRecord.lastName}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <IdentificationCard size={14} color="var(--ink-faint)" />
                        <span>کد پرسنلی: <b>{conflict.existingRecord.personnelCode || "—"}</b></span>
                      </div>
                      {conflict.existingRecord.userName && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "11px", color: "var(--ink-faint)" }}>@</span>
                          <span>نام کاربری: <b>{conflict.existingRecord.userName}</b></span>
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Phone size={14} color="var(--ink-faint)" />
                        <span>همراه: <b>{conflict.existingRecord.phone1 || conflict.existingRecord.phone2 || "—"}</b></span>
                      </div>
                    </div>
                  </div>

                  {/* ستون چپ: داده‌های جدید در اکسل */}
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      backgroundColor: isUpdate ? "rgba(37, 99, 235, 0.04)" : "var(--panel-2)",
                      border: isUpdate ? "1px solid rgba(37, 99, 235, 0.25)" : "1px solid var(--line-soft)",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: isUpdate ? "var(--accent)" : "var(--ink-soft)", marginBottom: "8px" }}>
                      📄 مقادیر پیشنهادی در فایل اکسل:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={14} color="var(--ink-faint)" />
                        <span style={{ fontWeight: 600 }}>{conflict.newRecord.firstName} {conflict.newRecord.lastName}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <IdentificationCard size={14} color="var(--ink-faint)" />
                        <span>کد پرسنلی: <b style={{ color: conflict.matchType === "personnelCode" ? "var(--accent)" : "inherit" }}>{conflict.newRecord.personnelCode || "—"}</b></span>
                      </div>
                      {conflict.newRecord.userName && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "11px", color: "var(--ink-faint)" }}>@</span>
                          <span>نام کاربری: <b style={{ color: conflict.matchType === "userName" ? "var(--accent)" : "inherit" }}>{conflict.newRecord.userName}</b></span>
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Phone size={14} color="var(--ink-faint)" />
                        <span>همراه: <b style={{ color: conflict.matchType === "phone" ? "var(--accent)" : "inherit" }}>{conflict.newRecord.phone1 || conflict.newRecord.phone2 || "—"}</b></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* فوتر مدال و تأیید نهایی */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--line)",
            backgroundColor: "var(--panel-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
            خلاصه عملیات: <b>{nonConflicting.length} درج جدید</b>، <b>{updateCount} به‌روزرسانی</b>، <b>{skipCount} صرف‌نظر</b>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="btn"
              style={{ minWidth: "90px" }}
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn primary"
              style={{ minWidth: "180px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              {isSubmitting ? (
                <span>در حال پردازش و ثبت…</span>
              ) : (
                <>
                  <CheckCircle size={18} weight="bold" />
                  <span>تأیید و اعمال درون‌ریزی</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
