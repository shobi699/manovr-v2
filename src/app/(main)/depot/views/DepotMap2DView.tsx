"use client";

import React from "react";
import { STATUS_STYLE } from "@/lib/depot-visuals";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { LineData, TrainData } from "../types";
import { Depot2DViewProps, getPersianLineTitle } from "./depotViewUtils";

export default function DepotMap2DView({
  lines,
  trains,
  canCreateManovr,
  isFocusMode,
  theme,
  onSelectLine,
  onSelectTrain,
  onDropTrainToLine,
  onSelectEmptySlot,
}: Depot2DViewProps) {
  // تابع رندر بج قطار
  const renderTrainBadge = (tr: TrainData, compact = false) => {
    const trStyle = STATUS_STYLE[tr.status] || STATUS_STYLE[1];
    return (
      <div
        key={tr.id}
        draggable={canCreateManovr}
        onDragStart={(e) => {
          e.dataTransfer.setData("trainId", String(tr.id));
          e.currentTarget.style.opacity = "0.5";
        }}
        onDragEnd={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectTrain(tr);
        }}
        title={`قطار ${tr.code} (${trStyle.label})${tr.hasKafshak ? " - ⚡ وجود کفشک" : ""}${tr.noAtp ? " - 🚨 عدم ATP" : ""}${tr.movadDavvar ? ` - 🔄 موعد دوار ${tr.movadDavvar}` : ""}${tr.noLicense ? " - 🛑 بدون مجوز" : ""}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          fontWeight: "bold",
          fontSize: compact ? "10px" : "11px",
          padding: compact ? "1px 5px" : "2px 6px",
          borderRadius: "4px",
          backgroundColor: trStyle.badge,
          color: "#ffffff",
          cursor: "pointer",
          transition: "transform 0.15s ease",
          userSelect: "none",
          border: "1px solid rgba(255,255,255,0.25)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
        className="num"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "none";
        }}
      >
        <trStyle.IconComp size={compact ? 9 : 11} weight="bold" />
        <span>{tr.code}</span>
        {tr.hasKafshak && <span title="وجود کفشک" style={{ fontSize: "8px" }}>⚡</span>}
        {tr.noAtp && <span title="عدم ATP" style={{ fontSize: "8px" }}>🚨</span>}
        {tr.movadDavvar && (
          <span
            title={`موعد دوّار سطح ${tr.movadDavvar}`}
            style={{
              fontSize: "7.5px",
              padding: "0 2px",
              borderRadius: "2px",
              backgroundColor: tr.movadDavvar === "A" ? "#8b5cf6" : tr.movadDavvar === "B" ? "#14b8a6" : "#f59e0b",
              color: "#ffffff",
              lineHeight: "1",
            }}
          >
            🔄{tr.movadDavvar}
          </span>
        )}
        {tr.noLicense && <span title="بدون مجوز حرکت" style={{ fontSize: "8px" }}>🛑</span>}
      </div>
    );
  };

  // تابع رندر یک ردیف ریل با نام و بج قطار(ها)
  const renderMapSlotRow = (line: LineData, label: string) => {
    const lineTrains = trains
      .filter((t) => t.lineId === line.id && !t.isDisposed)
      .sort((a, b) => a.slotIndex - b.slotIndex);
    const isActive = (line as any).isActive !== false;

    return (
      <div
        key={line.id}
        onClick={() => onSelectLine(line)}
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
          e.currentTarget.style.borderColor = "var(--line-soft)";
          e.currentTarget.style.backgroundColor = "transparent";
          const trIdStr = e.dataTransfer.getData("trainId");
          if (!trIdStr) return;
          onDropTrainToLine(Number(trIdStr), line);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 8px",
          borderBottom: "1px solid var(--line-soft)",
          cursor: "pointer",
          opacity: isActive ? 1 : 0.55,
          textDecoration: isActive ? "none" : "line-through",
          transition: "background 0.15s ease",
          minHeight: "32px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(var(--accent-rgb, 216, 132, 42), 0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: "600",
            color: isActive ? "var(--ink-soft)" : "var(--crit)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {lineTrains.length > 0 ? (
            lineTrains.map((tr) => renderTrainBadge(tr, true))
          ) : (
            <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
          )}
        </div>
      </div>
    );
  };

  // تابع رندر ردیف شماره‌دار پارکینگ (مثل پارکینگ شمالی/جنوبی)
  const renderParkingNumberedRow = (line: LineData | undefined, rowNumber: number) => {
    if (!line) {
      return (
        <div
          key={`empty-${rowNumber}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "3px 8px",
            borderBottom: "1px solid var(--line-soft)",
            minHeight: "30px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
            <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
          </div>
          <span
            className="num"
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              color: "var(--ink-soft)",
              minWidth: "20px",
              textAlign: "center",
            }}
          >
            {rowNumber}
          </span>
        </div>
      );
    }

    const lineTrains = trains
      .filter((t) => t.lineId === line.id && !t.isDisposed)
      .sort((a, b) => a.slotIndex - b.slotIndex);
    const isActive = (line as any).isActive !== false;

    return (
      <div
        key={line.id}
        onClick={() => onSelectLine(line)}
        onDragOver={(e) => {
          if (canCreateManovr) {
            e.preventDefault();
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.backgroundColor = "var(--accent-soft)";
          }
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = "transparent";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        onDrop={(e) => {
          if (!canCreateManovr) return;
          e.preventDefault();
          e.currentTarget.style.borderColor = "transparent";
          e.currentTarget.style.backgroundColor = "transparent";
          const trIdStr = e.dataTransfer.getData("trainId");
          if (!trIdStr) return;
          onDropTrainToLine(Number(trIdStr), line);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "3px 8px",
          borderBottom: "1px solid var(--line-soft)",
          cursor: "pointer",
          opacity: isActive ? 1 : 0.55,
          transition: "background 0.15s ease",
          minHeight: "30px",
          border: "1px solid transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(var(--accent-rgb, 216, 132, 42), 0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
          {lineTrains.length > 0 ? (
            lineTrains.map((tr) => renderTrainBadge(tr, true))
          ) : (
            <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
          )}
        </div>
        <span
          className="num"
          style={{
            fontSize: "11px",
            fontWeight: "bold",
            color: "var(--ink-soft)",
            minWidth: "20px",
            textAlign: "center",
          }}
        >
          {rowNumber}
        </span>
      </div>
    );
  };

  // تابع رندر بخش (section) با BorderRotate
  const renderSection = (
    title: string,
    icon: string,
    gradientColors: { primary: string; secondary: string; accent: string },
    children: React.ReactNode,
    extraStyle?: React.CSSProperties
  ) => (
    <BorderRotate
      gradientColors={gradientColors}
      backgroundColor="var(--panel)"
      borderRadius={10}
      borderWidth={2}
      animationSpeed={8}
      style={{
        boxShadow: "var(--sh-2)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...extraStyle,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div
          style={{
            padding: "8px 12px",
            fontWeight: "bold",
            fontSize: "12.5px",
            textAlign: "center",
            borderBottom: "1px solid var(--line)",
            color: "var(--ink)",
            backgroundColor: "rgba(0,0,0,0.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            flexShrink: 0,
          }}
        >
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{children}</div>
      </div>
    </BorderRotate>
  );

  // داده‌های هر بخش
  const mainLineObj = lines.find((l) => l.name === "خط اصلی");
  const mainLineTrains = mainLineObj
    ? trains.filter((t) => t.lineId === mainLineObj.id && !t.isDisposed).sort((a, b) => a.slotIndex - b.slotIndex)
    : [];
  const otherLines = lines
    .filter((l) => l.terminal === 8)
    .sort((a, b) => {
      const ma = a.name.match(/(\d+)/);
      const mb = b.name.match(/(\d+)/);
      if (ma && mb) return parseInt(ma[1], 10) - parseInt(mb[1], 10);
      return a.name.localeCompare(b.name, "fa");
    });
  const aliabadLines = lines.filter((l) => l.terminal === 9 || l.name.includes("علی‌آباد") || l.name.includes("علی اباد"));
  const sub1Lines = lines.filter((l) => l.terminal === 6);
  const sub2Lines = lines.filter((l) => l.terminal === 7);
  const wagonLines = lines.filter((l) => l.terminal === 2);
  const dieselLines = lines.filter((l) => l.terminal === 1);
  const northParkLines = lines.filter((l) => l.terminal === 4).sort((a, b) => a.id - b.id);
  const southParkLines = lines.filter((l) => l.terminal === 5).sort((a, b) => a.id - b.id);

  // لیست‌های ثابت دیزل‌شاپ
  const dieselSpecialNames = ["خط تست", "D7G", "باطری خانه", "دیزل شاپ B1", "دیزل شاپ B2"];
  const dieselNumbered = Array.from({ length: 10 }, (_, i) => `دیزل شاپ ${i + 1}`);
  const dieselFactory = ["کارخانه 1", "کارخانه 2", "کارخانه 3"];

  // واگن‌سازی
  const wagonNumbered = Array.from({ length: 16 }, (_, i) => `واگن سازی ${i + 1}`);
  const wagonSpecial = ["بادگیری", "خط کور1"];

  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        overflow: "auto",
        padding: isFocusMode ? "6px" : "16px",
        backgroundColor: theme === "dark" ? "#070a12" : "#f1f5f9",
        display: "flex",
        flexDirection: "column",
        gap: isFocusMode ? "6px" : "14px",
      }}
    >
      {/* راهنمای وضعیت قطارها */}
      {!isFocusMode && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            padding: "8px 16px",
            backgroundColor: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--sh-1)",
            fontSize: "11px",
            fontWeight: "600",
            flexShrink: 0,
            overflow: "hidden",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "var(--ink-soft)" }}>وضعیت ناوگان:</span>
          {Object.entries(STATUS_STYLE).map(([code, style]) => (
            <div key={code} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ color: style.text, display: "inline-flex" }}>
                <style.IconComp size={12} weight="bold" />
              </span>
              <span
                style={{
                  fontWeight: "bold",
                  padding: "1px 6px",
                  borderRadius: "3px",
                  backgroundColor: style.bg,
                  color: style.text,
                  border: `1px solid ${style.border}`,
                  fontSize: "10px",
                }}
              >
                {style.label}
              </span>
            </div>
          ))}
          <span style={{ color: "var(--ink-faint)", margin: "0 4px" }}>|</span>
          <span style={{ color: "var(--ink-soft)" }}>علائم:</span>
          <span style={{ padding: "1px 5px", borderRadius: "3px", backgroundColor: "#f59e0b", color: "#fff", fontSize: "9.5px" }}>
            ⚡ کفشک
          </span>
          <span style={{ padding: "1px 5px", borderRadius: "3px", backgroundColor: "#ef4444", color: "#fff", fontSize: "9.5px" }}>
            🚨 عدم ATP
          </span>
          <span style={{ padding: "1px 5px", borderRadius: "3px", backgroundColor: "#8b5cf6", color: "#fff", fontSize: "9.5px" }}>
            🔄 دوار A/B/C
          </span>
          <span style={{ padding: "1px 5px", borderRadius: "3px", backgroundColor: "#be123c", color: "#fff", fontSize: "9.5px" }}>
            🛑 بدون مجوز
          </span>
        </div>
      )}

      {/* گرید اصلی نقشه پایانه */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 2fr 0.8fr 0.8fr",
          gridTemplateRows: "1fr auto",
          gap: isFocusMode ? "4px" : "10px",
          direction: "rtl",
          overflow: "hidden",
        }}
      >
        {/* ستون ۵ (چپ‌ترین - RTL → راست‌ترین بصری): پارکینگ جنوبی */}
        {renderSection(
          "پارکینگ جنوبی",
          "🅿️",
          { primary: "#0ea5e9", secondary: "#38bdf8", accent: "#7dd3fc" },
          <>
            {Array.from({ length: 25 }, (_, i) => {
              const parkLine =
                southParkLines.find((l) => {
                  const rawLabel = l.tag || l.name;
                  const digitOnly = rawLabel.replace(/[^\d۰-۹]/g, "");
                  return digitOnly === String(i + 1);
                }) || southParkLines[i];
              return renderParkingNumberedRow(parkLine, i + 1);
            })}
          </>,
          { gridRow: "1 / 3" }
        )}

        {/* ستون ۴: پارکینگ شمالی */}
        {renderSection(
          "پارکینگ شمالی",
          "🅿️",
          { primary: "#14b8a6", secondary: "#2dd4bf", accent: "#5eead4" },
          <>
            {Array.from({ length: 25 }, (_, i) => {
              const parkLine =
                northParkLines.find((l) => {
                  const rawLabel = l.tag || l.name;
                  const digitOnly = rawLabel.replace(/[^\d۰-۹]/g, "");
                  return digitOnly === String(i + 1);
                }) || northParkLines[i];
              return renderParkingNumberedRow(parkLine, i + 1);
            })}
          </>,
          { gridRow: "1 / 3" }
        )}

        {/* ستون ۳: خط اصلی (بالا) + سایر خطوط (وسط) + پایانه علی‌آباد (پایین) */}
        <div style={{ display: "flex", flexDirection: "column", gap: isFocusMode ? "4px" : "10px", gridRow: "1 / 3", overflow: "hidden" }}>
          {/* خط اصلی */}
          {renderSection(
            "خط اصلی",
            "🚉",
            { primary: "#22c55e", secondary: "#4ade80", accent: "#86efac" },
            <div
              onClick={() => mainLineObj && onSelectLine(mainLineObj)}
              onDragOver={(e) => {
                if (canCreateManovr) {
                  e.preventDefault();
                  e.currentTarget.style.backgroundColor = "var(--accent-soft)";
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              onDrop={(e) => {
                if (!canCreateManovr || !mainLineObj) return;
                e.preventDefault();
                e.currentTarget.style.backgroundColor = "transparent";
                const trIdStr = e.dataTransfer.getData("trainId");
                if (!trIdStr) return;
                onDropTrainToLine(Number(trIdStr), mainLineObj);
              }}
              style={{ cursor: "pointer", transition: "background 0.15s ease", padding: "6px" }}
            >
              {/* هدر ستون‌ها */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    mainLineTrains.length > 15
                      ? `repeat(${Math.min(Math.ceil(mainLineTrains.length / 12), 4)}, 1fr)`
                      : "1fr",
                  gap: mainLineTrains.length > 15 ? "8px" : "0",
                }}
              >
                {(() => {
                  const colCount = mainLineTrains.length > 15 ? Math.min(Math.ceil(mainLineTrains.length / 12), 4) : 1;
                  const perCol = Math.ceil(mainLineTrains.length / colCount);
                  const columns = Array.from({ length: colCount }, (_, ci) =>
                    mainLineTrains.slice(ci * perCol, (ci + 1) * perCol)
                  );
                  return columns.map((colTrains, ci) => (
                    <div key={ci} style={{ display: "flex", flexDirection: "column" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "38px 42px 1fr",
                          borderBottom: "2px solid var(--line)",
                          padding: "4px 2px",
                          fontSize: "10px",
                          fontWeight: "bold",
                          color: "var(--ink-soft)",
                          textAlign: "center",
                        }}
                      >
                        <span>جایگاه</span>
                        <span>ناوگان</span>
                        <span>کد قطار</span>
                      </div>
                      {colTrains.map((tr) => {
                        const trStyle = STATUS_STYLE[tr.status] || STATUS_STYLE[1];
                        return (
                          <div
                            key={tr.id}
                            draggable={canCreateManovr}
                            onDragStart={(e) => {
                              if (canCreateManovr) {
                                e.dataTransfer.setData("trainId", String(tr.id));
                                e.currentTarget.style.opacity = "0.5";
                              }
                            }}
                            onDragEnd={(e) => {
                              e.currentTarget.style.opacity = "1";
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTrain(tr);
                            }}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "38px 42px 1fr",
                              alignItems: "center",
                              borderBottom: "1px solid var(--line-soft)",
                              padding: "3px 2px",
                              cursor: "grab",
                              fontSize: "11px",
                              transition: "background 0.12s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "rgba(var(--accent-rgb, 216, 132, 42), 0.06)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <span className="num" style={{ textAlign: "center", fontWeight: "600", color: "var(--ink-soft)" }}>
                              {tr.slotIndex + 1}
                            </span>
                            <span style={{ textAlign: "center", fontSize: "10px", color: "var(--ink-soft)" }}>
                              {tr.type === 0 ? "AC" : "DC"}
                            </span>
                            <div style={{ textAlign: "center" }}>
                              <span
                                style={{
                                  fontWeight: "bold",
                                  padding: "1px 7px",
                                  borderRadius: "4px",
                                  backgroundColor: trStyle.badge,
                                  color: "#fff",
                                  fontSize: "10.5px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                                className="num"
                              >
                                <trStyle.IconComp size={9} weight="bold" />
                                {tr.code}
                                {tr.hasKafshak && <span style={{ fontSize: "7px" }}>⚡</span>}
                                {tr.noAtp && <span style={{ fontSize: "7px" }}>🚨</span>}
                                {tr.noLicense && <span style={{ fontSize: "7px" }}>🛑</span>}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
              {mainLineTrains.length === 0 && (
                <div style={{ textAlign: "center", padding: "16px", color: "var(--ink-faint)", fontSize: "11px" }}>
                  هیچ قطاری مستقر نیست
                </div>
              )}

              {/* دکمه افزودن قطار + اسلات‌های خالی */}
              {canCreateManovr &&
                mainLineObj &&
                (() => {
                  const occupiedSlots = mainLineTrains.map((t) => t.slotIndex);
                  const emptySlots = Array.from({ length: mainLineObj.capacity }, (_, i) => i).filter(
                    (i) => !occupiedSlots.includes(i)
                  );
                  if (emptySlots.length === 0) return null;
                  return (
                    <div
                      style={{
                        marginTop: "6px",
                        padding: "6px",
                        borderTop: "1px dashed var(--line)",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "10px", color: "var(--ink-soft)", fontWeight: "600", marginLeft: "6px" }}>
                        جایگاه خالی:
                      </span>
                      {emptySlots.slice(0, 12).map((slotIdx) => (
                        <div
                          key={slotIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectEmptySlot) onSelectEmptySlot(null, mainLineObj.id, slotIdx);
                          }}
                          onDragOver={(e) => {
                            if (canCreateManovr) {
                              e.preventDefault();
                              e.currentTarget.style.borderColor = "var(--accent)";
                              e.currentTarget.style.backgroundColor = "var(--accent-soft)";
                            }
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.style.borderColor = "var(--line)";
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                          onDrop={(e) => {
                            if (!canCreateManovr) return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.style.borderColor = "var(--line)";
                            e.currentTarget.style.backgroundColor = "transparent";
                            const trIdStr = e.dataTransfer.getData("trainId");
                            if (!trIdStr) return;
                            onDropTrainToLine(Number(trIdStr), mainLineObj, slotIdx);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            border: "1px dashed var(--line)",
                            fontSize: "10px",
                            color: "var(--ink-faint)",
                            cursor: "pointer",
                            transition: "var(--transition-fluid)",
                            minWidth: "32px",
                            backgroundColor: "transparent",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "var(--accent)";
                            e.currentTarget.style.color = "var(--accent)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "var(--line)";
                            e.currentTarget.style.color = "var(--ink-faint)";
                          }}
                          title={`افزودن قطار به جایگاه ${slotIdx + 1}`}
                        >
                          <span className="num">{slotIdx + 1}</span>
                        </div>
                      ))}
                      {emptySlots.length > 12 && (
                        <span style={{ fontSize: "9px", color: "var(--ink-faint)" }}>
                          +{emptySlots.length - 12} جایگاه دیگر
                        </span>
                      )}
                    </div>
                  );
                })()}
            </div>,
            { flex: "1 1 auto" }
          )}

          {/* سایر خطوط */}
          {renderSection(
            "سایر خطوط",
            "📋",
            { primary: "#475569", secondary: "#64748b", accent: "#94a3b8" },
            <>
              {otherLines.map((l) => renderMapSlotRow(l, getPersianLineTitle(l)))}
              {otherLines.length === 0 && (
                <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>بدون خط</div>
              )}
            </>,
            { flex: "0 0 auto" }
          )}

          {/* پایانه علی‌آباد */}
          {renderSection(
            "پایانه علی آباد",
            "📍",
            { primary: "#0f766e", secondary: "#14b8a6", accent: "#5eead4" },
            <>
              {aliabadLines.map((l) => renderMapSlotRow(l, getPersianLineTitle(l)))}
              {aliabadLines.length === 0 && (
                <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>بدون خط</div>
              )}
            </>,
            { flex: "0 0 auto" }
          )}
        </div>

        {/* ستون ۲: واگن‌سازی */}
        {renderSection(
          "واگن‌سازی",
          "🏗️",
          { primary: "#f59e0b", secondary: "#fbbf24", accent: "#fde68a" },
          <>
            {wagonNumbered.map((name) => {
              const line = lines.find((l) => l.name === name);
              const digitMatch = name.match(/(\d+)/);
              const label = digitMatch ? digitMatch[1] : name;
              if (!line) {
                return (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      borderBottom: "1px solid var(--line-soft)",
                      minHeight: "32px",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{label}</span>
                  </div>
                );
              }
              return renderMapSlotRow(line, label);
            })}
            <div style={{ margin: "4px 0", borderTop: "1px dashed var(--line)" }} />
            {wagonSpecial.map((name) => {
              const line = lines.find((l) => l.name === name);
              if (!line) {
                return (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      borderBottom: "1px solid var(--line-soft)",
                      minHeight: "32px",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{name}</span>
                  </div>
                );
              }
              return renderMapSlotRow(line, getPersianLineTitle(line));
            })}
          </>,
          { gridRow: "1 / 2" }
        )}

        {/* ستون ۱ (راست‌ترین RTL): دیزل‌شاپ */}
        {renderSection(
          "دیزل‌شاپ",
          "🚂",
          { primary: "#ef4444", secondary: "#f87171", accent: "#fca5a5" },
          <>
            {dieselSpecialNames.map((name) => {
              const line = lines.find((l) => l.name === name);
              if (!line) {
                return (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      borderBottom: "1px solid var(--line-soft)",
                      minHeight: "32px",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{name}</span>
                  </div>
                );
              }
              return renderMapSlotRow(line, getPersianLineTitle(line));
            })}
            <div style={{ margin: "4px 0", borderTop: "1px dashed var(--line)" }} />
            {dieselNumbered.map((name) => {
              const line = lines.find((l) => l.name === name);
              const digitMatch = name.match(/(\d+)/);
              const label = digitMatch ? digitMatch[1] : name;
              if (!line) {
                return (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      borderBottom: "1px solid var(--line-soft)",
                      minHeight: "32px",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{label}</span>
                  </div>
                );
              }
              return renderMapSlotRow(line, label);
            })}
            <div style={{ margin: "4px 0", borderTop: "1px dashed var(--line)" }} />
            {dieselFactory.map((name) => {
              const line = lines.find((l) => l.name === name);
              if (!line) {
                return (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      borderBottom: "1px solid var(--line-soft)",
                      minHeight: "32px",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{name}</span>
                  </div>
                );
              }
              return renderMapSlotRow(line, getPersianLineTitle(line));
            })}
          </>,
          { gridRow: "1 / 2" }
        )}

        {/* ردیف پایین: فرعی ۲ (زیر دیزل‌شاپ) و فرعی ۱ (زیر واگن‌سازی) */}
        {renderSection(
          "فرعی ۲",
          "🛤️",
          { primary: "#ec4899", secondary: "#f472b6", accent: "#f9a8d4" },
          <>
            {sub2Lines.map((l) => renderMapSlotRow(l, getPersianLineTitle(l)))}
            {sub2Lines.length === 0 && (
              <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>بدون خط</div>
            )}
          </>
        )}

        {renderSection(
          "فرعی ۱",
          "🛤️",
          { primary: "#8b5cf6", secondary: "#a78bfa", accent: "#c4b5fd" },
          <>
            {sub1Lines.map((l) => renderMapSlotRow(l, getPersianLineTitle(l)))}
            {sub1Lines.length === 0 && (
              <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>بدون خط</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
