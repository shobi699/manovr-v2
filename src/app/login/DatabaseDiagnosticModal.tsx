"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NetworkStatusResult, RepairResult } from "@/lib/network-status";
import { runDatabaseRepairAction, getDetailedDatabaseStatusAction } from "@/app/actions/database-repair";

interface DatabaseDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStatus: NetworkStatusResult | null;
  onStatusUpdated: (newStatus: NetworkStatusResult) => void;
}

export default function DatabaseDiagnosticModal({
  isOpen,
  onClose,
  initialStatus,
  onStatusUpdated,
}: DatabaseDiagnosticModalProps) {
  const [status, setStatus] = useState<NetworkStatusResult | null>(initialStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated = await getDetailedDatabaseStatusAction();
      setStatus(updated);
      onStatusUpdated(updated);
    } catch (e) {
      console.error("Refresh error", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRepair = async () => {
    setIsRepairing(true);
    setRepairResult(null);
    try {
      const res = await runDatabaseRepairAction();
      setRepairResult(res);
      // پس از تعمیر، وضعیت مجدداً استعلام می‌شود
      const updated = await getDetailedDatabaseStatusAction();
      setStatus(updated);
      onStatusUpdated(updated);
    } catch (e: any) {
      setRepairResult({
        success: false,
        message: "خطا در برقراری ارتباط با سرویس تعمیر.",
        steps: [{ title: "خطا", status: "error", detail: e?.message || "خطای ارتباطی" }],
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const isSharedAccessible = Boolean(status?.sharedPathAccessible);
  const isWritable = Boolean(status?.sharedPathWritable);
  const isDbExists = Boolean(status?.databaseExists);
  const isDbReady = Boolean(status?.isDatabaseReady);
  const hasLocks = Boolean(status?.hasStaleLocks);

  return (
    <AnimatePresence>
      <div
        dir="rtl"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "grid",
          placeItems: "center",
          backgroundColor: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(6px)",
          padding: "16px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          style={{
            width: "100%",
            maxWidth: "620px",
            backgroundColor: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "90vh",
          }}
        >
          {/* هدر پنجره */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>🔍</span>
              <div>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
                  ابزار جامع عیب‌یابی و تعمیر پایگاه داده تحت شبکه
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "var(--ink-faint)" }}>
                  سامانه مدیریت پایانه و مانور ریلی فتح‌آباد (پوشه اشتراکی شبکه)
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "18px",
                cursor: "pointer",
                color: "var(--ink-soft)",
                padding: "4px 8px",
                borderRadius: "6px",
              }}
              title="بستن"
            >
              ✕
            </button>
          </div>

          {/* بدنه اسکرول‌پذیر */}
          <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
            {/* پیام وضعیت اصلی */}
            {status?.userMessage && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  marginBottom: "16px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: !isWritable || !isSharedAccessible
                    ? "rgba(239, 68, 68, 0.12)"
                    : hasLocks
                    ? "rgba(245, 158, 11, 0.12)"
                    : "rgba(34, 197, 94, 0.12)",
                  color: !isWritable || !isSharedAccessible
                    ? "#dc2626"
                    : hasLocks
                    ? "#d97706"
                    : "#16a34a",
                  border: `1px solid ${
                    !isWritable || !isSharedAccessible
                      ? "rgba(239, 68, 68, 0.3)"
                      : hasLocks
                      ? "rgba(245, 158, 11, 0.3)"
                      : "rgba(34, 197, 94, 0.3)"
                  }`,
                }}
              >
                <span style={{ fontSize: "18px" }}>
                  {!isWritable || !isSharedAccessible ? "⛔" : hasLocks ? "⚠️" : "✅"}
                </span>
                <span style={{ flex: 1, lineHeight: "1.6" }}>{status.userMessage}</span>
              </div>
            )}

            {/* چک‌لیست ۵ مرحله‌ای عیب‌یابی */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {/* مرحله ۱: پوشه اشتراکی */}
              <DiagnosticStepItem
                stepNum={1}
                title="اتصال به پوشه اشتراکی شبکه سرور"
                status={isSharedAccessible ? "ok" : "error"}
                description={
                  isSharedAccessible
                    ? `پوشه سرور با موفقیت تایید شد (${status?.maskedTarget || "سرور دپو"})`
                    : "مسیر پوشه سرور از این سیستم قابل رویت نیست. کابل شبکه و اتصال سازمانی را بررسی کنید."
                }
              />

              {/* مرحله ۲: فایل دیتابیس */}
              <DiagnosticStepItem
                stepNum={2}
                title="بررسی وجود فایل دیتابیس مرکزی (dev.db)"
                status={isDbExists ? "ok" : "error"}
                description={
                  isDbExists
                    ? `فایل پایگاه داده در مسیر شناسایی شد (${status?.activeDatabasePath ? "dev.db" : ""})`
                    : "فایل پایگاه داده در پوشه شبکه یافت نشد. با ادمین سیستم هماهنگ نمایید."
                }
              />

              {/* مرحله ۳: مجوز نوشتن (Write/Modify) */}
              <DiagnosticStepItem
                stepNum={3}
                title="بررسی مجوز نوشتن و اصلاح (NTFS Modify & Write)"
                status={isWritable ? "ok" : "error"}
                description={
                  isWritable
                    ? "مجوز نوشتن و اصلاح اطلاعات در پوشه سرور تایید گردید."
                    : "کاربر جاری دسترسی نوشتن در پوشه شبکه را ندارد! لازم است ادمین دسترسی Modify پوشه را فعال کند."
                }
                warningDetail={
                  !isWritable && (
                    <div style={{ marginTop: "6px", fontSize: "11px", color: "#b91c1c", lineHeight: "1.6" }}>
                      💡 <b>راهکار فوری:</b> در سرور روی پوشه data کلیک راست کرده و در زبانه Security، دسترسی <b>Modify</b> و <b>Write</b> را به پرسنل یا کاربر فعلی اعطا نمایید.
                    </div>
                  )
                }
              />

              {/* مرحله ۴: قفل‌های موقت SQLite */}
              <DiagnosticStepItem
                stepNum={4}
                title="بررسی قفل‌های موقت و حالت ژورنال"
                status={!hasLocks ? "ok" : "warn"}
                description={
                  !hasLocks
                    ? `حالت ژورنال پایدار (${status?.journalMode || "TRUNCATE"})، بدون قفل موقت`
                    : "فایل‌های موقت قفل (-wal/-shm) مشاهده شد. برای آزادسازی از دکمه تعمیر استفاده کنید."
                }
              />

              {/* مرحله ۵: پینگ و تراکنش */}
              <DiagnosticStepItem
                stepNum={5}
                title="آزمون تراکنش و تاخیر شبکه (Ping)"
                status={isDbReady ? "ok" : "error"}
                description={
                  isDbReady
                    ? `تراکنش موفق • زمان پاسخگویی: ${status?.pingMs} میلی‌ثانیه`
                    : "پایگاه داده به کوئری آزمایشی پاسخ نداد."
                }
              />
            </div>

            {/* نتیجه عملیات تعمیر */}
            {repairResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  backgroundColor: repairResult.success ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
                  border: `1px solid ${repairResult.success ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13px", color: repairResult.success ? "#15803d" : "#b91c1c" }}>
                  <span>{repairResult.success ? "✅" : "❌"}</span>
                  <span>{repairResult.message}</span>
                </div>
                <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {repairResult.steps.map((step, idx) => (
                    <div key={idx} style={{ fontSize: "11.5px", display: "flex", alignItems: "flex-start", gap: "6px", color: "var(--ink-soft)" }}>
                      <span>{step.status === "ok" ? "🟢" : step.status === "warn" ? "🟡" : "🔴"}</span>
                      <div>
                        <b>{step.title}:</b> {step.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* فوتر با دکمه‌های عملیاتی */}
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(255,255,255,0.02)",
              gap: "10px",
            }}
          >
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isRepairing}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                backgroundColor: "var(--panel)",
                color: "var(--ink)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: isRefreshing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }}>🔄</span>
              <span>{isRefreshing ? "در حال استعلام..." : "بررسی مجدد وضعیت"}</span>
            </button>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleRepair}
                disabled={isRepairing || isRefreshing}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: isRepairing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
                }}
              >
                <span>🛠️</span>
                <span>{isRepairing ? "در حال آزادسازی قفل‌ها..." : "آزادسازی قفل و تعمیر دیتابیس"}</span>
              </button>

              <button
                onClick={onClose}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  backgroundColor: "transparent",
                  color: "var(--ink-soft)",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                بستن
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function DiagnosticStepItem({
  stepNum,
  title,
  status,
  description,
  warningDetail,
}: {
  stepNum: number;
  title: string;
  status: "ok" | "warn" | "error";
  description: string;
  warningDetail?: React.ReactNode;
}) {
  const isOk = status === "ok";
  const isWarn = status === "warn";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "10px",
        backgroundColor: isOk
          ? "rgba(34, 197, 94, 0.04)"
          : isWarn
          ? "rgba(245, 158, 11, 0.04)"
          : "rgba(239, 68, 68, 0.05)",
        border: `1px solid ${
          isOk ? "rgba(34, 197, 94, 0.2)" : isWarn ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)"
        }`,
      }}
    >
      <div
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          backgroundColor: isOk ? "#22c55e" : isWarn ? "#f59e0b" : "#ef4444",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: "11px",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {isOk ? "✓" : isWarn ? "!" : "✕"}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>
          {stepNum}. {title}
        </div>
        <div style={{ fontSize: "11px", color: "var(--ink-soft)", marginTop: "2px" }}>
          {description}
        </div>
        {warningDetail}
      </div>
    </div>
  );
}
