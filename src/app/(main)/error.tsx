"use client";

import React, { useEffect } from "react";
import { Icons } from "@/lib/icons";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Application Crash Boundary]", error);
  }, [error]);

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: "480px",
          width: "100%",
          padding: "32px",
          textAlign: "center",
          borderRadius: "var(--r-lg)",
          backgroundColor: "var(--panel)",
          border: "1px solid var(--line)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            color: "#ef4444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Icons.Info size={32} />
        </div>

        <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px", color: "var(--ink)" }}>
          خطا در پردازش و بارگذاری داده‌ها
        </h2>

        <p style={{ fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.6, margin: "0 0 24px" }}>
          ارتباط با سرور متمرکز دپو با تأخیر یا اختلال موقت مواجه شده است. سیستم به منظور حفاظت از یکپارچگی اطلاعات از بروز خطا در داده‌ها جلوگیری کرد.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => reset()}
            className="btn btn-primary"
            style={{
              padding: "9px 20px",
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Icons.Refresh size={16} />
            تلاش مجدد و بارگذاری دوباره
          </button>

          <button
            onClick={() => (window.location.href = "/depot")}
            className="btn btn-ghost"
            style={{
              padding: "9px 18px",
              fontSize: "13px",
            }}
          >
            بازگشت به نمای پایانه
          </button>
        </div>
      </div>
    </div>
  );
}
