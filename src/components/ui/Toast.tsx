"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle, WarningCircle, Warning, Info, X } from "@phosphor-icons/react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// رویداد سراسری برای مواقعی که هوک کانتکست در دسترس نیست
export function emitGlobalToast(message: string, type: ToastType = "info", duration = 4000) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("manovr:toast", { detail: { message, type, duration } }));
  }
}

export const toast = {
  success: (msg: string, duration = 4000) => emitGlobalToast(msg, "success", duration),
  error: (msg: string, duration = 5000) => emitGlobalToast(msg, "error", duration),
  warning: (msg: string, duration = 4500) => emitGlobalToast(msg, "warning", duration),
  info: (msg: string, duration = 4000) => emitGlobalToast(msg, "info", duration),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const custom = e as CustomEvent<{ message: string; type: ToastType; duration: number }>;
      if (custom.detail) {
        showToast(custom.detail.message, custom.detail.type, custom.detail.duration);
      }
    };

    window.addEventListener("manovr:toast", handleEvent);
    return () => window.removeEventListener("manovr:toast", handleEvent);
  }, [showToast]);

    const toastMethods = {
      success: (msg: string, duration?: number) => showToast(msg, "success", duration),
      error: (msg: string, duration?: number) => showToast(msg, "error", duration),
      warning: (msg: string, duration?: number) => showToast(msg, "warning", duration),
      info: (msg: string, duration?: number) => showToast(msg, "info", duration),
    };

    const contextValue: ToastContextType = {
      toast: toastMethods,
      ...toastMethods,
      showToast,
      dismissToast,
    };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Container */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          left: "24px",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "420px",
          width: "calc(100vw - 48px)",
          pointerEvents: "none",
        }}
        dir="rtl"
      >
        {toasts.map((t) => {
          let bg = "rgba(15, 23, 42, 0.92)";
          let border = "rgba(255, 255, 255, 0.12)";
          let iconColor = "var(--accent)";
          let IconComp = Info;

          if (t.type === "success") {
            bg = "rgba(6, 78, 59, 0.94)";
            border = "rgba(16, 185, 129, 0.35)";
            iconColor = "#34d399";
            IconComp = CheckCircle;
          } else if (t.type === "error") {
            bg = "rgba(127, 29, 29, 0.94)";
            border = "rgba(239, 68, 68, 0.4)";
            iconColor = "#f87171";
            IconComp = WarningCircle;
          } else if (t.type === "warning") {
            bg = "rgba(120, 53, 15, 0.94)";
            border = "rgba(245, 158, 11, 0.4)";
            iconColor = "#fbbf24";
            IconComp = Warning;
          }

          return (
            <div
              key={t.id}
              style={{
                pointerEvents: "auto",
                backgroundColor: bg,
                backdropFilter: "blur(12px)",
                border: `1px solid ${border}`,
                color: "#ffffff",
                padding: "12px 16px",
                borderRadius: "12px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                animation: "toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                fontSize: "13.5px",
                fontWeight: 500,
                lineHeight: "1.6",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                <IconComp size={22} weight="fill" color={iconColor} style={{ flexShrink: 0 }} />
                <span style={{ wordBreak: "break-word" }}>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.7)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                }}
                title="بستن"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // فالبک در صورت عدم وجود کانتکست
    return {
      toast,
      ...toast,
      showToast: (msg: string, type: ToastType = "info", duration = 4000) => emitGlobalToast(msg, type, duration),
      dismissToast: () => {},
    };
  }
  return context;
}
