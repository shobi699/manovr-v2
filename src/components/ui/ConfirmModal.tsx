"use client";

import React, { useEffect } from "react";
import { Warning, Trash, X } from "@phosphor-icons/react";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default" | "primary";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = "تأیید عملیات",
  message,
  confirmText = "تأیید و ادامه",
  cancelText = "انصراف",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  let confirmBg = "var(--accent)";
  let iconColor = "var(--accent)";
  let IconComp = Warning;

  if (variant === "danger") {
    confirmBg = "#ef4444";
    iconColor = "#ef4444";
    IconComp = Trash;
  } else if (variant === "warning") {
    confirmBg = "#f59e0b";
    iconColor = "#f59e0b";
    IconComp = Warning;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99998,
        padding: "16px",
      }}
      dir="rtl"
      onClick={() => !isLoading && onCancel()}
    >
      <div
        style={{
          backgroundColor: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "460px",
          boxShadow: "var(--sh-3)",
          overflow: "hidden",
          animation: "modalFadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 24px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "var(--panel-2)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <IconComp size={20} weight="bold" color={iconColor} />
            </div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--ink)" }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              background: "transparent",
              border: "none",
              cursor: isLoading ? "not-allowed" : "pointer",
              color: "var(--ink-faint)",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
            }}
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div style={{ padding: "24px", color: "var(--ink-soft)", fontSize: "14px", lineHeight: "1.8" }}>
          {message}
        </div>

        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "var(--panel-2)",
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: "8px 18px",
              borderRadius: "10px",
              fontSize: "13.5px",
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              backgroundColor: confirmBg,
              color: "#ffffff",
              border: "none",
              padding: "8px 20px",
              borderRadius: "10px",
              fontSize: "13.5px",
              fontWeight: "600",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isLoading ? "در حال پردازش..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
