"use client";

import React, { useMemo, useState, useRef } from "react";
import { STATUS_STYLE, statusStyleFor } from "@/lib/depot-visuals";
import { toEnglishDigits } from "@/lib/digits";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { LineData, TrainData } from "../types";
import { Depot2DViewProps, getPersianLineTitle } from "./depotViewUtils";
import { useContextMenu, ContextMenuItem } from "@/components/context-menu";

// لیست‌های ثابت دیزل‌شاپ و واگن‌سازی در سطح ماژول جهت جلوگیری از تخصیص مکرر حافظه در هر رندر
const DIESEL_SPECIAL_NAMES = ["خط تست", "D7G", "باطری خانه", "دیزل شاپ B1", "دیزل شاپ B2"];
const DIESEL_NUMBERED = Array.from({ length: 10 }, (_, i) => `دیزل شاپ ${i + 1}`);
const DIESEL_FACTORY = ["کارخانه 1", "کارخانه 2", "کارخانه 3"];
const WAGON_NUMBERED = Array.from({ length: 16 }, (_, i) => `واگن سازی ${i + 1}`);
const WAGON_SPECIAL = ["بادگیری", "خط کور1"];

// تابع نرمال‌سازی نام و برچسب خطوط ریلی جهت تطابق قطعی با ارقام فارسی، نیم‌فاصله‌ها و فواصل
function normalizeLineKey(name: string): string {
  if (!name) return "";
  return toEnglishDigits(name)
    .replace(/[\u200c\s_\-]+/g, "")
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .toLowerCase();
}

// متغیر سراسری پشتیبان ماژول جهت دسترسی سریع و جلوگیری از خطای نام در بافر ادیتور
let globalDraggedTrainId: number | null = null;

