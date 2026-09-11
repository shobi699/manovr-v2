"use client";

import React, { useState, useTransition } from "react";
import { confirmManovr, finishManovr, deleteManovr } from "@/app/actions/manovr";
import { ManovrType, ManovrStatus, ConfirmationStatus } from "@/lib/enums";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface LookupValue {
  code: number;
  label: string;
  color: string | null;
}

interface ApprovalsPanelClientProps {
  initialManovrs: any[];
  manovrTypes: LookupValue[];
  manovrStatuses: LookupValue[];
  confirmationStatuses: LookupValue[];
}

import { useLiveRefresh } from "@/hooks/useLiveRefresh";

export default function ApprovalsPanelClient({
  initialManovrs,
  manovrTypes,
  manovrStatuses,
  confirmationStatuses,
}: ApprovalsPanelClientProps) {
  const [manovrs, setManovrs] = useState(initialManovrs);
  const [activeTab, setActiveTab] = useState<"pending" | "active" | "approved" | "rejected">("pending");
  const [isPending, startTransition] = useTransition();

  // فعال‌سازی رفرش زنده صفحه با دریافت اعلان تغییر مانور
  useLiveRefresh(["manovr_changed"]);

  // هلپرهای واکشی اطلاعات داینامیک یا فال‌بک به انوم‌های هاردکد شده
  const getManovrTypeLabel = (code: number) => {
    return manovrTypes.find((v) => v.code === code)?.label || ManovrType[code] || `مانور نوع ${code}`;
  };

  const getManovrTypeColor = (code: number) => {
    return manovrTypes.find((v) => v.code === code)?.color || "var(--accent)";
  };

  const getManovrStatusLabel = (code: number) => {
    return manovrStatuses.find((v) => v.code === code)?.label || ManovrStatus[code] || `وضعیت ${code}`;
  };

  const getConfirmationStatusLabel = (code: number) => {
    return confirmationStatuses.find((v) => v.code === code)?.label || ConfirmationStatus[code] || `نامشخص`;
  };

  const getConfirmationStatusColor = (code: number) => {
    const match = confirmationStatuses.find((v) => v.code === code);
    if (match?.color) return match.color;
    return code === 1 ? "#10b981" : code === 2 ? "var(--crit)" : "var(--accent)";
  };

  // فیلتر کردن مانورها بر اساس تب انتخابی
  const filteredManovrs = manovrs.filter((m) => {
    if (activeTab === "pending") {
      return m.confirmationStatus === 3; // منتظر تأیید
    }
    if (activeTab === "active") {
      return m.status === 1; // در حال اجرا (شروع شده)
    }
    if (activeTab === "approved") {
      return m.confirmationStatus === 1; // تأیید شده
    }
    if (activeTab === "rejected") {
      return m.confirmationStatus === 2; // رد شده
    }
    return true;
  });

  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "reject" | "finish" | "delete";
    id: number;
    title: string;
    message: string;
    confirmText: string;
    variant?: "danger" | "primary" | "default";
  } | null>(null);
  const { toast } = useToast();

  // انجام عملیات تأیید
  const handleApprove = (id: number) => {
    setConfirmAction({
      type: "approve",
      id,
      title: "تأیید نهایی مانور",
      message: "آیا از تأیید نهایی این مانور مطمئن هستید؟",
      confirmText: "تأیید مانور",
      variant: "primary",
    });
  };

  // انجام عملیات رد
  const handleReject = (id: number) => {
    setConfirmAction({
      type: "reject",
      id,
      title: "رد کردن مانور",
      message: "آیا از رد کردن این مانور مطمئن هستید؟",
      confirmText: "رد مانور",
      variant: "danger",
    });
  };

  // انجام عملیات اتمام و بستن مانور
  const handleFinish = (id: number) => {
    setConfirmAction({
      type: "finish",
      id,
      title: "اتمام و بستن مانور",
      message: "آیا از اتمام و بستن این مانور مطمئن هستید؟",
      confirmText: "بستن مانور",
      variant: "primary",
    });
  };

  // انجام عملیات حذف مانور
  const handleDelete = (id: number) => {
    setConfirmAction({
      type: "delete",
      id,
      title: "حذف مانور",
      message: "آیا از حذف این مانور مطمئن هستید؟ (حذف نرم)",
      confirmText: "حذف مانور",
      variant: "danger",
    });
  };

  const handleExecuteConfirm = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;

    startTransition(async () => {
      if (type === "approve") {
        const res = await confirmManovr(id, 1);
        if (res.ok) {
          toast.success("مانور با موفقیت تأیید شد.");
          setManovrs((prev) =>
            prev.map((m) => (m.id === id ? { ...m, confirmationStatus: 1 } : m))
          );
        } else {
          toast.error(res.error || "خطا در تایید مانور");
        }
      } else if (type === "reject") {
        const res = await confirmManovr(id, 2);
        if (res.ok) {
          toast.success("مانور با موفقیت رد شد.");
          setManovrs((prev) =>
            prev.map((m) => (m.id === id ? { ...m, confirmationStatus: 2 } : m))
          );
        } else {
          toast.error(res.error || "خطا در رد مانور");
        }
      } else if (type === "finish") {
        const res = await finishManovr(id);
        if (res.ok) {
          toast.success("مانور با موفقیت بسته شد.");
          setManovrs((prev) =>
            prev.map((m) => (m.id === id ? { ...m, status: 2, finishedAt: new Date().toISOString() } : m))
          );
        } else {
          toast.error(res.error || "خطا در بستن مانور");
        }
      } else if (type === "delete") {
        const res = await deleteManovr(id);
        if (res.ok) {
          toast.success("مانور با موفقیت حذف شد.");
          setManovrs((prev) => prev.filter((m) => m.id !== id));
        } else {
          toast.error(res.error || "خطا در حذف مانور");
        }
      }
      setConfirmAction(null);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* تب‌های انتخاب وضعیت مانور */}
      <div 
        style={{ 
          display: "flex", 
          gap: "12px", 
          borderBottom: "1px solid var(--line)", 
          paddingBottom: "12px",
          overflowX: "auto"
        }}
      >
        {[
          { id: "pending", label: "⏳ منتظر تأیید مسئول شیفت", color: "var(--accent)" },
          { id: "active", label: "🟢 مانورهای در حال اجرا (فعال)", color: "#10b981" },
          { id: "approved", label: "✅ مانورهای تأیید شده", color: "#10b981" },
          { id: "rejected", label: "❌ مانورهای رد شده", color: "var(--crit)" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const count = manovrs.filter((m) => {
            if (tab.id === "pending") return m.confirmationStatus === 3;
            if (tab.id === "active") return m.status === 1;
            if (tab.id === "approved") return m.confirmationStatus === 1;
            if (tab.id === "rejected") return m.confirmationStatus === 2;
            return false;
          }).length;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`btn ${isActive ? "primary" : ""}`}
              style={{
                borderRadius: "9px",
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: isActive ? "1px solid " + tab.color : "1px solid var(--line)",
                background: isActive ? "rgba(30,41,59,0.5)" : "transparent",
                color: isActive ? "#fff" : "var(--ink-soft)",
              }}
            >
              <span>{tab.label}</span>
              <span 
                style={{ 
                  backgroundColor: isActive ? tab.color : "var(--panel-2)", 
                  color: isActive ? "var(--bg)" : "var(--ink)",
                  padding: "2px 8px", 
                  borderRadius: "20px", 
                  fontSize: "11px",
                  fontWeight: "bold"
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* لیست کارت‌های مانور */}
      {filteredManovrs.length === 0 ? (
        <div 
          className="card" 
          style={{ 
            padding: "48px", 
            textAlign: "center", 
            background: "var(--panel)", 
            color: "var(--ink-soft)" 
          }}
        >
          <span style={{ fontSize: "36px" }}>🔍</span>
          <p style={{ marginTop: "12px", fontSize: "14px" }}>ہیچ مانوری در این دسته یافت نشد.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
          {filteredManovrs.map((m) => {
            const dateStr = m.executionTime
              ? new Date(m.executionTime).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", calendar: "persian" })
              : new Date(m.createdAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", calendar: "persian" });

            return (
              <div 
                key={m.id} 
                className="card" 
                style={{ 
                  borderRadius: "12px", 
                  background: "var(--panel)", 
                  border: "1px solid var(--line)", 
                  display: "flex", 
                  flexDirection: "column",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  overflow: "hidden"
                }}
              >
                {/* بخش بالایی کارت */}
                <div 
                  style={{ 
                    padding: "14px 18px", 
                    borderBottom: "1px solid var(--line)",
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    backgroundColor: "rgba(30,41,59,0.2)"
                  }}
                >
                  <span style={{ fontWeight: "bold", fontSize: "14px", color: getManovrTypeColor(m.type) }}>
                    {getManovrTypeLabel(m.type)}
                  </span>
                  <span 
                    style={{ 
                      fontSize: "11px", 
                      padding: "3px 8px", 
                      borderRadius: "6px",
                      backgroundColor: m.status === 1 ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.15)",
                      color: m.status === 1 ? "#10b981" : "var(--ink-soft)",
                      fontWeight: "bold"
                    }}
                  >
                    {getManovrStatusLabel(m.status)}
                  </span>
                </div>

                {/* اطلاعات تفصیلی */}
                <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <span className="muted" style={{ fontSize: "11px", display: "block" }}>🚆 ناوگان / قطار:</span>
                      <b style={{ fontSize: "13px" }}>قطار {m.train?.code || "—"}</b>
                    </div>
                    <div>
                      <span className="muted" style={{ fontSize: "11px", display: "block" }}>👤 راهبر عملیات:</span>
                      <b style={{ fontSize: "13px" }}>
                        {m.rahbar1 ? `${m.rahbar1.firstName} ${m.rahbar1.lastName}` : "—"}
                      </b>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <span className="muted" style={{ fontSize: "11px", display: "block" }}>📍 مبدأ حرکت:</span>
                      <b style={{ fontSize: "13px", color: "#f43f5e" }}>{m.sourceLine?.name || "—"}</b>
                    </div>
                    <div>
                      <span className="muted" style={{ fontSize: "11px", display: "block" }}>🏁 مقصد مانور:</span>
                      <b style={{ fontSize: "13px", color: "#10b981" }}>{m.destinationLine?.name || "—"}</b>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", borderTop: "1px dashed var(--line)", paddingTop: "8px" }}>
                    <div>
                      <span className="muted" style={{ fontSize: "11px", display: "block" }}>📅 زمان اجرا (واقعی):</span>
                      <span className="num" style={{ fontSize: "12px" }}>{dateStr}</span>
                    </div>
                    <div>
                      <span className="muted" style={{ fontSize: "11px", display: "block" }}>👤 ثبت کننده سند:</span>
                      <span style={{ fontSize: "12px" }}>
                        {m.creator ? `${m.creator.firstName} ${m.creator.lastName}` : "سیستم"}
                      </span>
                    </div>
                  </div>

                  {m.description && (
                    <div style={{ backgroundColor: "var(--panel-2)", padding: "8px 12px", borderRadius: "6px", fontSize: "12px" }}>
                      <span className="muted" style={{ display: "block", fontSize: "10px", marginBottom: "2px" }}>توضیحات:</span>
                      <span>{m.description}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginTop: "4px" }}>
                    <span className="muted">وضعیت تاییدیه:</span>
                    <span 
                      style={{ 
                        fontWeight: "bold",
                        color: getConfirmationStatusColor(m.confirmationStatus)
                      }}
                    >
                      {getConfirmationStatusLabel(m.confirmationStatus)}
                    </span>
                  </div>
                </div>

                {/* اقدامات سریع مسئول شیفت */}
                <div 
                  style={{ 
                    padding: "12px 18px", 
                    backgroundColor: "rgba(30,41,59,0.3)", 
                    borderTop: "1px solid var(--line)", 
                    display: "flex", 
                    gap: "8px",
                    justifyContent: "flex-end"
                  }}
                >
                  {/* دکمه‌های تایید و رد (اگر تایید نشده باشند) */}
                  {m.confirmationStatus === 3 && (
                    <>
                      <button 
                        onClick={() => handleApprove(m.id)} 
                        disabled={isPending}
                        className="btn sm"
                        style={{ backgroundColor: "#10b981", color: "var(--bg)", borderColor: "transparent", fontWeight: "bold" }}
                      >
                        ✅ تأیید مانور
                      </button>
                      <button 
                        onClick={() => handleReject(m.id)} 
                        disabled={isPending}
                        className="btn sm"
                        style={{ backgroundColor: "var(--crit)", color: "#fff", borderColor: "transparent", fontWeight: "bold" }}
                      >
                        ❌ رد مانور
                      </button>
                    </>
                  )}

                  {/* دکمه اتمام (اگر شروع شده باشد) */}
                  {m.status === 1 && (
                    <button 
                      onClick={() => handleFinish(m.id)} 
                      disabled={isPending}
                      className="btn sm outline"
                      style={{ fontWeight: "bold" }}
                    >
                      ⏹ بستن مانور
                    </button>
                  )}

                  {/* دکمه حذف */}
                  <button 
                    onClick={() => handleDelete(m.id)} 
                    disabled={isPending}
                    className="btn sm outline"
                    style={{ color: "var(--crit)", borderColor: "transparent", marginInlineStart: "auto" }}
                  >
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.title ?? "تأیید عملیات"}
        message={confirmAction?.message ?? ""}
        confirmText={confirmAction?.confirmText ?? "تأیید"}
        cancelText="انصراف"
        variant={confirmAction?.variant ?? "primary"}
        isLoading={isPending}
        onConfirm={handleExecuteConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
