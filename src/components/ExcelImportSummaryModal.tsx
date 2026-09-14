"use client";

import React from "react";
import { CheckCircle, X, PlusCircle, ArrowClockwise, SkipForward, FileXls } from "@phosphor-icons/react";
import type { ImportSummaryReport } from "@/lib/excel-import-types";

interface ExcelImportSummaryModalProps {
  isOpen: boolean;
  summary: ImportSummaryReport | null;
  onClose: () => void;
}

export default function ExcelImportSummaryModal({
  isOpen,
  summary,
  onClose,
}: ExcelImportSummaryModalProps) {
  if (!isOpen || !summary) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
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
          maxWidth: "520px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* هدر گزارش آماری */}
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--line)",
            backgroundColor: "rgba(16, 185, 129, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <CheckCircle size={24} weight="bold" color="#10b981" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--ink)" }}>
                گزارش نهایی درون‌ریزی فایل اکسل
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--ink-soft)" }}>
                خلاصه پردازش دسته‌ای و اعمال تغییرات در سامانه
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-faint)",
              padding: "6px",
            }}
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* کارت‌های آماری سه‌گانه */}
        <div style={{ padding: "24px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            {/* رکورد جدید */}
            <div
              style={{
                padding: "16px 12px",
                borderRadius: "14px",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <PlusCircle size={22} weight="bold" color="#10b981" />
              <span style={{ fontSize: "22px", fontWeight: "800", color: "#10b981" }}>
                {summary.createdCount}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
                پرسنل جدید
              </span>
            </div>

            {/* به‌روزرسانی */}
            <div
              style={{
                padding: "16px 12px",
                borderRadius: "14px",
                backgroundColor: "rgba(37, 99, 235, 0.08)",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <ArrowClockwise size={22} weight="bold" color="#2563eb" />
              <span style={{ fontSize: "22px", fontWeight: "800", color: "#2563eb" }}>
                {summary.updatedCount}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
                به‌روزرسانی‌شده
              </span>
            </div>

            {/* صرف‌نظر */}
            <div
              style={{
                padding: "16px 12px",
                borderRadius: "14px",
                backgroundColor: "rgba(100, 116, 139, 0.08)",
                border: "1px solid rgba(100, 116, 139, 0.2)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <SkipForward size={22} weight="bold" color="#64748b" />
              <span style={{ fontSize: "22px", fontWeight: "800", color: "#64748b" }}>
                {summary.skippedCount}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
                صرف‌نظر (تکراری)
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              backgroundColor: "var(--panel-2)",
              border: "1px solid var(--line)",
              fontSize: "13px",
              lineHeight: "1.6",
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <FileXls size={24} color="var(--accent)" />
            <div>
              <div>مجموع سطرهای پردازش‌شده در این عملیات: <b>{summary.totalProcessed} سطر</b></div>
              <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "2px" }}>
                اطلاعات پایگاه‌داده با موفقیت همگام گردید.
              </div>
            </div>
          </div>
        </div>

        {/* فوتر */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--line)",
            backgroundColor: "var(--panel-2)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn primary"
            style={{ minWidth: "120px" }}
          >
            متوجه شدم و بستن
          </button>
        </div>
      </div>
    </div>
  );
}
