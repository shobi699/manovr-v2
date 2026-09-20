"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { Icons } from "@/lib/icons";
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

export default function ServerStatusBadge({
  isCollapsed = false,
}: {
  isCollapsed?: boolean;
}) {
  const [status, setStatus] = useState<NetworkStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [queueCount, setQueueCount] = useState<number>(0);
  const [hasStaleItems, setHasStaleItems] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const prevIsConnectedRef = useRef<boolean | null>(null);

  // واکشی وضعیت شبکه و صف آفلاین
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/system/network-status", { cache: "no-store" });
      if (res.ok) {
        const data: NetworkStatusData = await res.json();
        setStatus(data);

        const isConnected = Boolean(data.isShared && data.isDatabaseReady);

        // واکشی تعداد آیتم‌های در صف آفلاین
        try {
          const syncRes = await fetch("/api/system/sync", { cache: "no-store" });
          if (syncRes.ok) {
            const syncInfo = await syncRes.json();
            setQueueCount(syncInfo.queueLength || 0);
            setHasStaleItems(Boolean(syncInfo.hasStaleItems));

            // همگام‌سازی تمام خودکار به محض اتصال مجدد به سرور (بدون نیاز به دخالت کاربر)
            if (
              prevIsConnectedRef.current === false &&
              isConnected &&
              syncInfo.queueLength > 0
            ) {
              console.log("[AutoSync] اتصال به سرور دپو برقرار شد؛ آغاز همگام‌سازی خودکار...");
              triggerSync(true);
            }
          }
        } catch {}

        prevIsConnectedRef.current = isConnected;
      }
    } catch {
      // در صورت بروز خطای شبکه کلاینت
    } finally {
      setLoading(false);
    }
  };

  // تابع اجرای همگام‌سازی
  const triggerSync = async (isAutomatic = false) => {
    try {
      setIsSyncing(true);
      setSyncFeedback(null);
      const res = await fetch("/api/system/sync", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        setSyncFeedback(
          result.syncedCount > 0
            ? `${result.syncedCount} مورد با موفقیت با سرور متمرکز دپو همگام‌سازی شد.`
            : "اطلاعات با سرور کاملاً همگام است."
        );
        setQueueCount(0);
      } else {
        setSyncFeedback(result.message || "خطا در همگام‌سازی با سرور");
      }
    } catch (e: any) {
      setSyncFeedback("خطا در ارسال درخواست همگام‌سازی به سرور");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // بررسی دوره‌ای هر ۳۰ ثانیه یک‌بار
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    startRefresh(async () => {
      await fetchStatus();
    });
  };

  // تعیین وضعیت اتصال
  const isOnlineAndShared = status?.isShared && status?.isDatabaseReady;
  const isLocalFallback = !status?.isShared && status?.isDatabaseReady;
  const isError = status && !status.isDatabaseReady;

  const dotColor = isOnlineAndShared
    ? "#22c55e"
    : isLocalFallback
    ? "#f59e0b"
    : isError
    ? "#ef4444"
    : "#94a3b8";

  const statusLabel = isOnlineAndShared
    ? "سرور دپو: متصل"
    : isLocalFallback
    ? "حالت محلی (آفلاین)"
    : isError
    ? "خطای پایگاه داده"
    : "در حال بررسی...";

  // نام امنیتی پوشه و دیتابیس (بدون نشت آدرس‌های UNC سرور)
  const safeTargetName = status?.maskedTarget || "سرور متمرکز دپو (دپو دیتا)";
  const safeDatabaseName =
    status?.maskedActivePath ||
    (isOnlineAndShared ? "سرور متمرکز دپو (دپو دیتا)" : "پایگاه داده محلی (حالت آفلاین)");

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        title={statusLabel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: isCollapsed ? 0 : "8px",
          justifyContent: isCollapsed ? "center" : "flex-start",
          width: isCollapsed ? "36px" : "100%",
          height: isCollapsed ? "36px" : "auto",
          padding: isCollapsed ? "6px" : "6px 10px",
          borderRadius: "8px",
          border: `1px solid ${
            isOnlineAndShared
              ? "rgba(34, 197, 94, 0.25)"
              : isLocalFallback
              ? "rgba(245, 158, 11, 0.25)"
              : "var(--line)"
          }`,
          backgroundColor: isOnlineAndShared
            ? "rgba(34, 197, 94, 0.08)"
            : isLocalFallback
            ? "rgba(245, 158, 11, 0.08)"
            : "var(--panel)",
          color: "var(--ink)",
          cursor: "pointer",
          fontSize: "11.5px",
          fontWeight: 600,
          transition: "all 0.2s ease",
          outline: "none",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "var(--sh-1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* نشانگر چشمک‌زن نقطه اتصال */}
        <span
          style={{
            position: "relative",
            display: "inline-flex",
            width: "8px",
            height: "8px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              backgroundColor: dotColor,
              opacity: 0.75,
              animation: isOnlineAndShared ? "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite" : "none",
            }}
          />
          <span
            style={{
              position: "relative",
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: dotColor,
            }}
          />
        </span>

        {!isCollapsed && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: isOnlineAndShared ? "#16a34a" : isLocalFallback ? "#d97706" : "var(--ink)",
              }}
            >
              {statusLabel}
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {queueCount > 0 && (
                <span
                  title={
                    hasStaleItems
                      ? `${queueCount} مورد در صف آفلاین (هشدار: معوقه بیش از ۱۰ دقیقه)`
                      : `${queueCount} مورد در صف همگام‌سازی`
                  }
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: hasStaleItems ? "#991b1b" : "#b45309",
                    backgroundColor: hasStaleItems ? "#fee2e2" : "#fef3c7",
                    borderRadius: "10px",
                    padding: "0 5px",
                    lineHeight: "16px",
                    border: hasStaleItems ? "1px solid #ef4444" : "none",
                  }}
                >
                  {hasStaleItems ? `⚠️ ${queueCount}` : queueCount}
                </span>
              )}

              {status?.pingMs !== undefined && status.pingMs > 0 && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--ink-faint)",
                    fontFamily: "monospace",
                    direction: "ltr",
                    padding: "1px 4px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(0,0,0,0.04)",
                  }}
                >
                  {status.pingMs}ms
                </span>
              )}
            </div>
          </div>
        )}
      </button>

      {/* مدال جزئیات و بررسی ارتباط با سرور */}
      <AnimatePresence>
        {isModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(6px)",
              padding: "16px",
            }}
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "460px",
                backgroundColor: "var(--panel)",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--line)",
                boxShadow: "var(--sh-3)",
                padding: "20px",
                direction: "rtl",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  borderBottom: "1px solid var(--line-soft)",
                  paddingBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      backgroundColor: isOnlineAndShared
                        ? "rgba(34, 197, 94, 0.15)"
                        : "rgba(245, 158, 11, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                    }}
                  >
                    {isOnlineAndShared ? "🌐" : "💻"}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
                      وضعیت ارتباط با سرور و پایگاه داده
                    </h3>
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--ink-soft)" }}>
                      سامانه دپو و مانور پایانه فتح‌آباد
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--ink-soft)",
                    padding: "4px",
                    borderRadius: "4px",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* خلاصه وضعیت با رنگ و متن */}
              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor: isOnlineAndShared
                    ? "rgba(34, 197, 94, 0.1)"
                    : isLocalFallback
                    ? "rgba(245, 158, 11, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                  border: `1px solid ${
                    isOnlineAndShared
                      ? "rgba(34, 197, 94, 0.3)"
                      : isLocalFallback
                      ? "rgba(245, 158, 11, 0.3)"
                      : "rgba(239, 68, 68, 0.3)"
                  }`,
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "20px" }}>
                  {isOnlineAndShared ? "✅" : isLocalFallback ? "⚠️" : "❌"}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13px" }}>
                    {isOnlineAndShared
                      ? "ارتباط مستقیم با سرور دپو برقرار است"
                      : isLocalFallback
                      ? "در حال استفاده از پایگاه داده محلی (حالت آفلاین)"
                      : "عدم دسترسی به پایگاه داده"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--ink-soft)", marginTop: "2px" }}>
                    {isOnlineAndShared
                      ? "تمام تغییرات شما مستقیماً در سرور مرکزی دپو ثبت و بین همه کاربران همگام می‌شود."
                      : "ارتباط با سرور متمرکز قطع است. عملیات به صورت محلی ذخیره شده و پس از برقراری ارتباط بر اساس زمان دقیق ثبت به صورت خودکار به سرور منتقل می‌گردد."}
                  </div>
                </div>
              </div>

              {/* وضعیت صف همگام‌سازی آفلاین */}
              {queueCount > 0 && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#b45309" }}>
                    <strong>{queueCount} مورد</strong> در زمان قطعی ثبت شده و منتظر همگام‌سازی با سرور است.
                  </div>
                  {isOnlineAndShared && (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => triggerSync(false)}
                      disabled={isSyncing}
                      style={{
                        backgroundColor: "#f59e0b",
                        color: "#fff",
                        border: "none",
                        fontSize: "11px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      {isSyncing ? "در حال ارسال..." : "همگام‌سازی اکنون"}
                    </button>
                  )}
                </div>
              )}

              {/* بازخورد همگام‌سازی */}
              {syncFeedback && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.2)",
                    color: "#15803d",
                    fontSize: "12px",
                    marginBottom: "16px",
                  }}
                >
                  {syncFeedback}
                </div>
              )}

              {/* مشخصات دقیق مسیرها و شبکه (ایمن‌سازی شده و بدون نشت مسیر خام) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  fontSize: "12px",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg)",
                  }}
                >
                  <span style={{ color: "var(--ink-soft)" }}>هدف شبکه:</span>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink)" }}>
                    {safeTargetName}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg)",
                  }}
                >
                  <span style={{ color: "var(--ink-soft)" }}>پایگاه داده جاری:</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: isOnlineAndShared ? "#16a34a" : "#d97706",
                    }}
                  >
                    {safeDatabaseName}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg)",
                  }}
                >
                  <span style={{ color: "var(--ink-soft)" }}>تاخیر پاسخگویی دیتابیس:</span>
                  <span style={{ fontWeight: 700, direction: "ltr" }}>
                    {status?.pingMs && status.pingMs > 0 ? `${status.pingMs} ms` : "—"}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg)",
                  }}
                >
                  <span style={{ color: "var(--ink-soft)" }}>روش استقرار شما:</span>
                  <span style={{ fontWeight: 600 }}>
                    {status?.isShared ? "متصل به سرور متمرکز دپو" : "مستقل روی سیستم محلی (آفلاین)"}
                  </span>
                </div>
              </div>

              {/* دکمه‌های عملیاتی */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn sm"
                  onClick={handleManualRefresh}
                  disabled={loading || isRefreshing}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      animation: loading || isRefreshing ? "spin 1s linear infinite" : "none",
                    }}
                  >
                    🔄
                  </span>
                  <span>{loading || isRefreshing ? "در حال بررسی..." : "بررسی مجدد اتصال"}</span>
                </button>
                <button
                  type="button"
                  className="btn sm primary"
                  onClick={() => setIsModalOpen(false)}
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
