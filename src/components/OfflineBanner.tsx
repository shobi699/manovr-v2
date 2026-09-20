"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icons } from "@/lib/icons";

interface OfflineState {
  isShared: boolean;
  isDatabaseReady: boolean;
  policy: "auto_sync" | "read_only";
  queueLength: number;
  hasStaleItems: boolean;
  staleWarningMessage: string | null;
}

export default function OfflineBanner() {
  const [state, setState] = useState<OfflineState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [netRes, syncRes] = await Promise.all([
        fetch("/api/system/network-status", { cache: "no-store" }),
        fetch("/api/system/sync", { cache: "no-store" }),
      ]);

      if (netRes.ok && syncRes.ok) {
        const netData = await netRes.json();
        const syncData = await syncRes.json();

        setState({
          isShared: Boolean(netData.isShared),
          isDatabaseReady: Boolean(netData.isDatabaseReady),
          policy: syncData.policy || "auto_sync",
          queueLength: syncData.queueLength || 0,
          hasStaleItems: Boolean(syncData.hasStaleItems),
          staleWarningMessage: syncData.staleWarningMessage || null,
        });
      }
    } catch {
      // نادیده‌گرفتن خطای گذرای واکشی
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // بازخوانی هر ۱۵ ثانیه
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      setSyncFeedback(null);
      const res = await fetch("/api/system/sync", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        setSyncFeedback(
          result.syncedCount > 0
            ? `${result.syncedCount} مورد با موفقیت با سرور دپو همگام‌سازی شد.`
            : "اطلاعات با سرور کاملاً همگام است."
        );
        fetchStatus();
      } else {
        setSyncFeedback(result.message || "خطا در برقراری ارتباط با سرور");
      }
    } catch {
      setSyncFeedback("خطا در ارسال درخواست همگام‌سازی");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!state) return null;

  // اگر شبکه وصل است و داده معوقه قدیمی نداریم، نیازی به نمایش بنر نیست
  const isDisconnected = !state.isShared || !state.isDatabaseReady;
  if (!isDisconnected && !state.hasStaleItems && state.queueLength === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        dir="rtl"
        style={{
          margin: "0 0 16px 0",
          padding: "12px 16px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "13px",
          fontWeight: 600,
          border: state.hasStaleItems
            ? "1px solid var(--crit)"
            : isDisconnected && state.policy === "read_only"
            ? "1px solid var(--crit)"
            : "1px solid var(--warn)",
          backgroundColor: state.hasStaleItems
            ? "rgba(220, 38, 38, 0.12)"
            : isDisconnected && state.policy === "read_only"
            ? "rgba(220, 38, 38, 0.10)"
            : "rgba(216, 132, 42, 0.12)",
          color: "var(--ink)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "280px" }}>
          <span style={{ fontSize: "18px" }}>
            {state.hasStaleItems ? "🚨" : isDisconnected && state.policy === "read_only" ? "🔒" : "⚡"}
          </span>
          <div>
            <div style={{ fontWeight: 700 }}>
              {state.hasStaleItems
                ? "هشدار بحرانی ماندگاری صف آفلاین (بیش از ۱۰ دقیقه)"
                : isDisconnected && state.policy === "read_only"
                ? "حالت فقط مشاهده (Read-Only) — ارتباط با سرور متمرکز دپو قطع است"
                : isDisconnected && state.policy === "auto_sync"
                ? "حالت کار آفلاین هوشمند — ذخیره در حافظه محلی رایانه"
                : `صف همگام‌سازی دپو (${state.queueLength} مورد منتظر ارسال)`}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "2px", fontWeight: 400 }}>
              {state.hasStaleItems
                ? state.staleWarningMessage ||
                  "تغییراتی بیش از ۱۰ دقیقه است که در صف آفلاین مانده‌اند. لطفاً اتصال به پوشه اشتراکی دپو را بررسی فرمایید."
                : isDisconnected && state.policy === "read_only"
                ? "طبق سیاست حاکمیتی مدیریت، ثبت مانور جدید و تغییر وضعیت قطارها تا برقراری مجدد ارتباط با سرور مسدود می‌باشد."
                : isDisconnected && state.policy === "auto_sync"
                ? `ارتباط با سرور متمرکز قطع است. عملیات شما در رایانه ذخیره شده و به محض اتصال به‌طور خودکار به سرور دپو منتقل می‌شود (${state.queueLength} مورد در صف).`
                : "ارتباط با سرور متمرکز دپو برقرار است و رکوردهای معوقه در نوبت تخلیه به سرور هستند."}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {syncFeedback && (
            <span style={{ fontSize: "12px", color: "var(--ink)", fontWeight: 500 }}>
              {syncFeedback}
            </span>
          )}

          {!isDisconnected && state.queueLength > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="btn btn-sm"
              style={{
                backgroundColor: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: isSyncing ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {isSyncing ? "در حال ارسال..." : "همگام‌سازی فوری با سرور"}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