export default function DepotMap2DView({
  lines = [],
  trains = [],
  canCreateManovr,
  isFocusMode,
  theme,
  zoom = 100,
  onSelectLine,
  onSelectTrain,
  onDropTrainToLine,
  onSelectEmptySlot,
}: Depot2DViewProps) {
  const { openMenu } = useContextMenu();

  // مرجع پایدار شناسه قطار در حال درگ (Scoped Ref + Window Fallback)
  const draggedTrainRef = useRef<number | null>(null);

  // وضعیت‌های تعاملی عملیات Drag-and-Drop جهت پیشگیری قطعی از تخریب استایل مرزها
  const [dragOverLineId, setDragOverLineId] = useState<number | null>(null);
  const [dragOverMainLineSlot, setDragOverMainLineSlot] = useState<number | null>(null);

  // ایندکس کش‌شده خطوط بر اساس نام و کلید نرمال‌شده جهت جستجوی مستقیم O(1)
  const linesByName = useMemo(() => {
    const map = new Map<string, LineData>();
    for (const l of lines ?? []) {
      map.set(l.name, l);
      map.set(normalizeLineKey(l.name), l);
      if (l.tag) {
        map.set(l.tag, l);
        map.set(normalizeLineKey(l.tag), l);
      }
    }
    return map;
  }, [lines]);

  const findLineByName = (name: string): LineData | undefined => {
    return linesByName.get(name) || linesByName.get(normalizeLineKey(name));
  };

  // گروه‌بندی کش‌شده قطارها بر اساس خط برای جستجوی مستقیم O(1)
  const trainsByLine = useMemo(() => {
    const map = new Map<number, typeof trains>();
    for (const t of trains ?? []) {
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

  // مدیریت هوشمند و اختصاصی منوی کلیک‌راست قطار بدون تاخیر استیت
  const handleTrainContextMenu = (e: React.MouseEvent, tr: TrainData) => {
    e.preventDefault();
    e.stopPropagation();
    const trStyle = statusStyleFor(tr.status);
    const items: ContextMenuItem[] = [
      {
        id: `train-manovr-${tr.id}`,
        label: `ثبت سریع مانور برای قطار ${tr.code}`,
        icon: <span>⚡</span>,
        badge: "عملیاتی",
        badgeVariant: "accent",
        onClick: () => {
          onSelectTrain(tr);
          if (onSelectEmptySlot && tr.lineId) {
            onSelectEmptySlot(tr.lineId, tr.lineId, tr.slotIndex);
          }
        },
      },
      {
        id: `train-inspect-${tr.id}`,
        label: `شناسنامه و وضعیت ناوگان (${tr.code})`,
        icon: <span>🚆</span>,
        badge: trStyle.label,
        badgeVariant: tr.status === 1 ? "good" : tr.status === 2 ? "warn" : "crit",
        onClick: () => {
          onSelectTrain(tr);
        },
      },
      {
        id: `train-flags-${tr.id}`,
        label: `تجهیزات: ${tr.hasKafshak ? "کفشک ⚡" : "بدون کفشک"} | ${tr.noAtp ? "فاقد ATP 🚨" : "ATP فعال"}`,
        icon: <span>⚙️</span>,
        disabled: true,
        onClick: () => {},
      },
    ];
    openMenu(e, items);
  };

  // مدیریت هوشمند و اختصاصی منوی کلیک‌راست خط ریلی
  const handleLineContextMenu = (e: React.MouseEvent, line: LineData, train?: TrainData) => {
    e.preventDefault();
    e.stopPropagation();
    const lineTrains = trainsByLine.get(line.id) || [];
    const isFull = lineTrains.length >= line.capacity;
    const isLineActive = (line as any).isActive !== false;

    const items: ContextMenuItem[] = [
      {
        id: `line-view-${line.id}`,
        label: `مدیریت و مشخصات خط ریلی «${line.name}»`,
        icon: <span>🛤️</span>,
        badge: `${lineTrains.length} از ${line.capacity} قطار`,
        badgeVariant: isFull ? "warn" : "blue",
        onClick: () => {
          onSelectLine(line);
        },
      },
      {
        id: `line-manovr-to-${line.id}`,
        label: `ثبت مانور جابجایی به «${line.name}»`,
        icon: <span>⚡</span>,
        disabled: !canCreateManovr || !isLineActive || isFull,
        badge: isFull ? "ظرفیت پر" : !isLineActive ? "مسدود" : undefined,
        badgeVariant: "warn",
        onClick: () => {
          onSelectLine(line);
          if (onSelectEmptySlot) {
            onSelectEmptySlot(null, line.id, 0);
          }
        },
      },
    ];

    if (train) {
      items.unshift({
        id: `train-quick-${train.id}`,
        label: `عملیات قطار مستقر کد ${train.code}`,
        icon: <span>🚆</span>,
        onClick: () => {
          onSelectTrain(train);
        },
      });
    }

    openMenu(e, items);
  };

  // تابع رندر بج قطار با بزرگ‌نمایی اختصاصی شماره و المان‌های قطار (بدون تغییر مقیاس جداول)
  const renderTrainBadge = (tr: TrainData, compact = false) => {
    const trStyle = statusStyleFor(tr.status);
    const zoomScale = Math.max(0.7, Math.min(2.0, (zoom || 100) / 100));
    const baseFontSize = compact ? 10.5 : 11.5;
    const scaledFontSize = Math.round(baseFontSize * zoomScale);
    const baseIconSize = compact ? 9 : 11;
    const scaledIconSize = Math.round(baseIconSize * zoomScale);
    const scaledPadY = Math.max(1, Math.round((compact ? 1.5 : 2.5) * zoomScale));
    const scaledPadX = Math.max(4, Math.round((compact ? 5 : 7) * zoomScale));

    return (
      <div
        key={tr.id}
        draggable={canCreateManovr}
        onDragStart={(e) => {
          if (!canCreateManovr) return;
          globalDraggedTrainId = tr.id;
          draggedTrainRef.current = tr.id;
          if (typeof window !== "undefined") (window as any).__depotDraggedTrainId = tr.id;
          e.dataTransfer.setData("trainId", String(tr.id));
          e.dataTransfer.setData("text/plain", String(tr.id));
          e.dataTransfer.effectAllowed = "move";
          (e.currentTarget as HTMLElement).style.opacity = "0.4";
        }}
        onDragEnd={(e) => {
          globalDraggedTrainId = null;
          draggedTrainRef.current = null;
          if (typeof window !== "undefined") (window as any).__depotDraggedTrainId = null;
          (e.currentTarget as HTMLElement).style.opacity = "1";
          setDragOverLineId(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectTrain(tr);
        }}
        onContextMenu={(e) => {
          handleTrainContextMenu(e, tr);
        }}
        title={`قطار ${tr.code} (${trStyle.label})${tr.hasKafshak ? " - ⚡ وجود کفشک" : ""}${tr.noAtp ? " - 🚨 عدم ATP" : ""}${tr.movadDavvar ? ` - 🔄 موعد دوار ${tr.movadDavvar}` : ""}${tr.noLicense ? " - 🛑 بدون مجوز" : ""}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: `${Math.max(2, Math.round(3 * zoomScale))}px`,
          fontWeight: "bold",
          fontSize: `${scaledFontSize}px`,
          padding: `${scaledPadY}px ${scaledPadX}px`,
          borderRadius: "4px",
          backgroundColor: trStyle.badge,
          color: "#ffffff",
          cursor: canCreateManovr ? "grab" : "pointer",
          transition: "transform 0.15s ease, font-size 0.15s ease, padding 0.15s ease",
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
        <trStyle.IconComp size={scaledIconSize} weight="bold" />
        <span style={{ fontSize: `${scaledFontSize}px`, letterSpacing: "0.5px" }}>{tr.code}</span>
        {tr.hasKafshak && <span title="وجود کفشک" style={{ fontSize: `${Math.round(8 * zoomScale)}px` }}>⚡</span>}
        {tr.noAtp && <span title="عدم ATP" style={{ fontSize: `${Math.round(8 * zoomScale)}px` }}>🚨</span>}
        {tr.movadDavvar && (
          <span
            title={`موعد دوّار سطح ${tr.movadDavvar}`}
            style={{
              fontSize: `${Math.max(7, Math.round(7.5 * zoomScale))}px`,
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
        {tr.noLicense && <span title="بدون مجوز حرکت" style={{ fontSize: `${Math.round(8 * zoomScale)}px` }}>🛑</span>}
      </div>
    );
  };

  // تابع رندر یک ردیف ریل با نام و بج قطار(ها) با محافظت از حاشیه و پشتیبانی کلیک‌راست
  const renderMapSlotRow = (line: LineData, label: string) => {
    const lineTrains = trainsByLine.get(line.id) || [];
    const isActive = (line as any).isActive !== false;
    const isDropOver = dragOverLineId === line.id;

    return (
      <div
        key={line.id}
        onClick={() => onSelectLine(line)}
        onContextMenu={(e) => handleLineContextMenu(e, line, lineTrains[0])}
        onDragOver={(e) => {
          if (!canCreateManovr) return;
          e.preventDefault();
          if (isActive) {
            e.dataTransfer.dropEffect = "move";
          } else {
            e.dataTransfer.dropEffect = "none";
          }
          if (dragOverLineId !== line.id) {
            setDragOverLineId(line.id);
          }
        }}
        onDragLeave={(e) => {
          if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
            return;
          }
          if (dragOverLineId === line.id) {
            setDragOverLineId(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverLineId(null);
          if (!canCreateManovr || !isActive) return;
          const rawId = e.dataTransfer.getData("trainId") || e.dataTransfer.getData("text/plain");
          const trainId = rawId
            ? Number(rawId)
            : (draggedTrainRef.current ?? (typeof window !== "undefined" ? (window as any).__depotDraggedTrainId : null));
          if (!trainId) return;
          onDropTrainToLine(trainId, line);
        }}
        title={
          !isActive
            ? `خط ${label} مسدود است`
            : lineTrains.length === 0
            ? `کلیک جهت ثبت مانور و انتقال ناوگان به ریل ${label}`
            : undefined
        }
        className={isDropOver ? (isActive ? "depot-drop-active" : "depot-drop-blocked") : ""}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 8px",
          borderBottom: "1px solid var(--line-soft)",
          cursor: isActive ? "pointer" : "not-allowed",
          opacity: isActive ? 1 : 0.55,
          textDecoration: isActive ? "none" : "line-through",
          transition: "background 0.15s ease",
          minHeight: "32px",
        }}
        onMouseEnter={(e) => {
          if (!isDropOver) {
            e.currentTarget.style.backgroundColor = "rgba(var(--accent-rgb, 216, 132, 42), 0.06)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDropOver) {
            e.currentTarget.style.backgroundColor = "transparent";
          }
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

  // تابع رندر ردیف شماره‌دار پارکینگ (مثل پارکینگ شمالی/جنوبی) با حفظ قطعی حاشیه پایین
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

    const lineTrains = trainsByLine.get(line.id) || [];
    const isActive = (line as any).isActive !== false;
    const isDropOver = dragOverLineId === line.id;

    return (
      <div
        key={line.id}
        onClick={() => onSelectLine(line)}
        onContextMenu={(e) => handleLineContextMenu(e, line, lineTrains[0])}
        onDragOver={(e) => {
          if (!canCreateManovr) return;
          e.preventDefault();
          if (isActive) {
            e.dataTransfer.dropEffect = "move";
          } else {
            e.dataTransfer.dropEffect = "none";
          }
          if (dragOverLineId !== line.id) {
            setDragOverLineId(line.id);
          }
        }}
        onDragLeave={(e) => {
          if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
            return;
          }
          if (dragOverLineId === line.id) {
            setDragOverLineId(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverLineId(null);
          if (!canCreateManovr || !isActive) return;
          const rawId = e.dataTransfer.getData("trainId") || e.dataTransfer.getData("text/plain");
          const trainId = rawId
            ? Number(rawId)
            : (draggedTrainRef.current ?? (typeof window !== "undefined" ? (window as any).__depotDraggedTrainId : null));
          if (!trainId) return;
          onDropTrainToLine(trainId, line);
        }}
        title={
          !isActive
            ? `خط ${line.name} مسدود است`
            : lineTrains.length === 0
            ? `کلیک جهت ثبت مانور و انتقال ناوگان به ${line.name}`
            : undefined
        }
        className={isDropOver ? (isActive ? "depot-drop-active" : "depot-drop-blocked") : ""}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "3px 8px",
          borderBottom: "1px solid var(--line-soft)",
          cursor: isActive ? "pointer" : "not-allowed",
          opacity: isActive ? 1 : 0.55,
          transition: "background 0.15s ease",
          minHeight: "30px",
        }}
        onMouseEnter={(e) => {
          if (!isDropOver) {
            e.currentTarget.style.backgroundColor = "rgba(var(--accent-rgb, 216, 132, 42), 0.06)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDropOver) {
            e.currentTarget.style.backgroundColor = "transparent";
          }
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

  // داده‌های دسته‌بندی‌شده خطوط به همراه نگاشت O(1) شماره خطوط پارکینگ
  const {
    mainLineObj,
    otherLines,
    aliabadLines,
    sub1Lines,
    sub2Lines,
    wagonLines,
    dieselLines,
    northParkLines,
    southParkLines,
    northParkMap,
    southParkMap,
  } = useMemo(() => {
    let mainLine: LineData | undefined;
    const other: LineData[] = [];
    const aliabad: LineData[] = [];
    const sub1: LineData[] = [];
    const sub2: LineData[] = [];
    const wagon: LineData[] = [];
    const diesel: LineData[] = [];
    const northPark: LineData[] = [];
    const southPark: LineData[] = [];

    for (const l of lines ?? []) {
      const isAliabad =
        l.terminal === 9 ||
        l.name.includes("علی‌آباد") ||
        l.name.includes("علی اباد") ||
        l.tag?.includes("aliabad");

      const isMain =
        l.name === "خط اصلی" ||
        l.tag === "S_OriginalLine" ||
        l.tag === "MAIN" ||
        l.name.startsWith("خط اصلی");

      if (isMain) {
        mainLine = l;
      } else if (isAliabad) {
        aliabad.push(l);
      } else if (l.terminal === 8) {
        other.push(l);
      } else if (l.terminal === 6 || l.tag?.startsWith("Alt_Davar") || l.tag === "Alt_Abgiri" || l.tag === "Alt_CoorLine2") {
        sub1.push(l);
      } else if (l.terminal === 7 || l.tag?.startsWith("Alt_") || l.tag?.startsWith("slole-") || l.name.includes("سوله")) {
        sub2.push(l);
      } else if (l.terminal === 2 || l.tag?.startsWith("Wagon_")) {
        wagon.push(l);
      } else if (l.terminal === 1 || l.tag?.startsWith("Dizel_")) {
        diesel.push(l);
      } else if (l.terminal === 4 || l.tag?.startsWith("ShParking_")) {
        northPark.push(l);
      } else if (l.terminal === 5 || l.tag?.startsWith("JParking_")) {
        southPark.push(l);
      } else if (l.terminal === 3) {
        if (!mainLine) {
          mainLine = l;
        } else {
          other.push(l);
        }
      } else {
        other.push(l);
      }
    }

    other.sort((a, b) => {
      const ma = toEnglishDigits(a.name).match(/(\d+)/);
      const mb = toEnglishDigits(b.name).match(/(\d+)/);
      if (ma && mb) return parseInt(ma[1], 10) - parseInt(mb[1], 10);
      return a.name.localeCompare(b.name, "fa");
    });
    northPark.sort((a, b) => a.id - b.id);
    southPark.sort((a, b) => a.id - b.id);

    const nMap = new Map<number, LineData>();
    northPark.forEach((l, idx) => {
      const rawLabel = l.tag || l.name;
      const engDigits = toEnglishDigits(rawLabel);
      const digitOnly = engDigits.replace(/[^\d]/g, "");
      const parsedNum = digitOnly ? parseInt(digitOnly, 10) : NaN;
      const num = !isNaN(parsedNum) ? parsedNum : idx + 1;
      nMap.set(num, l);
    });

    const sMap = new Map<number, LineData>();
    southPark.forEach((l, idx) => {
      const rawLabel = l.tag || l.name;
      const engDigits = toEnglishDigits(rawLabel);
      const digitOnly = engDigits.replace(/[^\d]/g, "");
      const parsedNum = digitOnly ? parseInt(digitOnly, 10) : NaN;
      const num = !isNaN(parsedNum) ? parsedNum : idx + 1;
      sMap.set(num, l);
    });

    return {
      mainLineObj: mainLine,
      otherLines: other,
      aliabadLines: aliabad,
      sub1Lines: sub1,
      sub2Lines: sub2,
      wagonLines: wagon,
      dieselLines: diesel,
      northParkLines: northPark,
      southParkLines: southPark,
      northParkMap: nMap,
      southParkMap: sMap,
    };
  }, [lines]);

  const mainLineTrains = useMemo(() => {
    if (!mainLineObj) return [];
    // تمام قطارهای متعلق به خط اصلی (شامل ریل‌های با برچسب یا نام خط اصلی)
    const mainLineIds = new Set<number>([mainLineObj.id]);
    for (const l of lines ?? []) {
      if (
        l.id === mainLineObj.id ||
        l.name === "خط اصلی" ||
        l.tag === "S_OriginalLine" ||
        l.tag === "MAIN" ||
        l.name.startsWith("خط اصلی")
      ) {
        mainLineIds.add(l.id);
      }
    }
    const allTrains: TrainData[] = [];
    for (const id of mainLineIds) {
      const list = trainsByLine.get(id);
      if (list) allTrains.push(...list);
    }
    return allTrains.sort((a, b) => a.slotIndex - b.slotIndex);
  }, [mainLineObj, lines, trainsByLine]);

  const zoomScale = Math.max(0.7, Math.min(2.0, (zoom || 100) / 100));

  const mainLineColumns = useMemo(() => {
    const colCount = mainLineTrains.length > 10 ? Math.min(Math.ceil(mainLineTrains.length / 10), 3) : 1;
    const perCol = Math.ceil(mainLineTrains.length / colCount);
    return Array.from({ length: colCount }, (_, ci) =>
      mainLineTrains.slice(ci * perCol, (ci + 1) * perCol)
    );
  }, [mainLineTrains]);

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

      {/* گرید اصلی نقشه پایانه با تثبیت صریح ستون‌ها و ردیف‌ها بدون تغییر مقیاس جداول */}
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
        {/* ستون ۱ (راست‌ترین در RTL): پارکینگ جنوبی */}
        {renderSection(
          "پارکینگ جنوبی",
          "🅿️",
          { primary: "#0ea5e9", secondary: "#38bdf8", accent: "#7dd3fc" },
          <>
            {Array.from({ length: 25 }, (_, i) => {
              const parkLine = southParkMap.get(i + 1) || southParkLines[i];
              return renderParkingNumberedRow(parkLine, i + 1);
            })}
          </>,
          { gridColumn: "1 / 2", gridRow: "1 / 3" }
        )}

        {/* ستون ۲: پارکینگ شمالی */}
        {renderSection(
          "پارکینگ شمالی",
          "🅿️",
          { primary: "#14b8a6", secondary: "#2dd4bf", accent: "#5eead4" },
          <>
            {Array.from({ length: 25 }, (_, i) => {
              const parkLine = northParkMap.get(i + 1) || northParkLines[i];
              return renderParkingNumberedRow(parkLine, i + 1);
            })}
          </>,
          { gridColumn: "2 / 3", gridRow: "1 / 3" }
        )}

        {/* ستون ۳: خط اصلی (بالا) + سایر خطوط (وسط) + پایانه علی‌آباد (پایین) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isFocusMode ? "4px" : "10px",
            gridColumn: "3 / 4",
            gridRow: "1 / 3",
            overflow: "hidden",
          }}
        >
          {/* خط اصلی */}
          {renderSection(
            "خط اصلی",
            "🚉",
            { primary: "#22c55e", secondary: "#4ade80", accent: "#86efac" },
            <div
              onClick={() => mainLineObj && onSelectLine(mainLineObj)}
              onContextMenu={(e) => mainLineObj && handleLineContextMenu(e, mainLineObj)}
              onDragOver={(e) => {
                if (canCreateManovr && mainLineObj) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverLineId !== mainLineObj.id) {
                    setDragOverLineId(mainLineObj.id);
                  }
                }
              }}
              onDragLeave={(e) => {
                if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (mainLineObj && dragOverLineId === mainLineObj.id) {
                  setDragOverLineId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverLineId(null);
                if (!canCreateManovr || !mainLineObj) return;
                const rawId = e.dataTransfer.getData("trainId") || e.dataTransfer.getData("text/plain");
                const trainId = rawId ? Number(rawId) : (draggedTrainRef.current ?? (typeof window !== "undefined" ? (window as any).__depotDraggedTrainId : null));
                if (!trainId) return;
                onDropTrainToLine(trainId, mainLineObj);
              }}
              className={mainLineObj && dragOverLineId === mainLineObj.id ? "depot-drop-active" : ""}
              style={{ cursor: "pointer", transition: "background 0.15s ease", padding: "6px" }}
            >
              {/* هدر ستون‌ها */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    mainLineTrains.length > 10
                      ? `repeat(${Math.min(Math.ceil(mainLineTrains.length / 10), 3)}, 1fr)`
                      : "1fr",
                  gap: mainLineTrains.length > 10 ? "8px" : "0",
                }}
              >
                {mainLineColumns.map((colTrains, ci) => (
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
                                globalDraggedTrainId = tr.id;
                                draggedTrainRef.current = tr.id;
                                if (typeof window !== "undefined") (window as any).__depotDraggedTrainId = tr.id;
                                e.dataTransfer.setData("trainId", String(tr.id));
                                e.dataTransfer.setData("text/plain", String(tr.id));
                                e.dataTransfer.effectAllowed = "move";
                                e.currentTarget.style.opacity = "0.4";
                              }
                            }}
                            onDragEnd={(e) => {
                              globalDraggedTrainId = null;
                              draggedTrainRef.current = null;
                              if (typeof window !== "undefined") (window as any).__depotDraggedTrainId = null;
                              e.currentTarget.style.opacity = "1";
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTrain(tr);
                            }}
                            onContextMenu={(e) => {
                              handleTrainContextMenu(e, tr);
                            }}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "38px 42px 1fr",
                              alignItems: "center",
                              borderBottom: "1px solid var(--line-soft)",
                              padding: "3px 2px",
                              cursor: canCreateManovr ? "grab" : "pointer",
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
                              {tr.type === 0 ? "AC" : tr.type === 1 ? "DC" : "دیزل"}
                            </span>
                            <div style={{ textAlign: "center" }}>
                              <span
                                style={{
                                  fontWeight: "bold",
                                  padding: `${Math.max(1, Math.round(1.5 * zoomScale))}px ${Math.max(4, Math.round(7 * zoomScale))}px`,
                                  borderRadius: "4px",
                                  backgroundColor: trStyle.badge,
                                  color: "#fff",
                                  fontSize: `${Math.round(10.5 * zoomScale)}px`,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: `${Math.max(2, Math.round(3 * zoomScale))}px`,
                                  transition: "font-size 0.15s ease, padding 0.15s ease",
                                }}
                                className="num"
                              >
                                <trStyle.IconComp size={Math.round(9 * zoomScale)} weight="bold" />
                                <span style={{ fontSize: `${Math.round(10.5 * zoomScale)}px`, letterSpacing: "0.5px" }}>{tr.code}</span>
                                {tr.hasKafshak && <span style={{ fontSize: `${Math.round(7 * zoomScale)}px` }}>⚡</span>}
                                {tr.noAtp && <span style={{ fontSize: `${Math.round(7 * zoomScale)}px` }}>🚨</span>}
                                {tr.noLicense && <span style={{ fontSize: `${Math.round(7 * zoomScale)}px` }}>🛑</span>}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
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
                      {emptySlots.slice(0, 12).map((slotIdx) => {
                        const isSlotOver = dragOverMainLineSlot === slotIdx;
                        return (
                          <div
                            key={slotIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectEmptySlot) onSelectEmptySlot(null, mainLineObj.id, slotIdx);
                            }}
                            onContextMenu={(e) => {
                              handleLineContextMenu(e, mainLineObj);
                            }}
                            onDragOver={(e) => {
                              if (canCreateManovr) {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = "move";
                                if (dragOverMainLineSlot !== slotIdx) {
                                  setDragOverMainLineSlot(slotIdx);
                                }
                              }
                            }}
                            onDragLeave={(e) => {
                              if (dragOverMainLineSlot === slotIdx) {
                                setDragOverMainLineSlot(null);
                              }
                            }}
                            onDrop={(e) => {
                              if (!canCreateManovr || !mainLineObj) return;
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverMainLineSlot(null);
                              const rawId = e.dataTransfer.getData("trainId") || e.dataTransfer.getData("text/plain");
                              const trainId = rawId ? Number(rawId) : (draggedTrainRef.current ?? (typeof window !== "undefined" ? (window as any).__depotDraggedTrainId : null));
                              if (!trainId) return;
                              onDropTrainToLine(trainId, mainLineObj, slotIdx);
                            }}
                            className={isSlotOver ? "depot-drop-active" : ""}
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
                              if (!isSlotOver) {
                                e.currentTarget.style.borderColor = "var(--accent)";
                                e.currentTarget.style.color = "var(--accent)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSlotOver) {
                                e.currentTarget.style.borderColor = "var(--line)";
                                e.currentTarget.style.color = "var(--ink-faint)";
                              }
                            }}
                            title={`افزودن قطار به جایگاه ${slotIdx + 1}`}
                          >
                            <span className="num">{slotIdx + 1}</span>
                          </div>
                        );
                      })}
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

        {/* ستون ۴: واگن‌سازی (ردیف بالا) */}
        {renderSection(
          "واگن‌سازی",
          "🏗️",
          { primary: "#f59e0b", secondary: "#fbbf24", accent: "#fde68a" },
          <>
            {WAGON_NUMBERED.map((name) => {
              const line = findLineByName(name);
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
            {WAGON_SPECIAL.map((name) => {
              const line = findLineByName(name);
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
          { gridColumn: "4 / 5", gridRow: "1 / 2" }
        )}

        {/* ستون ۵ (چپ‌ترین در RTL): دیزل‌شاپ (ردیف بالا) */}
        {renderSection(
          "دیزل‌شاپ",
          "🚂",
          { primary: "#ef4444", secondary: "#f87171", accent: "#fca5a5" },
          <>
            {DIESEL_SPECIAL_NAMES.map((name) => {
              const line = findLineByName(name);
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
            {DIESEL_NUMBERED.map((name) => {
              const line = findLineByName(name);
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
            {DIESEL_FACTORY.map((name) => {
              const line = findLineByName(name);
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
          { gridColumn: "5 / 6", gridRow: "1 / 2" }
        )}

        {/* ستون ۴ - ردیف پایین: فرعی ۱ (زیر واگن‌سازی) */}
        {renderSection(
          "فرعی ۱",
          "🛤️",
          { primary: "#8b5cf6", secondary: "#a78bfa", accent: "#c4b5fd" },
          <>
            {sub1Lines.map((l) => renderMapSlotRow(l, getPersianLineTitle(l)))}
            {sub1Lines.length === 0 && (
              <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>بدون خط</div>
            )}
          </>,
          { gridColumn: "4 / 5", gridRow: "2 / 3" }
        )}

        {/* ستون ۵ - ردیف پایین: فرعی ۲ (زیر دیزل‌شاپ) */}
        {renderSection(
          "فرعی ۲",
          "🛤️",
          { primary: "#ec4899", secondary: "#f472b6", accent: "#f9a8d4" },
          <>
            {sub2Lines.map((l) => renderMapSlotRow(l, getPersianLineTitle(l)))}
            {sub2Lines.length === 0 && (
              <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>بدون خط</div>
            )}
          </>,
          { gridColumn: "5 / 6", gridRow: "2 / 3" }
        )}
      </div>
    </div>
  );
}
