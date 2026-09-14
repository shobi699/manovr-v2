"use client";

import React, { useMemo } from "react";
import { STATUS_STYLE, ZONE_CONFIG } from "@/lib/depot-visuals";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { LineData, TrainData } from "../types";
import { Depot2DViewProps } from "./depotViewUtils";

export default function DepotClassic2DView({
  lines,
  trains,
  columnsData = { 1: [], 2: [], 3: [], 4: [], 5: [] },
  canCreateManovr,
  canManageLines,
  isFocusMode,
  theme,
  onSelectLine,
  onSelectTrain,
  onDropTrainToLine,
}: Depot2DViewProps) {
  // ایندکس سریع خطوط بر اساس نام برای جستجوی O(1) به جای lines.find تکراری
  const linesByName = useMemo(() => {
    const map = new Map<string, LineData>();
    for (const l of lines) {
      map.set(l.name, l);
    }
    return map;
  }, [lines]);

  // گروه‌بندی کش‌شده قطارها بر اساس خط برای جستجوی O(1)
  const trainsByLine = useMemo(() => {
    const map = new Map<number, typeof trains>();
    for (const t of trains) {
      if (t.lineId && !t.isDisposed) {
        const list = map.get(t.lineId) || [];
        list.push(t);
        map.set(t.lineId, list);
      }
    }
    for (const [_, list] of map) {
      list.sort((a, b) => a.slotIndex - b.slotIndex);
    }
    return map;
  }, [trains]);

  // تابع کمکی برای رندر خانه‌های ریل به صورت ۲بعدی تعاملی
  const renderSlot = (lineName: string, label: string) => {
    const line = linesByName.get(lineName);
    if (!line) {
      return (
        <div
          key={lineName}
          style={{
            border: "1px dashed var(--line)",
            borderRadius: "var(--r-sm)",
            padding: isFocusMode ? "2px 4px" : "4px 8px",
            minHeight: isFocusMode ? undefined : "36px",
            flexShrink: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: isFocusMode ? "9px" : "11px",
            color: "var(--ink-faint)",
            backgroundColor: "var(--bg)",
          }}
        >
          <span>{label}</span>
          <span>—</span>
        </div>
      );
    }

    const lineTrains = trainsByLine.get(line.id) || [];
    const hasTrain = lineTrains.length > 0;
    const train = lineTrains[0];
    const style = hasTrain ? STATUS_STYLE[train.status] || STATUS_STYLE[1] : null;
    const isActive = (line as any).isActive !== false;

    if (!isActive) {
      return (
        <div
          key={lineName}
          onClick={() => {
            if (canManageLines) {
              onSelectLine(line);
            }
          }}
          onContextMenu={() => {
            if (canManageLines) {
              onSelectLine(line);
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isFocusMode ? "2px 6px" : "6px 12px",
            border: "1px dashed var(--crit)",
            borderRadius: "var(--r-sm)",
            backgroundColor: "color-mix(in oklab, var(--crit) 8%, var(--bg))",
            color: "var(--crit)",
            cursor: canManageLines ? "pointer" : "not-allowed",
            minHeight: isFocusMode ? undefined : "38px",
            flexShrink: 1,
            opacity: 0.75,
            textDecoration: "line-through",
          }}
          title="این خط توسط مدیر مسدود/غیرفعال شده است"
        >
          <span style={{ fontSize: "11px", fontWeight: "600" }}>{label} (مسدود)</span>
          <span style={{ fontSize: "12px" }}>🚫</span>
        </div>
      );
    }

    return (
      <div
        key={lineName}
        onClick={() => onSelectLine(line)}
        onContextMenu={() => {
          onSelectLine(line);
          if (hasTrain) onSelectTrain(train);
        }}
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
          padding: isFocusMode ? "2px 6px" : "6px 12px",
          border: `1px solid ${style ? style.border : "var(--line)"}`,
          borderRadius: "var(--r-sm)",
          backgroundColor: style ? style.bg : "color-mix(in oklab, var(--bg) 60%, var(--panel))",
          color: style ? style.text : "var(--ink)",
          cursor: "pointer",
          minHeight: isFocusMode ? undefined : "38px",
          flexShrink: 1,
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
        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{label}</span>
        {hasTrain ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "70%" }}>
            {lineTrains.map((tr) => {
              const trStyle = STATUS_STYLE[tr.status] || STATUS_STYLE[1];
              return (
                <div
                  key={tr.id}
                  title={`قطار ${tr.code} (${trStyle.label})${tr.hasKafshak ? " - ⚡ وجود کفشک" : ""}${tr.noAtp ? " - 🚨 عدم ATP" : ""}${tr.movadDavvar ? ` - 🔄 موعد دوار ${tr.movadDavvar}` : ""}${tr.noLicense ? " - 🛑 بدون مجوز" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: "bold",
                    fontSize: "11px",
                    padding: "2px 6px",
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

  const getGradientColorsForTerminal = (terminalId: number) => {
    switch (terminalId) {
      case 1:
        return { primary: "#ef4444", secondary: "#f87171", accent: "#fca5a5" };
      case 2:
        return { primary: "#f59e0b", secondary: "#fbbf24", accent: "#fde68a" };
      case 4:
        return { primary: "#3b82f6", secondary: "#60a5fa", accent: "#93c5fd" };
      case 5:
        return { primary: "#06b6d4", secondary: "#22d3ee", accent: "#67e8f9" };
      case 6:
        return { primary: "#8b5cf6", secondary: "#a78bfa", accent: "#c4b5fd" };
      case 7:
        return { primary: "#ec4899", secondary: "#f472b6", accent: "#f9a8d4" };
      case 3:
      case 8:
      default:
        return { primary: "#64748b", secondary: "#94a3b8", accent: "#cbd5e1" };
    }
  };

  const getInnerCardStyle = () => ({
    width: "100%",
    height: isFocusMode ? undefined : "100%",
    display: "flex",
    flexDirection: "column" as const,
    overflow: isFocusMode ? "visible" : "hidden",
  });

  const getTitleStyle = () => ({
    backgroundColor: "rgba(0,0,0,0.02)",
    padding: "10px 14px",
    fontWeight: "bold",
    textAlign: "center" as const,
    fontSize: "12.5px",
    borderBottom: "1px solid var(--line)",
    color: "var(--ink)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  });

  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        overflow: "auto",
        padding: "20px",
        backgroundColor: theme === "dark" ? "#070a12" : "#f1f5f9",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* راهنمای وضعیت قطارها */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "center",
          padding: "12px 20px",
          backgroundColor: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--sh-2)",
          fontSize: "12px",
          fontWeight: "600",
          minWidth: "1100px",
        }}
      >
        <span style={{ color: "var(--ink-soft)" }}>وضعیت ناوگان:</span>
        {Object.entries(STATUS_STYLE).map(([code, style]) => (
          <div key={code} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: style.text, display: "inline-flex" }}>
              <style.IconComp size={13} weight="bold" />
            </span>
            <span
              style={{
                fontWeight: "bold",
                padding: "2px 8px",
                borderRadius: "4px",
                backgroundColor: style.bg,
                color: style.text,
                border: `1px solid ${style.border}`,
              }}
            >
              {style.label}
            </span>
          </div>
        ))}

        <span style={{ color: "var(--ink-faint)", margin: "0 6px" }}>|</span>
        <span style={{ color: "var(--ink-soft)" }}>ویژگی‌ها و علائم فنی:</span>
        <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#f59e0b", color: "#fff", fontSize: "11px" }}>
          ⚡ کفشک
        </span>
        <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#ef4444", color: "#fff", fontSize: "11px" }}>
          🚨 عدم ATP
        </span>
        <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#8b5cf6", color: "#fff", fontSize: "11px" }}>
          🔄 دوار A
        </span>
        <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#14b8a6", color: "#fff", fontSize: "11px" }}>
          🔄 دوار B
        </span>
        <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#f59e0b", color: "#fff", fontSize: "11px" }}>
          🔄 دوار C
        </span>
        <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#be123c", color: "#fff", fontSize: "11px" }}>
          🛑 بدون مجوز
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "20px",
          minWidth: "1100px",
          direction: "rtl",
        }}
      >
        {[1, 2, 3, 4, 5].map((colIdx) => (
          <div key={colIdx} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {columnsData[colIdx]?.map((term) => {
              if (term.code === 5) {
                return (
                  <BorderRotate
                    key={term.code}
                    gradientColors={getGradientColorsForTerminal(5)}
                    backgroundColor="var(--panel)"
                    borderRadius={12}
                    borderWidth={2}
                    animationSpeed={8}
                    style={{ boxShadow: "var(--sh-2)" }}
                  >
                    <div style={getInnerCardStyle()}>
                      <div style={getTitleStyle()}>
                        <span>{term.label}</span>
                      </div>
                      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {Array.from({ length: 12 }, (_, i) => renderSlot(`پارکینگ جنوبی ${i + 1}`, String(i + 1)))}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {Array.from({ length: 12 }, (_, i) => renderSlot(`پارکینگ جنوبی ${i + 13}`, String(i + 13)))}
                          </div>
                        </div>
                        <div>{renderSlot("پارکینگ جنوبی 25", "25")}</div>
                      </div>
                    </div>
                  </BorderRotate>
                );
              }
              if (term.code === 6) {
                return (
                  <BorderRotate
                    key={term.code}
                    gradientColors={getGradientColorsForTerminal(6)}
                    backgroundColor="var(--panel)"
                    borderRadius={12}
                    borderWidth={2}
                    animationSpeed={8}
                    style={{ boxShadow: "var(--sh-2)" }}
                  >
                    <div style={getInnerCardStyle()}>
                      <div style={getTitleStyle()}>
                        <span>{term.label}</span>
                      </div>
                      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {renderSlot("دوار غربی", "دوار غربی")}
                        {renderSlot("دوار شرقی", "دوار شرقی")}
                        {renderSlot("آبگیری", "آبگیری")}
                        {renderSlot("خط کور2", "خط کور ۲")}
                      </div>
                    </div>
                  </BorderRotate>
                );
              }
              if (term.code === 4) {
                return (
                  <BorderRotate
                    key={term.code}
                    gradientColors={getGradientColorsForTerminal(4)}
                    backgroundColor="var(--panel)"
                    borderRadius={12}
                    borderWidth={2}
                    animationSpeed={8}
                    style={{ boxShadow: "var(--sh-2)" }}
                  >
                    <div style={getInnerCardStyle()}>
                      <div style={getTitleStyle()}>
                        <span>{term.label}</span>
                      </div>
                      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {Array.from({ length: 12 }, (_, i) => renderSlot(`پارکینگ شمالی ${i + 1}`, String(i + 1)))}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {Array.from({ length: 12 }, (_, i) => renderSlot(`پارکینگ شمالی ${i + 13}`, String(i + 13)))}
                          </div>
                        </div>
                        <div>{renderSlot("پارکینگ شمالی 25", "25")}</div>
                      </div>
                    </div>
                  </BorderRotate>
                );
              }
              if (term.code === 7) {
                return (
                  <BorderRotate
                    key={term.code}
                    gradientColors={getGradientColorsForTerminal(7)}
                    backgroundColor="var(--panel)"
                    borderRadius={12}
                    borderWidth={2}
                    animationSpeed={8}
                    style={{ boxShadow: "var(--sh-2)" }}
                  >
                    <div style={getInnerCardStyle()}>
                      <div style={getTitleStyle()}>
                        <span>{term.label}</span>
                      </div>
                      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {renderSlot("متروواش", "متروواش")}
                        {renderSlot("پیتلاین", "پیتلاین")}
                        {renderSlot("مجاور سوله", "مجاور سوله")}
                        {renderSlot("مجاور مرکز", "مجاور مرکز")}
                      </div>
                    </div>
                  </BorderRotate>
                );
              }
              if (term.code === 3) {
                const mainLineObj = lines.find(
                  (l) => l.name === "خط اصلی" || l.tag === "S_OriginalLine" || l.tag === "MAIN"
                );
                const mainLineTrains = mainLineObj
                  ? trains.filter((t) => t.lineId === mainLineObj.id && !t.isDisposed).sort((a, b) => a.slotIndex - b.slotIndex)
                  : [];
                return (
                  <BorderRotate
                    key={term.code}
                    gradientColors={getGradientColorsForTerminal(3)}
                    backgroundColor="var(--panel)"
                    borderRadius={12}
                    borderWidth={2}
                    animationSpeed={8}
                    style={{ boxShadow: "var(--sh-2)", display: "flex", flexDirection: "column", minHeight: "280px" }}
                  >
                    <div style={getInnerCardStyle()}>
                      <div style={getTitleStyle()}>
                        <span>{term.label}</span>
                      </div>
                      <div style={{ padding: "14px", flex: isFocusMode ? undefined : 1, overflowY: isFocusMode ? "visible" : "auto" }}>
                        {!mainLineObj ? (
                          <div style={{ color: "var(--ink-faint)", textAlign: "center", marginTop: "20px" }}>
                            خط اصلی یافت نشد.
                          </div>
                        ) : (
                          <div
                            onClick={() => onSelectLine(mainLineObj)}
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
                              if (!canCreateManovr) return;
                              e.preventDefault();
                              e.currentTarget.style.backgroundColor = "transparent";
                              const trIdStr = e.dataTransfer.getData("trainId");
                              if (!trIdStr) return;
                              onDropTrainToLine(Number(trIdStr), mainLineObj);
                            }}
                            style={{ cursor: "pointer", height: "100%", transition: "background 0.2s ease-out", borderRadius: "var(--r-sm)" }}
                          >
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                              <thead>
                                <tr style={{ borderBottom: "2px solid var(--line)" }}>
                                  <th style={{ padding: "8px", textAlign: "center" }}>کد قطار</th>
                                  <th style={{ padding: "8px", textAlign: "center" }}>نوع ناوگان</th>
                                  <th style={{ padding: "8px", textAlign: "center" }}>جایگاه</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mainLineTrains.map((tr) => {
                                  const trStyle = STATUS_STYLE[tr.status] || STATUS_STYLE[1];
                                  return (
                                    <tr
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
                                      style={{ borderBottom: "1px solid var(--line-soft)", height: "38px", cursor: "grab" }}
                                    >
                                      <td style={{ padding: "8px", textAlign: "center" }}>
                                        <div
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectTrain(tr);
                                          }}
                                          title={`قطار ${tr.code} (${trStyle.label})${tr.hasKafshak ? " - ⚡ وجود کفشک" : ""}${tr.noAtp ? " - 🚨 عدم ATP" : ""}${tr.movadDavvar ? ` - 🔄 موعد دوار ${tr.movadDavvar}` : ""}${tr.noLicense ? " - 🛑 بدون مجوز" : ""}`}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "5px",
                                            fontWeight: "bold",
                                            fontSize: "11px",
                                            padding: "3px 8px",
                                            borderRadius: "6px",
                                            backgroundColor: trStyle.badge,
                                            color: "#ffffff",
                                            cursor: "pointer",
                                            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
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
                                      </td>
                                      <td style={{ padding: "8px", textAlign: "center" }}>{tr.type === 0 ? "AC" : tr.type === 1 ? "DC" : "دیزل"}</td>
                                      <td style={{ padding: "8px", textAlign: "center" }} className="num">{tr.slotIndex + 1}</td>
                                    </tr>
                                  );
                                })}
                                {mainLineTrains.length === 0 && (
                                  <tr>
                                    <td colSpan={3} style={{ textAlign: "center", padding: "24px", color: "var(--ink-faint)" }}>
                                      هیچ قطاری مستقر نیست
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </BorderRotate>
                );
              }
              if (term.code === 8) {
                const termLines = lines
                  .filter((l) => l.terminal === 8)
                  .sort((a, b) => {
                    const ma = a.name.match(/(\d+)/);
                    const mb = b.name.match(/(\d+)/);
                    if (ma && mb) return parseInt(ma[1], 10) - parseInt(mb[1], 10);
                    return a.name.localeCompare(b.name, "fa");
                  });
                return (
                  <BorderRotate
                    key={term.code}
                    gradientColors={getGradientColorsForTerminal(8)}
                    backgroundColor="var(--panel)"
                    borderRadius={12}
                    borderWidth={2}
                    animationSpeed={8}
                    style={{ boxShadow: "var(--sh-2)" }}
                  >
                    <div style={getInnerCardStyle()}>
                      <div style={getTitleStyle()}>
                        <span>{term.label}</span>
                      </div>
                      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {termLines.map((l) => renderSlot(l.name, l.name))}
                        {termLines.length === 0 && (
                          <div style={{ fontSize: "11px", color: "var(--ink-faint)", textAlign: "center", padding: "12px" }}>
                            هیچ خطی ثبت نشده است
                          </div>
                        )}
                      </div>
                    </div>
                  </BorderRotate>
                );
              }
              if (term.code === 2) {
                return (
                  <BorderRotate
                    key={term.code}
                    gradientColors={getGradientColorsForTerminal(2)}
                    backgroundColor="var(--panel)"
                    borderRadius={12}
                    borderWidth={2}
                    animationSpeed={8}
                    style={{ boxShadow: "var(--sh-2)" }}
                  >
                    <div style={getInnerCardStyle()}>
                      <div style={getTitleStyle()}>
                        <span>{term.label}</span>
                      </div>
                      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {Array.from({ length: 16 }, (_, i) => renderSlot(`واگن سازی ${i + 1}`, String(i + 1)))}
                        <div style={{ margin: "8px 0", borderTop: "1px dashed var(--line)" }} />
                        {renderSlot("بادگیری", "بادگیری")}
                        {renderSlot("خط کور1", "خط کور ۱")}
                      </div>
                    </div>
                  </BorderRotate>
                );
              }
              if (term.code === 1) {
                return (
                  <BorderRotate
                    key={term.code}
                    gradientColors={getGradientColorsForTerminal(1)}
                    backgroundColor="var(--panel)"
                    borderRadius={12}
                    borderWidth={2}
                    animationSpeed={8}
                    style={{ boxShadow: "var(--sh-2)" }}
                  >
                    <div style={getInnerCardStyle()}>
                      <div style={getTitleStyle()}>
                        <span>{term.label}</span>
                      </div>
                      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {renderSlot("خط تست", "خط تست")}
                        {renderSlot("D7G", "D7G")}
                        {renderSlot("باطری خانه", "باطری خانه")}
                        {renderSlot("دیزل شاپ B1", "B1")}
                        {renderSlot("دیزل شاپ B2", "B2")}
                        <div style={{ margin: "4px 0", borderTop: "1px dashed var(--line)" }} />
                        {Array.from({ length: 10 }, (_, i) => renderSlot(`دیزل شاپ ${i + 1}`, String(i + 1)))}
                        <div style={{ margin: "4px 0", borderTop: "1px dashed var(--line)" }} />
                        {renderSlot("کارخانه 1", "کارخانه ۱")}
                        {renderSlot("کارخانه 2", "کارخانه ۲")}
                        {renderSlot("کارخانه 3", "کارخانه ۳")}
                      </div>
                    </div>
                  </BorderRotate>
                );
              }

              const termLines = lines.filter((l) => l.terminal === term.code);
              return (
                <BorderRotate
                  key={term.code}
                  gradientColors={getGradientColorsForTerminal(term.code)}
                  backgroundColor="var(--panel)"
                  borderRadius={12}
                  borderWidth={2}
                  animationSpeed={8}
                  style={{ boxShadow: "var(--sh-2)" }}
                >
                  <div style={getInnerCardStyle()}>
                    <div style={getTitleStyle()}>
                      <span>{term.label}</span>
                    </div>
                    <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {termLines.map((line) => renderSlot(line.name, line.tag || line.name))}
                      {termLines.length === 0 && (
                        <div style={{ fontSize: "11px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>
                          بدون ریل متصل
                        </div>
                      )}
                    </div>
                  </div>
                </BorderRotate>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
