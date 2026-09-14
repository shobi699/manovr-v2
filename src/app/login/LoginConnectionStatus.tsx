"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface NetworkStatusData {
  isShared: boolean;
  isDatabaseReady: boolean;
  targetSharedPath: string;
  activeDatabasePath: string;
  maskedTarget?: string;
  maskedActivePath?: string;
  storageSource: string;
  pingMs: number;
  sharedPathAccessible: boolean;
  serverHostname: string;
  checkedAt: string;
}

export default function LoginConnectionStatus() {
  const [status, setStatus] = useState<NetworkStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // پاک‌سازی تایمرها
  const clearTimers = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    countdownTimerRef.current = null;
    retryTimeoutRef.current = null;
  };

  // استعلام وضعیت شبکه از سرور
  const checkConnection = useCallback(async () => {
    clearTimers();
    setCountdown(null);
    setLoading(true);

    try {
      const res = await fetch("/api/system/network-status", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.ok) {
        const data: NetworkStatusData = await res.json();
        setStatus(data);

        // در صورت موفقیت و در دسترس بودن دیتابیس، شمارنده ریتری صفر می‌شود
        if (data.isDatabaseReady) {
          setRetryCount(0);
          setLoading(false);
          return;
        }
      }
      // اگر ریسپانس ناموفق یا دیتابیس آماده نبود
      handleConnectionFailure();
    } catch {
      handleConnectionFailure();
    } finally {
      setLoading(false);
    }
  }, [retryCount]);

  // سازوکار زمان‌بندی تلاش مجدد با فاصله تصاعدی (Exponential Backoff)
  const handleConnectionFailure = () => {
    setStatus((prev) => (prev ? { ...prev, isDatabaseReady: false } : null));
    setRetryCount((prev) => {
      const nextCount = prev + 1;
      // بازه زمانی بر حسب ثانیه: ۳، ۵، ۸، ۱۲، ۲۰ ثانیه
      const backoffSeconds = Math.min(3 + nextCount * 2, 25);
      setCountdown(backoffSeconds);

      // تایمر شمارش معکوس برای آگاهی کاربر
      let currentRemain = backoffSeconds;
      countdownTimerRef.current = setInterval(() => {
        currentRemain -= 1;
        if (currentRemain <= 0) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          setCountdown(null);
          checkConnection();
        } else {
          setCountdown(currentRemain);
        }
      }, 1000);

      return nextCount;
    });
  };

  // بررسی اولیه هنگام بارگذاری کامپوننت و بررسی دوره‌ای در پس‌زمینه
  useEffect(() => {
    checkConnection();

    // تست سلامت پس‌زمینه هر ۳۵ ثانیه در صورت آنلاین بودن
    const periodicInterval = setInterval(() => {
      if (!countdown) {
        checkConnection();
      }
    }, 35000);

    return () => {
      clearInterval(periodicInterval);
      clearTimers();
    };
  }, []);

  const isOnlineAndShared = Boolean(status?.isShared && status?.isDatabaseReady);
  const isLocalFallback = Boolean(!status?.isShared && status?.isDatabaseReady);
  const isDisconnected = Boolean(!status?.isDatabaseReady && !loading);

  const getBorderColor = () => {
    if (loading) return "var(--line)";
    if (isOnlineAndShared) return "rgba(34, 197, 94, 0.35)";
    if (isLocalFallback) return "rgba(245, 158, 11, 0.35)";
    return "rgba(239, 68, 68, 0.35)";
  };

  const getBgColor = () => {
    if (loading) return "var(--panel)";
    if (isOnlineAndShared) return "rgba(34, 197, 94, 0.07)";
    if (isLocalFallback) return "rgba(245, 158, 11, 0.07)";
    return "rgba(239, 68, 68, 0.08)";
  };

  return (
    <div
      dir="rtl"
      style={{
        marginTop: "14px",
        borderRadius: "10px",
        border: `1px solid ${getBorderColor()}`,
        backgroundColor: getBgColor(),
        padding: "10px 12px",
        transition: "all 0.3s ease",
        boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
          {/* نشانگر انیمیشنی وضعیت */}
          <div
            style={{
              position: "relative",
              width: "10px",
              height: "10px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                backgroundColor: loading
                  ? "#94a3b8"
                  : isOnlineAndShared
                  ? "#22c55e"
                  : isLocalFallback
                  ? "#f59e0b"
                  : "#ef4444",
                opacity: 0.75,
                animation: isOnlineAndShared
                  ? "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite"
                  : "none",
              }}
            />
            <span
              style={{
                position: "relative",
                display: "block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: loading
                  ? "#94a3b8"
                  : isOnlineAndShared
                  ? "#22c55e"
                  : isLocalFallback
                  ? "#f59e0b"
                  : "#ef4444",
              }}
            />
          </div>

          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: loading
                  ? "var(--ink-soft)"
                  : isOnlineAndShared
                  ? "#15803d"
                  : isLocalFallback
                  ? "#b45309"
                  : "#b91c1c",
              }}
            >
              {loading
                ? "در حال سنجش ارتباط با سرور..."
                : isOnlineAndShared
                ? "سرور دپو: متصل و آنلاین"
                : isLocalFallback
                ? "حالت پایگاه داده محلی (آفلاین)"
                : "عدم دسترسی به سرور دپو"}
            </div>

            <div style={{ fontSize: "10.5px", color: "var(--ink-faint)", marginTop: "1px" }}>
              {loading
                ? "برقراری ارتباط با سرویس‌های پایانه..."
                : isOnlineAndShared
                ? `پایگاه داده متمرکز شبکه ${
                    status?.pingMs && status.pingMs > 0 ? `(${status.pingMs}ms)` : ""
                  }`
                : isLocalFallback
                ? "ارتباط با شبکه قطع است؛ ورود با داده‌های محلی"
                : countdown
                ? `تلاش مجدد خودکار در ${countdown} ثانیه...`
                : "خطای اتصال؛ سرور در دسترس نیست"}
            </div>
          </div>
        </div>

        {/* دکمه تلاش مجدد و جزئیات */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={checkConnection}
            disabled={loading}
            title="بررسی مجدد اتصال به سرور"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "background 0.2s",
            }}
          >
            <span
              style={{
                display: "inline-block",
                animation: loading ? "spin 1s linear infinite" : "none",
                fontSize: "11px",
              }}
            >
              🔄
            </span>
            <span>{loading ? "بررسی..." : "تلاش مجدد"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            title="نمایش اطلاعات شبکه"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              color: "var(--ink-soft)",
              padding: "2px 4px",
            }}
          >
            {showDetails ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* بخش جزئیات تکمیلی شبکه به درخواست کاربر */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginTop: "10px",
              paddingTop: "8px",
              borderTop: "1px dashed var(--line-soft)",
              fontSize: "11px",
              color: "var(--ink-soft)",
              lineHeight: "1.7",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>هدف سرور:</span>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {status?.maskedTarget || "سرور متمرکز پایانه فتح‌آباد"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>نوع منبع داده:</span>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {status?.storageSource || "ناشناخته"}
              </span>
            </div>
            {status?.pingMs !== undefined && status.pingMs > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>تاخیر شبکه (Ping):</span>
                <span style={{ fontWeight: 700, direction: "ltr" }}>
                  {status.pingMs} ms
                </span>
              </div>
            )}
            {retryCount > 0 && isDisconnected && (
              <div style={{ color: "#b91c1c", marginTop: "4px" }}>
                تعداد تلاش‌های ناموفق: {retryCount} بار
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
