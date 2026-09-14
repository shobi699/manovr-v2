import React from "react";

export default function MainLoading() {
  return (
    <div
      dir="rtl"
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        width: "100%",
        animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    >
      {/* هدر اسکلتی */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ width: "180px", height: "24px", backgroundColor: "var(--line)", borderRadius: "var(--r-sm)" }} />
          <div style={{ width: "240px", height: "14px", backgroundColor: "var(--line-soft)", borderRadius: "var(--r-sm)" }} />
        </div>
        <div style={{ width: "120px", height: "36px", backgroundColor: "var(--line)", borderRadius: "var(--r-sm)" }} />
      </div>

      {/* کارت‌های آماری بالا */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: "20px",
              height: "100px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: "var(--panel)",
              border: "1px solid var(--line-soft)",
            }}
          >
            <div style={{ width: "40%", height: "14px", backgroundColor: "var(--line-soft)", borderRadius: "4px" }} />
            <div style={{ width: "60%", height: "28px", backgroundColor: "var(--line)", borderRadius: "4px" }} />
          </div>
        ))}
      </div>

      {/* بدنه اصلی جدول یا نمای پایانه */}
      <div
        className="card"
        style={{
          flex: 1,
          minHeight: "420px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          backgroundColor: "var(--panel)",
          border: "1px solid var(--line-soft)",
        }}
      >
        <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--line-soft)", paddingBottom: "14px" }}>
          <div style={{ width: "200px", height: "34px", backgroundColor: "var(--line)", borderRadius: "var(--r-sm)" }} />
          <div style={{ width: "120px", height: "34px", backgroundColor: "var(--line-soft)", borderRadius: "var(--r-sm)" }} />
        </div>

        {[1, 2, 3, 4, 5, 6].map((row) => (
          <div
            key={row}
            style={{
              height: "44px",
              width: "100%",
              backgroundColor: row % 2 === 0 ? "rgba(0,0,0,0.02)" : "transparent",
              borderRadius: "var(--r-sm)",
              display: "flex",
              alignItems: "center",
              gap: "20px",
              padding: "0 12px",
            }}
          >
            <div style={{ width: "30px", height: "14px", backgroundColor: "var(--line-soft)", borderRadius: "4px" }} />
            <div style={{ width: "140px", height: "14px", backgroundColor: "var(--line)", borderRadius: "4px" }} />
            <div style={{ width: "100px", height: "14px", backgroundColor: "var(--line-soft)", borderRadius: "4px" }} />
            <div style={{ flex: 1, height: "14px", backgroundColor: "var(--line-soft)", borderRadius: "4px" }} />
            <div style={{ width: "80px", height: "24px", backgroundColor: "var(--line)", borderRadius: "12px" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
