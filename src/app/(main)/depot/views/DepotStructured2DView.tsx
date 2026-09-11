"use client";

import React from "react";
import { STATUS_STYLE } from "@/lib/depot-visuals";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { LineData } from "../types";
import { Depot2DViewProps, getPersianLineTitle } from "./depotViewUtils";

export default function DepotStructured2DView({
  lines,
  trains,
  canCreateManovr,
  canManageLines,
  isFocusMode,
  theme,
  onSelectLine,
  onSelectTrain,
  onDropTrainToLine,
  onSelectEmptySlot,
}: Depot2DViewProps) {
  // تابع کمکی برای رندر خانه‌های ریل در نمای بنتو
  const renderBentoSlot = (line: LineData) => {
    const label = getPersianLineTitle(line);
    const lineTrains = trains
      .filter((t) => t.lineId === line.id && !t.isDisposed)
      .sort((a, b) => a.slotIndex - b.slotIndex);
    const hasTrain = lineTrains.length > 0;
    const train = lineTrains[0];
    const style = hasTrain ? STATUS_STYLE[train.status] || STATUS_STYLE[1] : null;
    const isActive = (line as any).isActive !== false;

    if (!isActive) {
      return (
        <div
          key={line.id}
          onClick={() => {
            if (canManageLines) {
              onSelectLine(line);
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isFocusMode ? "4px 8px" : "6px 12px",
            border: "1px dashed var(--crit)",
            borderRadius: "var(--r-sm)",
            backgroundColor: "color-mix(in oklab, var(--crit) 8%, var(--bg))",
            color: "var(--crit)",
            cursor: canManageLines ? "pointer" : "not-allowed",
            minHeight: isFocusMode ? undefined : "38px",
            flexGrow: isFocusMode ? 1 : 0,
            flexShrink: 1,
            flexBasis: isFocusMode ? 0 : "auto",
            opacity: 0.75,
            textDecoration: "line-through",
          }}
          title="این خط توسط مدیر مسدود/غیرفعال شده است"
        >
          <span style={{ fontSize: isFocusMode ? "10px" : "11px", fontWeight: "600" }}>{label} (مسدود)</span>
          <span style={{ fontSize: "12px" }}>🚫</span>
        </div>
      );
    }

    return (
      <div
        key={line.id}
        onClick={() => onSelectLine(line)}
        draggable={hasTrain && canCreateManovr}
        onDragStart={(e) => {
          if (hasTrain && canCreateManovr) {
            e.dataTransfer.setData("trainId", String(train.id));
            e.currentTarget.style.opacity = "0.5";
          }
        }}
        onDragEnd={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onDragOver={(e) => {
          if (canCreateManovr) {
            e.preventDefault();
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.backgroundColor = "var(--accent-soft)";
          }
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = style ? style.border : "var(--line)";
          e.currentTarget.style.backgroundColor = style ? style.bg : "color-mix(in oklab, var(--bg) 60%, var(--panel))";
        }}
        onDrop={(e) => {
          if (!canCreateManovr) return;
          e.preventDefault();
          const trIdStr = e.dataTransfer.getData("trainId");
          if (!trIdStr) return;
          e.currentTarget.style.borderColor = style ? style.border : "var(--line)";
          e.currentTarget.style.backgroundColor = style ? style.bg : "color-mix(in oklab, var(--bg) 60%, var(--panel))";
          onDropTrainToLine(Number(trIdStr), line);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isFocusMode ? "4px 8px" : "6px 12px",
          border: `1px solid ${style ? style.border : "var(--line)"}`,
          borderRadius: "var(--r-sm)",
          backgroundColor: style ? style.bg : "color-mix(in oklab, var(--bg) 60%, var(--panel))",
          color: style ? style.text : "var(--ink)",
          cursor: "pointer",
          minHeight: isFocusMode ? undefined : "38px",
          flexGrow: isFocusMode ? 1 : 0,
          flexShrink: 1,
          flexBasis: isFocusMode ? 0 : "auto",
          transition: "var(--transition-fluid)",
          boxShadow: style ? "var(--sh-1)" : "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.transform = "scale(1.02)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = style ? style.border : "var(--line)";
          e.currentTarget.style.backgroundColor = style ? style.bg : "color-mix(in oklab, var(--bg) 60%, var(--panel))";
          e.currentTarget.style.transform = "none";
        }}
      >
        <span style={{ fontSize: isFocusMode ? "10px" : "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{label}</span>
        {hasTrain ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isFocusMode ? "4px" : "6px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              maxWidth: "70%",
            }}
          >
            {lineTrains.map((tr) => {
              const trStyle = STATUS_STYLE[tr.status] || STATUS_STYLE[1];
              return (
                <div
                  key={tr.id}
                  title={`قطار ${tr.code} (${trStyle.label})${tr.hasKafshak ? " - ⚡ وجود کفشک" : ""}${tr.noAtp ? " - 🚨 عدم ATP" : ""}${tr.movadDavvar ? ` - 🔄 موعد دوار ${tr.movadDavvar}` : ""}${tr.noLicense ? " - 🛑 بدون مجوز" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: isFocusMode ? "3px" : "4px",
                    fontWeight: "bold",
                    fontSize: isFocusMode ? "10px" : "11px",
                    padding: isFocusMode ? "1px 5px" : "2px 6px",
                    borderRadius: "4px",
                    backgroundColor: trStyle?.badge,
                    color: "#ffffff",
                  }}
                  className="num"
                >
                  <trStyle.IconComp size={11} weight="bold" />
                  <span>{tr.code}</span>
                  {tr.hasKafshak && <span title="وجود کفشک" style={{ fontSize: "10px" }}>⚡</span>}
                  {tr.noAtp && <span title="عدم ATP" style={{ fontSize: "10px" }}>🚨</span>}
                  {tr.movadDavvar && (
                    <span
                      title={`موعد دوّار سطح ${tr.movadDavvar}`}
                      style={{
                        fontSize: "9px",
                        padding: "0 3px",
                        borderRadius: "3px",
                        backgroundColor: tr.movadDavvar === "A" ? "#8b5cf6" : tr.movadDavvar === "B" ? "#14b8a6" : "#f59e0b",
                        color: "#ffffff",
                        lineHeight: "1.2",
                      }}
                    >
                      🔄{tr.movadDavvar}
                    </span>
                  )}
                  {tr.noLicense && <span title="بدون مجوز حرکت" style={{ fontSize: "10px" }}>🛑</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <span style={{ fontSize: "11px", color: "var(--ink-faint)" }}>—</span>
        )}
      </div>
    );
  };

  // تابع کمکی رندر ریل‌های افقی برای پارکینگ شمالی و جنوبی
  const renderHorizontalParkingLines = (termCode: number) => {
    const termLines = lines.filter((l) => l.terminal === termCode).sort((a, b) => a.id - b.id);
    if (termLines.length === 0) {
      return (
        <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "4px" }}>
          هیچ ریلی ثبت نشده است.
        </div>
      );
    }

    return (
      <div style={{ display: "flex", gap: isFocusMode ? "3px" : "6px", overflow: "hidden", width: "100%" }}>
        {termLines.map((line) => {
          const lineTrains = trains
            .filter((t) => t.lineId === line.id && !t.isDisposed)
            .sort((a, b) => a.slotIndex - b.slotIndex);
          const isActive = (line as any).isActive !== false;
          const rawLabel = line.tag || line.name;
          const digitOnly = rawLabel.replace(/[^\d۰-۹]/g, "");
          const lineNumDisplay = digitOnly || rawLabel;

          return (
            <div
              key={line.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: isFocusMode ? "1px" : "2px",
                padding: isFocusMode ? "2px 3px" : "4px 6px",
                borderRadius: "var(--r-sm)",
                backgroundColor: "color-mix(in oklab, var(--bg) 45%, var(--panel))",
                border: `1px solid ${isActive ? "var(--line)" : "var(--crit-soft)"}`,
                opacity: isActive ? 1 : 0.65,
                flex: 1,
                minWidth: 0,
                transition: "var(--transition-fluid)",
              }}
            >
              {/* سطر ۱: شماره خط */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  borderBottom: "1px solid var(--line-soft)",
                  paddingBottom: "2px",
                  cursor: "pointer",
                }}
                onClick={() => onSelectLine(line)}
              >
                <span style={{ fontSize: isFocusMode ? "9px" : "11px", fontWeight: "bold", color: "var(--ink)", whiteSpace: "nowrap" }}>
                  {lineNumDisplay}
                </span>
              </div>

              {/* سطر ۲: قطارهای مستقر و اسلات‌های خالی */}
              <div style={{ display: "flex", gap: "2px", alignItems: "center", width: "100%" }}>
                {Array.from({ length: line.capacity }).map((_, slotIdx) => {
                  const train = lineTrains.find((t) => t.slotIndex === slotIdx);
                  if (train) {
                    const trStyle = STATUS_STYLE[train.status] || STATUS_STYLE[1];
                    return (
                      <div
                        key={train.id}
                        draggable={canCreateManovr}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("trainId", String(train.id));
                          e.currentTarget.style.opacity = "0.5";
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.style.opacity = "1";
                        }}
                        onClick={() => onSelectTrain(train)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: isFocusMode ? "30px" : "36px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "1px",
                          padding: "2px 2px",
                          borderRadius: "4px",
                          backgroundColor: trStyle.badge,
                          color: "#ffffff",
                          cursor: "pointer",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          transition: "transform 0.15s ease",
                          userSelect: "none",
                          border: "1px solid rgba(255,255,255,0.3)",
                          overflow: "hidden",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.06)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "none";
                        }}
                        title={`قطار ${train.code} (${trStyle.label})${train.hasKafshak ? " - ⚡ وجود کفشک" : ""}${train.noAtp ? " - 🚨 عدم ATP" : ""}${train.movadDavvar ? ` - 🔄 موعد دوار ${train.movadDavvar}` : ""}${train.noLicense ? " - 🛑 بدون مجوز" : ""}`}
                      >
                        <span style={{ fontWeight: "bold", fontSize: "10.5px", lineHeight: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {train.code}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2px", width: "100%", overflow: "hidden" }}>
                          <span style={{ display: "inline-flex", alignItems: "center" }}>
                            <trStyle.IconComp size={9} weight="bold" />
                          </span>
                          {train.hasKafshak && <span title="وجود کفشک" style={{ fontSize: "7.5px" }}>⚡</span>}
                          {train.noAtp && <span title="عدم ATP" style={{ fontSize: "7.5px" }}>🚨</span>}
                          {train.movadDavvar && (
                            <span
                              title={`موعد دوّار سطح ${train.movadDavvar}`}
                              style={{
                                fontSize: "7px",
                                padding: "0 1.5px",
                                borderRadius: "2px",
                                backgroundColor: train.movadDavvar === "A" ? "#8b5cf6" : train.movadDavvar === "B" ? "#14b8a6" : "#f59e0b",
                                color: "#ffffff",
                                lineHeight: "1",
                              }}
                            >
                              🔄{train.movadDavvar}
                            </span>
                          )}
                          {train.noLicense && <span title="بدون مجوز حرکت" style={{ fontSize: "7.5px" }}>🛑</span>}
                        </div>
                      </div>
                    );
                  }

                  // اسلات خالی ریل
                  return (
                    <div
                      key={slotIdx}
                      onClick={() => {
                        if (canCreateManovr && onSelectEmptySlot) {
                          onSelectEmptySlot(null, line.id, slotIdx);
                        }
                      }}
                      onDragOver={(e) => {
                        if (canCreateManovr) {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = "var(--accent)";
                          e.currentTarget.style.backgroundColor = "var(--accent-soft)";
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--line-soft)";
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                      onDrop={(e) => {
                        if (!canCreateManovr) return;
                        e.preventDefault();
                        const trIdStr = e.dataTransfer.getData("trainId");
                        if (!trIdStr) return;
                        onDropTrainToLine(Number(trIdStr), line, slotIdx);
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: isFocusMode ? "30px" : "36px",
                        borderRadius: "4px",
                        border: "1px dashed var(--line)",
                        fontSize: "10px",
                        color: "var(--ink-faint)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: canCreateManovr ? "pointer" : "default",
                        transition: "var(--transition-fluid)",
                        backgroundColor: "rgba(0,0,0,0.02)",
                      }}
                    >
                      —
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const mainLines = lines.filter((l) => l.terminal === 3);
  const otherLines = lines.filter((l) => l.terminal === 8);
  const aliabadLines = lines.filter((l) => l.terminal === 9 || l.name.includes("علی‌آباد") || l.name.includes("علی اباد"));
  const sub1Lines = lines.filter((l) => l.terminal === 6);
  const sub2Lines = lines.filter((l) => l.terminal === 7);
  const wagonLines = lines.filter((l) => l.terminal === 2);
  const dieselLines = lines.filter((l) => l.terminal === 1);

  return (
    <div
      style={{
        height: isFocusMode ? "100vh" : "calc(100vh - 105px)",
        maxHeight: isFocusMode ? "100vh" : "calc(100vh - 105px)",
        width: "100%",
        overflow: "hidden",
        padding: isFocusMode ? "4px 6px" : "6px 10px",
        backgroundColor: theme === "dark" ? "#070a12" : "#f1f5f9",
        display: "flex",
        flexDirection: "column",
        gap: isFocusMode ? "2px" : "4px",
      }}
    >
      {/* راهنمای وضعیت قطارها */}
      {!isFocusMode && (
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            padding: "4px 10px",
            backgroundColor: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-sm)",
            boxShadow: "var(--sh-1)",
            fontSize: "10px",
            fontWeight: "600",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <span style={{ color: "var(--ink-soft)" }}>وضعیت ناوگان:</span>
          {Object.entries(STATUS_STYLE).map(([code, style]) => (
            <div key={code} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <span style={{ color: style.text, display: "inline-flex" }}>
                <style.IconComp size={11} weight="bold" />
              </span>
              <span
                style={{
                  fontWeight: "bold",
                  padding: "0 5px",
                  borderRadius: "3px",
                  backgroundColor: style.bg,
                  color: style.text,
                  border: `1px solid ${style.border}`,
                  fontSize: "9.5px",
                }}
              >
                {style.label}
              </span>
            </div>
          ))}

          <span style={{ color: "var(--ink-faint)", margin: "0 2px" }}>|</span>
          <span style={{ color: "var(--ink-soft)" }}>علائم:</span>
          <span style={{ padding: "0 4px", borderRadius: "2px", backgroundColor: "#f59e0b", color: "#fff", fontSize: "9px" }}>
            ⚡ کفشک
          </span>
          <span style={{ padding: "0 4px", borderRadius: "2px", backgroundColor: "#ef4444", color: "#fff", fontSize: "9px" }}>
            🚨 عدم ATP
          </span>
          <span style={{ padding: "0 4px", borderRadius: "2px", backgroundColor: "#8b5cf6", color: "#fff", fontSize: "9px" }}>
            🔄 دوار A/B/C
          </span>
          <span style={{ padding: "0 4px", borderRadius: "2px", backgroundColor: "#be123c", color: "#fff", fontSize: "9px" }}>
            🛑 بدون مجوز
          </span>
        </div>
      )}

      {/* ۱. پارکینگ شمالی */}
      <BorderRotate
        gradientColors={{ primary: "#3b82f6", secondary: "#60a5fa", accent: "#93c5fd" }}
        backgroundColor="var(--panel)"
        borderRadius={8}
        borderWidth={1}
        animationSpeed={8}
        style={{ boxShadow: "var(--sh-1)", flexShrink: isFocusMode ? 1 : 0, overflow: "hidden" }}
      >
        <div style={{ padding: isFocusMode ? "2px 4px" : "4px 8px", display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line-soft)", paddingBottom: "1px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: "bold", fontSize: isFocusMode ? "9px" : "11px", color: "var(--ink)" }}>
              <span>🅿️</span>
              <span>پارکینگ شمالی</span>
            </div>
            <span className="pill p-accent" style={{ fontSize: "9px", padding: "0 6px" }}>
              مستقر: {trains.filter((t) => lines.filter((l) => l.terminal === 4).some((l) => l.id === t.lineId) && !t.isDisposed).length} قطار
            </span>
          </div>
          <div style={{ display: "flex", width: "100%", overflow: "hidden" }}>
            {renderHorizontalParkingLines(4)}
          </div>
        </div>
      </BorderRotate>

      {/* ۲. پارکینگ جنوبی */}
      <BorderRotate
        gradientColors={{ primary: "#06b6d4", secondary: "#22d3ee", accent: "#67e8f9" }}
        backgroundColor="var(--panel)"
        borderRadius={8}
        borderWidth={1}
        animationSpeed={8}
        style={{ boxShadow: "var(--sh-1)", flexShrink: isFocusMode ? 1 : 0, overflow: "hidden" }}
      >
        <div style={{ padding: isFocusMode ? "2px 4px" : "4px 8px", display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line-soft)", paddingBottom: "1px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: "bold", fontSize: isFocusMode ? "9px" : "11px", color: "var(--ink)" }}>
              <span>🅿️</span>
              <span>پارکینگ جنوبی</span>
            </div>
            <span className="pill p-accent" style={{ fontSize: "9px", padding: "0 6px" }}>
              مستقر: {trains.filter((t) => lines.filter((l) => l.terminal === 5).some((l) => l.id === t.lineId) && !t.isDisposed).length} قطار
            </span>
          </div>
          <div style={{ display: "flex", width: "100%", overflow: "hidden" }}>
            {renderHorizontalParkingLines(5)}
          </div>
        </div>
      </BorderRotate>

      {/* ۳. گرید ۵ ستونی بنتو */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: isFocusMode ? "3px" : "6px",
          direction: "rtl",
          overflow: "hidden",
        }}
      >
        {/* ستون ۱ (راست): خط اصلی */}
        <BorderRotate
          gradientColors={{ primary: "#64748b", secondary: "#94a3b8", accent: "#cbd5e1" }}
          backgroundColor="var(--panel)"
          borderRadius={8}
          borderWidth={1}
          animationSpeed={8}
          style={{ boxShadow: "var(--sh-1)", overflow: "hidden" }}
        >
          <div style={{ padding: isFocusMode ? "2px" : "4px", display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", height: "100%", overflow: "hidden" }}>
            <div style={{ fontWeight: "bold", fontSize: isFocusMode ? "10px" : "10.5px", color: "var(--ink)", textAlign: "center", borderBottom: "1px solid var(--line-soft)", paddingBottom: "1px", flexShrink: 0 }}>
              🚉 خط اصلی ({mainLines.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", flex: 1, minHeight: 0, overflow: "hidden", paddingLeft: "2px" }}>
              {mainLines.map((l) => renderBentoSlot(l))}
              {mainLines.length === 0 && (
                <div style={{ fontSize: "9px", color: "var(--ink-faint)", textAlign: "center", padding: "4px" }}>بدون ریل</div>
              )}
            </div>
          </div>
        </BorderRotate>

        {/* ستون ۲: سایر خطوط (بالا) + پایانه علی‌آباد (پایین) */}
        <div style={{ display: "flex", flexDirection: "column", gap: isFocusMode ? "2px" : "4px", height: "100%", overflow: "hidden" }}>
          <BorderRotate
            gradientColors={{ primary: "#475569", secondary: "#64748b", accent: "#94a3b8" }}
            backgroundColor="var(--panel)"
            borderRadius={8}
            borderWidth={1}
            animationSpeed={8}
            style={{ boxShadow: "var(--sh-1)", flex: "1 1 50%", minHeight: 0, overflow: "hidden" }}
          >
            <div style={{ padding: isFocusMode ? "2px" : "4px", display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", height: "100%", overflow: "hidden" }}>
              <div style={{ fontWeight: "bold", fontSize: isFocusMode ? "10px" : "10.5px", color: "var(--ink)", textAlign: "center", borderBottom: "1px solid var(--line-soft)", paddingBottom: "1px", flexShrink: 0 }}>
                📋 سایر ({otherLines.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", flex: 1, minHeight: 0, overflow: "hidden", paddingLeft: "2px" }}>
                {otherLines.map((l) => renderBentoSlot(l))}
              </div>
            </div>
          </BorderRotate>
          <BorderRotate
            gradientColors={{ primary: "#0f766e", secondary: "#14b8a6", accent: "#5eead4" }}
            backgroundColor="var(--panel)"
            borderRadius={8}
            borderWidth={1}
            animationSpeed={8}
            style={{ boxShadow: "var(--sh-1)", flex: "1 1 50%", minHeight: 0, overflow: "hidden" }}
          >
            <div style={{ padding: isFocusMode ? "2px" : "4px", display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", height: "100%", overflow: "hidden" }}>
              <div style={{ fontWeight: "bold", fontSize: isFocusMode ? "10px" : "10.5px", color: "var(--ink)", textAlign: "center", borderBottom: "1px solid var(--line-soft)", paddingBottom: "1px", flexShrink: 0 }}>
                📍 علی‌آباد ({aliabadLines.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", flex: 1, minHeight: 0, overflow: "hidden", paddingLeft: "2px" }}>
                {aliabadLines.map((l) => renderBentoSlot(l))}
              </div>
            </div>
          </BorderRotate>
        </div>

        {/* ستون ۳: خطوط فرعی ۱ و ۲ */}
        <div style={{ display: "flex", flexDirection: "column", gap: isFocusMode ? "2px" : "4px", height: "100%", overflow: "hidden" }}>
          <BorderRotate
            gradientColors={{ primary: "#854d0e", secondary: "#ca8a04", accent: "#fde047" }}
            backgroundColor="var(--panel)"
            borderRadius={8}
            borderWidth={1}
            animationSpeed={8}
            style={{ boxShadow: "var(--sh-1)", flex: "1 1 50%", minHeight: 0, overflow: "hidden" }}
          >
            <div style={{ padding: isFocusMode ? "2px" : "4px", display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", height: "100%", overflow: "hidden" }}>
              <div style={{ fontWeight: "bold", fontSize: isFocusMode ? "10px" : "10.5px", color: "var(--ink)", textAlign: "center", borderBottom: "1px solid var(--line-soft)", paddingBottom: "1px", flexShrink: 0 }}>
                🛤️ فرعی ۱ ({sub1Lines.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", flex: 1, minHeight: 0, overflow: "hidden", paddingLeft: "2px" }}>
                {sub1Lines.map((l) => renderBentoSlot(l))}
              </div>
            </div>
          </BorderRotate>
          <BorderRotate
            gradientColors={{ primary: "#a16207", secondary: "#eab308", accent: "#fef08a" }}
            backgroundColor="var(--panel)"
            borderRadius={8}
            borderWidth={1}
            animationSpeed={8}
            style={{ boxShadow: "var(--sh-1)", flex: "1 1 50%", minHeight: 0, overflow: "hidden" }}
          >
            <div style={{ padding: isFocusMode ? "2px" : "4px", display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", height: "100%", overflow: "hidden" }}>
              <div style={{ fontWeight: "bold", fontSize: isFocusMode ? "10px" : "10.5px", color: "var(--ink)", textAlign: "center", borderBottom: "1px solid var(--line-soft)", paddingBottom: "1px", flexShrink: 0 }}>
                🛤️ فرعی ۲ ({sub2Lines.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", flex: 1, minHeight: 0, overflow: "hidden", paddingLeft: "2px" }}>
                {sub2Lines.map((l) => renderBentoSlot(l))}
              </div>
            </div>
          </BorderRotate>
        </div>

        {/* ستون ۴: واگن‌شاپ */}
        <BorderRotate
          gradientColors={{ primary: "#7c3aed", secondary: "#8b5cf6", accent: "#c4b5fd" }}
          backgroundColor="var(--panel)"
          borderRadius={8}
          borderWidth={1}
          animationSpeed={8}
          style={{ boxShadow: "var(--sh-1)", overflow: "hidden" }}
        >
          <div style={{ padding: isFocusMode ? "2px" : "4px", display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", height: "100%", overflow: "hidden" }}>
            <div style={{ fontWeight: "bold", fontSize: isFocusMode ? "10px" : "10.5px", color: "var(--ink)", textAlign: "center", borderBottom: "1px solid var(--line-soft)", paddingBottom: "1px", flexShrink: 0 }}>
              🏗️ واگن‌شاپ ({wagonLines.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", flex: 1, minHeight: 0, overflow: "hidden", paddingLeft: "2px" }}>
              {wagonLines.map((l) => renderBentoSlot(l))}
              {wagonLines.length === 0 && (
                <div style={{ fontSize: "9px", color: "var(--ink-faint)", textAlign: "center", padding: "4px" }}>بدون ریل</div>
              )}
            </div>
          </div>
        </BorderRotate>

        {/* ستون ۵ (چپ): دیزل‌شاپ */}
        <BorderRotate
          gradientColors={{ primary: "#ef4444", secondary: "#f87171", accent: "#fca5a5" }}
          backgroundColor="var(--panel)"
          borderRadius={8}
          borderWidth={1}
          animationSpeed={8}
          style={{ boxShadow: "var(--sh-1)", overflow: "hidden" }}
        >
          <div style={{ padding: isFocusMode ? "2px" : "4px", display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", height: "100%", overflow: "hidden" }}>
            <div style={{ fontWeight: "bold", fontSize: isFocusMode ? "10px" : "10.5px", color: "var(--ink)", textAlign: "center", borderBottom: "1px solid var(--line-soft)", paddingBottom: "1px", flexShrink: 0 }}>
              🚂 دیزل‌شاپ ({dieselLines.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: isFocusMode ? "1px" : "3px", flex: 1, minHeight: 0, overflow: "hidden", paddingLeft: "2px" }}>
              {dieselLines.map((l) => renderBentoSlot(l))}
              {dieselLines.length === 0 && (
                <div style={{ fontSize: "9px", color: "var(--ink-faint)", textAlign: "center", padding: "4px" }}>بدون ریل</div>
              )}
            </div>
          </div>
        </BorderRotate>
      </div>
    </div>
  );
}
