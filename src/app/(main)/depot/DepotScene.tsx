"use client";

import React, { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows, Environment, Grid } from "@react-three/drei";
import * as THREE from "three";
import { Terminal as TerminalEnum, TrainType, ManovrType } from "@/lib/enums";
import { isPermanentTransfer } from "@/lib/manovr-rules";
import { createManovr } from "@/app/actions/manovr";
import { saveLinePositions, toggleLineActive } from "@/app/actions/line";
import { relocateTrainDirectly, updateTrainStatus, updateTrainFlags } from "@/app/actions/train";
import { useTheme } from "@/components/ThemeProvider";
import JalaliDateTimePicker from "@/components/JalaliDateTimePicker";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

import IndustrialShed from "./scene3d/Shed";
import TrainModel3D from "./scene3d/TrainModel";
import { ZONE_CONFIG, STATUS_STYLE } from "@/lib/depot-visuals";
import { Icons } from "@/lib/icons";
import SearchableSelect from "@/components/SearchableSelect";
import { BorderRotate } from "@/components/ui/animated-gradient-border";


// کامپوننت هدایت دوربین سه‌بعدی برای زوم روی سوله‌ها
function CameraDirector({
  focusTarget,
  controlsRef,
}: {
  focusTarget: [number, number, number] | null;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera, invalidate } = useThree();

  useFrame(() => {
    if (focusTarget && controlsRef.current) {
      const targetVec = new THREE.Vector3(...focusTarget);
      const currentTarget = controlsRef.current.target;
      const distTarget = currentTarget.distanceTo(targetVec);

      const targetCamPos = new THREE.Vector3(focusTarget[0], focusTarget[1] + 60, focusTarget[2] + 75);
      const distCam = camera.position.distanceTo(targetCamPos);

      if (distTarget > 0.05 || distCam > 0.05) {
        controlsRef.current.target.x = THREE.MathUtils.lerp(controlsRef.current.target.x, focusTarget[0], 0.08);
        controlsRef.current.target.y = THREE.MathUtils.lerp(controlsRef.current.target.y, focusTarget[1], 0.08);
        controlsRef.current.target.z = THREE.MathUtils.lerp(controlsRef.current.target.z, focusTarget[2], 0.08);

        camera.position.x = THREE.MathUtils.lerp(camera.position.x, focusTarget[0], 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, focusTarget[1] + 60, 0.05);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, focusTarget[2] + 75, 0.05);

        controlsRef.current.update();
        invalidate();
      }
    }
  });

  return null;
}

interface LineData {
  id: number;
  name: string;
  tag: string | null;
  capacity: number;
  terminal: number;
  isDynamic: boolean;
  posX: number;
  posY: number;
  rotation: number;
  length: number;
}

interface TrainData {
  id: number;
  code: string;
  type: number;
  isDisposed: boolean;
  lineId: number | null;
  slotIndex: number;
  status: number;
  hasKafshak?: boolean;
  noAtp?: boolean;
  movadDavvar?: string | null;
  noLicense?: boolean;
}

interface DepotSceneProps {
  lines: LineData[];
  initialTrains: TrainData[];
  activeManovrs: { id: number; trainId: number | null; destinationLineId: number | null }[];
  rahbaran: { id: number; name: string }[];
  terminals: { id: number; code: number; label: string; color: string | null; meta: string }[];
  manovrTypes?: { code: number; label: string; color?: string | null; isActive?: boolean }[];
  canLayout: boolean;
  canCreateManovr: boolean;
  canManageLines: boolean;
  canEditKafshak?: boolean;
  canEditAtp?: boolean;
  canEditRotary?: boolean;
  canEditLicense?: boolean;
  prefs: { quality: string; refreshSec: number; defaultTerminal: number; view2DMode?: "grid" | "structured" | "map" };
}

// ----------------------------------------------------
// کامپوننت‌های فرعی صحنه سه‌بعدی
// ----------------------------------------------------

function CameraController({ defaultTerminal, lines, zones }: { defaultTerminal: number; lines: LineData[]; zones: any }) {
  const { camera } = useThree();

  useEffect(() => {
    // دوربین به سمت ترمینال پیش‌فرض هدایت می‌شود
    if (defaultTerminal > 0 && zones[defaultTerminal]) {
      const zone = zones[defaultTerminal];
      camera.position.set(zone.x, 90, zone.z + 130);
      camera.lookAt(new THREE.Vector3(zone.x, 0, zone.z));
    } else {
      // نمای کلی — قاب‌گیری کل چیدمان (X از ~-580 تا ~+580)
      camera.position.set(0, 380, 420);
      camera.lookAt(new THREE.Vector3(0, 0, 0));
    }
  }, [defaultTerminal, camera, zones]);

  return null;
}



// ----------------------------------------------------
// کامپوننت اصلی کلاینت‌ساید دپو
// ----------------------------------------------------

export default function DepotScene({
  lines,
  initialTrains,
  activeManovrs,
  rahbaran,
  terminals,
  manovrTypes = [],
  canLayout,
  canCreateManovr,
  canManageLines,
  canEditKafshak,
  canEditAtp,
  canEditRotary,
  canEditLicense,
  prefs,
}: DepotSceneProps) {
  const router = useRouter();

  // ساخت پویای مختصات و پیکربندی زون‌ها بر اساس ترمینال‌های دیتابیس
  const ZONES = useMemo(() => {
    const map: Record<number, { x: number; z: number; label: string; color: string; gridCol: number; gridRow: "top" | "bottom" | "full" }> = {};
    terminals.forEach((t) => {
      let meta: any = {};
      try {
        meta = JSON.parse(t.meta || "{}");
      } catch { }
      map[t.code] = {
        x: typeof meta.x === "number" ? meta.x : 0,
        z: typeof meta.z === "number" ? meta.z : 0,
        label: t.label,
        color: t.color || "#cbd5e1",
        gridCol: typeof meta.gridCol === "number" ? meta.gridCol : 1,
        gridRow: meta.gridRow || "full",
      };
    });
    return map;
  }, [terminals]);

  // گروه‌بندی پایانه بر اساس ستون‌های ۲بعدی
  const columnsData = useMemo(() => {
    const cols: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    terminals.forEach((t) => {
      let meta: any = {};
      try {
        meta = JSON.parse(t.meta || "{}");
      } catch { }
      const colIdx = typeof meta.gridCol === "number" ? meta.gridCol : 1;
      const row = meta.gridRow || "full";

      if (!cols[colIdx]) cols[colIdx] = [];
      cols[colIdx].push({ ...t, gridRow: row, metaParsed: meta });
    });

    // مرتب‌سازی هر ستون: ابتدا ردیف‌های top، سپس full، سپس bottom
    for (const c in cols) {
      cols[c].sort((a, b) => {
        const order: Record<string, number> = { top: 1, full: 2, bottom: 3 };
        return (order[a.gridRow] || 2) - (order[b.gridRow] || 2);
      });
    }
    return cols;
  }, [terminals]);
  useLiveRefresh(["manovr_changed", "train_changed"]);
  const { appearance } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [trains, setTrains] = useState<TrainData[]>(initialTrains);
  const [selectedTrain, setSelectedTrain] = useState<TrainData | null>(null);
  const [selectedLine, setSelectedLine] = useState<LineData | null>(null);
  const [hoveredLineId, setHoveredLineId] = useState<number | null>(null);

  // سیستم زوم و فوکوس دوربین روی سوله‌ها
  const [cameraFocusTarget, setCameraFocusTarget] = useState<[number, number, number] | null>(null);
  const controlsRef = useRef<any>(null);
  const sceneContainerRef = useRef<HTMLDivElement>(null);

  // سیستم مدیریت تب و مشخصات مانور روی خطوط ریل
  const [activeLineTab, setActiveLineTab] = useState<"details" | "manovr" | "relocate">("details");
  const [manovrTrainId, setManovrTrainId] = useState<number | "">("");
  const [manovrSourceLineId, setManovrSourceLineId] = useState<number | "">("");
  const [manovrDestLineId, setManovrDestLineId] = useState<number | "">("");
  const [manovrSlotIdx, setManovrSlotIdx] = useState<number>(0);
  const [manovrRahbar1, setManovrRahbar1] = useState<number | "">("");
  const [manovrRahbar2, setManovrRahbar2] = useState<number | "">("");
  const [manovrType, setManovrType] = useState<number>(2);
  const [manovrDesc, setManovrDesc] = useState<string>("");

  const [successMsg, setSuccessMsg] = useState<string>("");

  // فیلدهای جابجایی سریع ادمین
  const [relocateTrainId, setRelocateTrainId] = useState<number | "">("");
  const [relocateLineId, setRelocateLineId] = useState<number | "">("");
  const [relocateSlotIdx, setRelocateSlotIdx] = useState<number>(0);
  const [newTrainIdState, setNewTrainIdState] = useState<number | "">("");

  // وضعیت کیفیت و نمای ۲بعدی/۳بعدی جاری
  const [currentQuality, setCurrentQuality] = useState<string>("2d");
  const [view2DMode, setView2DMode] = useState<"grid" | "structured" | "map">(prefs.view2DMode || "map");
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  // تابع کمکی سوئیچ بین حالت تمام‌صفحه مرورگر (HTML5 Fullscreen) و معمولی
  // فقط container دپو fullscreen می‌شود تا PageHeader و عملیات پایانه مخفی شوند
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const el = sceneContainerRef.current || document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().then(() => setIsFocusMode(true)).catch(() => setIsFocusMode(true));
      } else {
        setIsFocusMode(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFocusMode(false)).catch(() => setIsFocusMode(false));
      } else {
        setIsFocusMode(false);
      }
    }
  };

  // همگام‌سازی وضعیت حالت تمام‌صفحه با کلید Esc یا خروج از Fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFocusMode(false);
      } else {
        setIsFocusMode(true);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // شناسه قطار پیش‌انتخاب شده برای مودال مانور کشیدن و رها کردن
  const [preSelectedTrainId, setPreSelectedTrainId] = useState<number | "">("");

  // زمان اجرای مانور انتخابی کاربر
  const [manovrExecutionTime, setManovrExecutionTime] = useState<string>(new Date().toISOString());

  // ریست کردن فیلدهای مودال با تغییر ریل انتخابی
  useEffect(() => {
    if (selectedLine) {
      setActiveLineTab("details");
      setManovrTrainId("");
      setManovrSourceLineId(selectedLine.id);
      setManovrDestLineId("");
      setManovrSlotIdx(0);
      setManovrRahbar1("");
      setManovrRahbar2("");
      setManovrType(2);
      setManovrDesc("");
      setManovrExecutionTime(new Date().toISOString());

      setRelocateTrainId("");
      setRelocateLineId(selectedLine.id);
      setRelocateSlotIdx(0);
      setNewTrainIdState("");
    }
  }, [selectedLine]);

  // همگام‌سازی وضعیت قطارها با تغییر پروپس ورودی از سرور
  useEffect(() => {
    setTrains(initialTrains);
  }, [initialTrains]);

  // وضعیت درگ سه‌بعدی
  const [draggedTrainId, setDraggedTrainId] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<[number, number, number]>([0, 0, 0]);

  // مودال‌ها
  const [showManovrModal, setShowManovrModal] = useState(false);
  const [showLineModal, setShowLineModal] = useState(false);
  const [sourceLineId, setSourceLineId] = useState<number | null>(null);
  const [destLineId, setDestLineId] = useState<number | null>(null);
  const [targetSlot, setTargetSlot] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // تغییرات چیدمان ریل‌ها توسط ادمین
  const [modifiedPositions, setModifiedPositions] = useState<Record<number, { posX: number; posY: number; rotation: number }>>({});
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  // مدیریت رفرش خودکار بر اساس پولینگ
  useEffect(() => {
    if (prefs.refreshSec === 0) return;
    const timer = setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, prefs.refreshSec * 1000);
    return () => clearInterval(timer);
  }, [prefs.refreshSec, router]);

  // رویداد فشردن کیبورد Ctrl+K برای جستجو
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // شروع درگ قطار
  const handleTrainDragStart = (trainId: number, initialPos: [number, number, number]) => {
    if (!canCreateManovr) return;
    setDraggedTrainId(trainId);
    setDragPos(initialPos);
  };

  // رها کردن قطار و باز شدن مودال ثبت مانور
  const handleTrainDragEnd = (lineId: number, slotIdx: number) => {
    if (draggedTrainId === null) return;
    const trainObj = trains.find((t) => t.id === draggedTrainId);
    if (!trainObj) return;

    setSourceLineId(trainObj.lineId);
    setDestLineId(lineId);
    setTargetSlot(slotIdx);
    setPreSelectedTrainId(trainObj.id);
    setShowManovrModal(true);

    setDraggedTrainId(null);
  };

  const handleCreateManovrSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (sourceLineId) fd.append("sourceLineId", String(sourceLineId));
    if (destLineId) fd.append("destinationLineId", String(destLineId));
    fd.append("slotIndex", String(targetSlot));
    fd.append("noRedirect", "1");

    const res = await createManovr(null, fd);
    if (res?.error) {
      alert(res.error);
    } else {
      setShowManovrModal(false);
      setSuccessMsg("مانور با موفقیت ثبت شد و در سیستم قرار گرفت.");
      router.refresh();
    }
  };

  // ذخیره چیدمان ریل‌ها پس از درگ در حالت ادمین
  const handleSaveLayout = async () => {
    setIsSavingLayout(true);
    const payload = Object.entries(modifiedPositions).map(([id, val]) => ({
      id: Number(id),
      posX: val.posX,
      posY: val.posY,
      rotation: val.rotation,
    }));

    const res = await saveLinePositions(payload);
    setIsSavingLayout(false);
    if (res.error) {
      alert(res.error);
    } else {
      setModifiedPositions({});
      alert("چیدمان پایانه با موفقیت در دیتابیس ثبت شد.");
      router.refresh();
    }
  };

  // فیلتر کردن ریل‌ها بر اساس جستجوی کاربر
  const filteredSearchList = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    const matchesLine = lines.filter((l) => l.name.toLowerCase().includes(q) || (l.tag && l.tag.toLowerCase().includes(q)));
    const matchesTrain = trains.filter((t) => t.code.toLowerCase().includes(q));

    return [
      ...matchesLine.map((l) => ({ type: "line" as const, id: l.id, title: `خط: ${l.name}`, obj: l })),
      ...matchesTrain.map((t) => ({ type: "train" as const, id: t.id, title: `قطار شماره ${t.code}`, obj: t })),
    ];
  }, [searchQuery, lines, trains]);

  const handleSearchResultClick = (item: any) => {
    if (item.type === "train") {
      setSelectedTrain(item.obj);
    } else {
      setSelectedLine(item.obj);
    }
    setShowSearch(false);
    setSearchQuery("");
  };

  // ----------------------------------------------------
  // نمای دوبعدی SVG تعاملی
  // ----------------------------------------------------
  const render2DMap = () => {
    // تابع کمکی برای رندر خانه‌های ریل به صورت ۲بعدی تعاملی
    const renderSlot = (lineName: string, label: string) => {
      const line = lines.find(l => l.name === lineName);
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

      const lineTrains = trains.filter(t => t.lineId === line.id && !t.isDisposed).sort((a, b) => a.slotIndex - b.slotIndex);
      const hasTrain = lineTrains.length > 0;
      const train = lineTrains[0];
      const style = hasTrain ? (STATUS_STYLE[train.status] || STATUS_STYLE[1]) : null;
      const isActive = (line as any).isActive !== false;

      if (!isActive) {
        return (
          <div
            key={lineName}
            onClick={() => {
              if (canManageLines) {
                setSelectedLine(line);
                setDestLineId(line.id);
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
          onClick={() => {
            setSelectedLine(line);
            setDestLineId(line.id);
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
            const trId = Number(trIdStr);
            const trainObj = trains.find((t) => t.id === trId);
            if (!trainObj) return;

            e.currentTarget.style.borderColor = style ? style.border : "var(--line)";
            e.currentTarget.style.backgroundColor = style ? style.bg : "color-mix(in oklab, var(--bg) 60%, var(--panel))";

            if (trainObj.lineId === line.id) return;

            const occupiedSlots = trains.filter(t => t.lineId === line.id && !t.isDisposed).map(t => t.slotIndex);
            if (occupiedSlots.length >= line.capacity) {
              alert("ظرفیت ریل مقصد تکمیل است.");
              return;
            }

            let targetSlotIdx = 0;
            for (let idx = 0; idx < line.capacity; idx++) {
              if (!occupiedSlots.includes(idx)) {
                targetSlotIdx = idx;
                break;
              }
            }

            setSourceLineId(trainObj.lineId);
            setDestLineId(line.id);
            setTargetSlot(targetSlotIdx);
            setPreSelectedTrainId(trainObj.id);
            setShowManovrModal(true);
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
                          lineHeight: "1.2"
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

    const getHeaderStyle = (terminalId: number) => {
      const config = ZONE_CONFIG[terminalId];
      const accentColor = config?.color || "var(--accent)";
      return {
        borderRadius: "var(--r-md)",
        overflow: isFocusMode ? "visible" : "hidden",
        backgroundColor: "var(--panel)",
        border: "1px solid var(--line)",
        borderTop: `4px solid ${accentColor}`,
        boxShadow: "var(--sh-2)",
        transition: "var(--transition-fluid)",
      };
    };

    const getGradientColorsForTerminal = (terminalId: number) => {
      switch (terminalId) {
        case 1: // دیزل‌شاپ
          return { primary: '#ef4444', secondary: '#f87171', accent: '#fca5a5' };
        case 2: // واگن‌سازی
          return { primary: '#f59e0b', secondary: '#fbbf24', accent: '#fde68a' };
        case 4: // پارکینگ شمالی
          return { primary: '#3b82f6', secondary: '#60a5fa', accent: '#93c5fd' };
        case 5: // پارکینگ جنوبی
          return { primary: '#06b6d4', secondary: '#22d3ee', accent: '#67e8f9' };
        case 6: // خطوط فرعی غرب
          return { primary: '#8b5cf6', secondary: '#a78bfa', accent: '#c4b5fd' };
        case 7: // خطوط فرعی شرق
          return { primary: '#ec4899', secondary: '#f472b6', accent: '#f9a8d4' };
        case 3: // خط اصلی
          return { primary: '#64748b', secondary: '#94a3b8', accent: '#cbd5e1' };
        case 8: // سایر خطوط
          return { primary: '#475569', secondary: '#64748b', accent: '#cbd5e1' };
        default:
          return { primary: '#64748b', secondary: '#94a3b8', accent: '#cbd5e1' };
      }
    };

    const getInnerCardStyle = () => {
      return {
        width: "100%",
        height: isFocusMode ? undefined : "100%",
        display: "flex",
        flexDirection: "column" as const,
        overflow: isFocusMode ? "visible" : "hidden",
      };
    };

    const getTitleStyle = (terminalId: number) => {
      return {
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
      };
    };

    return (
      <div
        style={{
          flex: 1,
          width: "100%",
          overflow: "auto",
          padding: "20px",
          backgroundColor: appearance.theme === "dark" ? "#070a12" : "#f1f5f9",
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
          <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#f59e0b", color: "#fff", fontSize: "11px" }}>⚡ کفشک</span>
          <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#ef4444", color: "#fff", fontSize: "11px" }}>🚨 عدم ATP</span>
          <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#8b5cf6", color: "#fff", fontSize: "11px" }}>🔄 دوار A</span>
          <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#14b8a6", color: "#fff", fontSize: "11px" }}>🔄 دوار B</span>
          <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#f59e0b", color: "#fff", fontSize: "11px" }}>🔄 دوار C</span>
          <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "#be123c", color: "#fff", fontSize: "11px" }}>🛑 بدون مجوز</span>
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
                        <div style={getTitleStyle(5)}>
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
                          <div>
                            {renderSlot("پارکینگ جنوبی 25", "25")}
                          </div>
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
                        <div style={getTitleStyle(6)}>
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
                        <div style={getTitleStyle(4)}>
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
                          <div>
                            {renderSlot("پارکینگ شمالی 25", "25")}
                          </div>
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
                        <div style={getTitleStyle(7)}>
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
                        <div style={getTitleStyle(3)}>
                          <span>{term.label}</span>
                        </div>
                        <div style={{ padding: "14px", flex: isFocusMode ? undefined : 1, overflowY: isFocusMode ? "visible" : "auto" }}>
                          {(() => {
                            const mainLineObj = lines.find(l => l.name === "خط اصلی");
                            if (!mainLineObj) return <div style={{ color: "var(--ink-faint)", textAlign: "center", marginTop: "20px" }}>خط اصلی یافت نشد.</div>;
                            const mainLineTrains = trains.filter(t => t.lineId === mainLineObj.id && !t.isDisposed);
                            return (
                              <div
                                onClick={() => setSelectedLine(mainLineObj)}
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
                                  const trId = Number(trIdStr);
                                  const trainObj = trains.find((t) => t.id === trId);
                                  if (!trainObj) return;

                                  if (trainObj.lineId === mainLineObj.id) return;

                                  const occupiedSlots = trains.filter(t => t.lineId === mainLineObj.id && !t.isDisposed).map(t => t.slotIndex);
                                  if (occupiedSlots.length >= mainLineObj.capacity) {
                                    alert("ظرفیت ریل مقصد تکمیل است.");
                                    return;
                                  }

                                  let targetSlotIdx = 0;
                                  for (let idx = 0; idx < mainLineObj.capacity; idx++) {
                                    if (!occupiedSlots.includes(idx)) {
                                      targetSlotIdx = idx;
                                      break;
                                    }
                                  }

                                  setSourceLineId(trainObj.lineId);
                                  setDestLineId(mainLineObj.id);
                                  setTargetSlot(targetSlotIdx);
                                  setPreSelectedTrainId(trainObj.id);
                                  setShowManovrModal(true);
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
                                    {mainLineTrains.map((tr) => (
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
                                          {(() => {
                                            const trStyle = STATUS_STYLE[tr.status] || STATUS_STYLE[1];
                                            return (
                                              <div
                                                onClick={() => setSelectedTrain(tr)}
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
                                                      lineHeight: "1.2"
                                                    }}
                                                  >
                                                    🔄{tr.movadDavvar}
                                                  </span>
                                                )}
                                                {tr.noLicense && <span title="بدون مجوز حرکت" style={{ fontSize: "10px" }}>🛑</span>}
                                              </div>
                                            );
                                          })()}
                                        </td>
                                        <td style={{ padding: "8px", textAlign: "center" }}>{tr.type === 0 ? "AC" : "DC"}</td>
                                        <td style={{ padding: "8px", textAlign: "center" }} className="num">{tr.slotIndex + 1}</td>
                                      </tr>
                                    ))}
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
                            );
                          })()}
                        </div>
                      </div>
                    </BorderRotate>
                  );
                }
                if (term.code === 8) {
                  const termLines = lines.filter(l => l.terminal === 8).sort((a, b) => {
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
                        <div style={getTitleStyle(8)}>
                          <span>{term.label}</span>
                        </div>
                        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          {termLines.map(l => renderSlot(l.name, l.name))}
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
                        <div style={getTitleStyle(2)}>
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
                        <div style={getTitleStyle(1)}>
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

                // ترمینال‌های جدید دینامیک
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
                      <div style={getTitleStyle(term.code)}>
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
  };

  // ----------------------------------------------------
  // نمای ۲بعدی ساختاریافته جدید (طبق دیاگرام افقی و بنتو)
  // ----------------------------------------------------
  const renderStructured2DMap = () => {
    // تابع کمکی تبدیل اسامی انگلیسی/تکنیکال ریل‌ها به اسامی فارسی کاملاً خوانا
    const getPersianLineTitle = (line: LineData) => {
      let text = line.name || line.tag || "";

      // جایگزینی الگوهای معروف انگلیسی با اسامی فارسی
      text = text
        .replace(/^Dizel_Factory(\d+)/i, "کارخانه $1")
        .replace(/^Dizel_B(\d+)/i, "دیزل شاپ B$1")
        .replace(/^Dizel_(\d+)/i, "دیزل شاپ $1")
        .replace(/^Dizel_TestLine/i, "خط تست دیزل")
        .replace(/^Dizel_Battery/i, "باطری‌خانه")
        .replace(/^Wagon_CoorLine(\d+)/i, "رابط واگن‌سازی $1")
        .replace(/^Wagon_(\d+)/i, "واگن‌سازی $1")
        .replace(/^Alt_CoorLine(\d+)/i, "خط رابط $1")
        .replace(/^Alt_Abgiri/i, "آبگیری")
        .replace(/^Alt_DavarShargi/i, "دوّار شرقی")
        .replace(/^Alt_DavarGarbi/i, "دوّار غربی")
        .replace(/^Alt_Pitline/i, "پیت‌لاین")
        .replace(/^Alt_MetroWash/i, "قطارشویی")
        .replace(/^Alt_MojaverSole/i, "مجاور سوله")
        .replace(/^Alt_MojaverMarkaz/i, "مجاور مرکز")
        .replace(/^khat-aliabad/i, "خط علی‌آباد")
        .replace(/^khat(\d+)/i, "خط $1")
        .replace(/^S_OriginalLine/i, "خط اصلی")
        .replace(/^slole-sharghi/i, "سوله شرقی")
        .replace(/^slole-gharbi/i, "سوله غربی");

      // تبدیل اعداد انگلیسی به اعداد فارسی
      return text.replace(/\d+/g, (d) => Number(d).toLocaleString("fa-IR", { useGrouping: false }));
    };

    // تابع کمکی برای رندر خانه‌های ریل در نمای بنتو
    const renderBentoSlot = (line: LineData) => {
      const label = getPersianLineTitle(line);
      const lineTrains = trains.filter(t => t.lineId === line.id && !t.isDisposed).sort((a, b) => a.slotIndex - b.slotIndex);
      const hasTrain = lineTrains.length > 0;
      const train = lineTrains[0];
      const style = hasTrain ? (STATUS_STYLE[train.status] || STATUS_STYLE[1]) : null;
      const isActive = (line as any).isActive !== false;

      if (!isActive) {
        return (
          <div
            key={line.id}
            onClick={() => {
              if (canManageLines) {
                setSelectedLine(line);
                setDestLineId(line.id);
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
          onClick={() => {
            setSelectedLine(line);
            setDestLineId(line.id);
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
            const trId = Number(trIdStr);
            const trainObj = trains.find((t) => t.id === trId);
            if (!trainObj) return;

            e.currentTarget.style.borderColor = style ? style.border : "var(--line)";
            e.currentTarget.style.backgroundColor = style ? style.bg : "color-mix(in oklab, var(--bg) 60%, var(--panel))";

            if (trainObj.lineId === line.id) return;

            const occupiedSlots = trains.filter(t => t.lineId === line.id && !t.isDisposed).map(t => t.slotIndex);
            if (occupiedSlots.length >= line.capacity) {
              alert("ظرفیت ریل مقصد تکمیل است.");
              return;
            }

            let targetSlotIdx = 0;
            for (let idx = 0; idx < line.capacity; idx++) {
              if (!occupiedSlots.includes(idx)) {
                targetSlotIdx = idx;
                break;
              }
            }

            setSourceLineId(trainObj.lineId);
            setDestLineId(line.id);
            setTargetSlot(targetSlotIdx);
            setPreSelectedTrainId(trainObj.id);
            setShowManovrModal(true);
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
            <div style={{ display: "flex", alignItems: "center", gap: isFocusMode ? "4px" : "6px", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "70%" }}>
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
                          lineHeight: "1.2"
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

    // تابع کمکی رندر ریل‌های افقی برای پارکینگ شمالی و جنوبی (فشرده، بدون اسکرولبار، فیت شده ۱۰۰٪)
    const renderHorizontalParkingLines = (termCode: number, defaultPrefix: string) => {
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
            const lineTrains = trains.filter(t => t.lineId === line.id && !t.isDisposed).sort((a, b) => a.slotIndex - b.slotIndex);
            const isActive = (line as any).isActive !== false;
            // استخراج فقط عدد خط (بدون کلمه "خط" یا "ریل" یا آیکون)
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
                {/* سطر ۱: فقط عدد خط (حذف کسر ۱/۱ طبق درخواست کاربر) */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    borderBottom: "1px solid var(--line-soft)",
                    paddingBottom: "2px",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setSelectedLine(line);
                    setDestLineId(line.id);
                  }}
                >
                  <span style={{ fontSize: isFocusMode ? "9px" : "11px", fontWeight: "bold", color: "var(--ink)", whiteSpace: "nowrap" }}>
                    {lineNumDisplay}
                  </span>
                </div>

                {/* سطر ۲: قطارهای مستقر [101] (شماره بالا، آیکون‌ها و علائم زیر آن) و اسلات‌های خالی */}
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
                          onClick={() => setSelectedTrain(train)}
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
                          {/* ردیف بالا: شماره قطار به صورت واضح و درشت */}
                          <span style={{ fontWeight: "bold", fontSize: "10.5px", lineHeight: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {train.code}
                          </span>

                          {/* ردیف پایین: آیکون وضعیت و علائم فنی به صورت مرتب زیر شماره قطار */}
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
                                  lineHeight: "1"
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
                          if (canCreateManovr) {
                            setSourceLineId(null);
                            setDestLineId(line.id);
                            setTargetSlot(slotIdx);
                            setSelectedLine(line);
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
                          const trId = Number(trIdStr);
                          const trainObj = trains.find((t) => t.id === trId);
                          if (!trainObj) return;

                          setSourceLineId(trainObj.lineId);
                          setDestLineId(line.id);
                          setTargetSlot(slotIdx);
                          setPreSelectedTrainId(trainObj.id);
                          setShowManovrModal(true);
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

    // خطوط تفکیک‌شده برای بنتو دپو
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
          backgroundColor: appearance.theme === "dark" ? "#070a12" : "#f1f5f9",
          display: "flex",
          flexDirection: "column",
          gap: isFocusMode ? "2px" : "4px",
        }}
      >
        {/* راهنمای وضعیت قطارها (مخفی در حالت تمرکز/تمام صفحه) */}
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
            <span style={{ padding: "0 4px", borderRadius: "2px", backgroundColor: "#f59e0b", color: "#fff", fontSize: "9px" }}>⚡ کفشک</span>
            <span style={{ padding: "0 4px", borderRadius: "2px", backgroundColor: "#ef4444", color: "#fff", fontSize: "9px" }}>🚨 عدم ATP</span>
            <span style={{ padding: "0 4px", borderRadius: "2px", backgroundColor: "#8b5cf6", color: "#fff", fontSize: "9px" }}>🔄 دوار A/B/C</span>
            <span style={{ padding: "0 4px", borderRadius: "2px", backgroundColor: "#be123c", color: "#fff", fontSize: "9px" }}>🛑 بدون مجوز</span>
          </div>
        )}

        {/* ۱. پارکینگ شمالی (افقی، فشرده کامل بدون اسکرول) */}
        <BorderRotate
          gradientColors={{ primary: '#3b82f6', secondary: '#60a5fa', accent: '#93c5fd' }}
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
                مستقر: {trains.filter(t => lines.filter(l => l.terminal === 4).some(l => l.id === t.lineId) && !t.isDisposed).length} قطار
              </span>
            </div>
            <div style={{ display: "flex", width: "100%", overflow: "hidden" }}>
              {renderHorizontalParkingLines(4, "پارکینگ شمالی")}
            </div>
          </div>
        </BorderRotate>

        {/* ۲. پارکینگ جنوبی (افقی، فشرده کامل بدون اسکرول) */}
        <BorderRotate
          gradientColors={{ primary: '#06b6d4', secondary: '#22d3ee', accent: '#67e8f9' }}
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
                مستقر: {trains.filter(t => lines.filter(l => l.terminal === 5).some(l => l.id === t.lineId) && !t.isDisposed).length} قطار
              </span>
            </div>
            <div style={{ display: "flex", width: "100%", overflow: "hidden" }}>
              {renderHorizontalParkingLines(5, "پارکینگ جنوبی")}
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
            gradientColors={{ primary: '#64748b', secondary: '#94a3b8', accent: '#cbd5e1' }}
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
              gradientColors={{ primary: '#475569', secondary: '#64748b', accent: '#94a3b8' }}
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
              gradientColors={{ primary: '#0f766e', secondary: '#14b8a6', accent: '#5eead4' }}
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
              gradientColors={{ primary: '#854d0e', secondary: '#ca8a04', accent: '#fde047' }}
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
              gradientColors={{ primary: '#a16207', secondary: '#eab308', accent: '#fef08a' }}
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
            gradientColors={{ primary: '#7c3aed', secondary: '#8b5cf6', accent: '#c4b5fd' }}
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
            gradientColors={{ primary: '#ef4444', secondary: '#f87171', accent: '#fca5a5' }}
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
  };

  // ----------------------------------------------------
  // نمای دوبعدی نقشه پایانه (Map View) — مطابق نقشه واقعی دپو
  // ----------------------------------------------------
  const renderMapView = () => {
    const getPersianLineTitleMap = (line: LineData) => {
      let text = line.name || line.tag || "";
      text = text
        .replace(/^Dizel_Factory(\d+)/i, "کارخانه $1")
        .replace(/^Dizel_B(\d+)/i, "دیزل شاپ B$1")
        .replace(/^Dizel_(\d+)/i, "دیزل شاپ $1")
        .replace(/^Dizel_TestLine/i, "خط تست دیزل")
        .replace(/^Dizel_Battery/i, "باطری‌خانه")
        .replace(/^Wagon_CoorLine(\d+)/i, "رابط واگن‌سازی $1")
        .replace(/^Wagon_(\d+)/i, "واگن‌سازی $1")
        .replace(/^Alt_CoorLine(\d+)/i, "خط رابط $1")
        .replace(/^Alt_Abgiri/i, "آبگیری")
        .replace(/^Alt_DavarShargi/i, "دوّار شرقی")
        .replace(/^Alt_DavarGarbi/i, "دوّار غربی")
        .replace(/^Alt_Pitline/i, "پیت‌لاین")
        .replace(/^Alt_MetroWash/i, "قطارشویی")
        .replace(/^Alt_MojaverSole/i, "مجاور سوله")
        .replace(/^Alt_MojaverMarkaz/i, "مجاور مرکز")
        .replace(/^khat-aliabad/i, "خط علی‌آباد")
        .replace(/^khat(\d+)/i, "خط $1")
        .replace(/^S_OriginalLine/i, "خط اصلی")
        .replace(/^slole-sharghi/i, "سوله شرقی")
        .replace(/^slole-gharbi/i, "سوله غربی");
      return text.replace(/\d+/g, (d) => Number(d).toLocaleString("fa-IR", { useGrouping: false }));
    };

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
            setSelectedTrain(tr);
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
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}
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
      const lineTrains = trains.filter(t => t.lineId === line.id && !t.isDisposed).sort((a, b) => a.slotIndex - b.slotIndex);
      const isActive = (line as any).isActive !== false;

      return (
        <div
          key={line.id}
          onClick={() => {
            setSelectedLine(line);
            setDestLineId(line.id);
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
            e.currentTarget.style.borderColor = "var(--line-soft)";
            e.currentTarget.style.backgroundColor = "transparent";
            const trIdStr = e.dataTransfer.getData("trainId");
            if (!trIdStr) return;
            const trId = Number(trIdStr);
            const trainObj = trains.find((t) => t.id === trId);
            if (!trainObj) return;
            if (trainObj.lineId === line.id) return;
            const occupiedSlots = trains.filter(t => t.lineId === line.id && !t.isDisposed).map(t => t.slotIndex);
            if (occupiedSlots.length >= line.capacity) {
              alert("ظرفیت ریل مقصد تکمیل است.");
              return;
            }
            let targetSlotIdx = 0;
            for (let idx = 0; idx < line.capacity; idx++) {
              if (!occupiedSlots.includes(idx)) {
                targetSlotIdx = idx;
                break;
              }
            }
            setSourceLineId(trainObj.lineId);
            setDestLineId(line.id);
            setTargetSlot(targetSlotIdx);
            setPreSelectedTrainId(trainObj.id);
            setShowManovrModal(true);
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
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(var(--accent-rgb, 216, 132, 42), 0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <span style={{ fontSize: "11px", fontWeight: "600", color: isActive ? "var(--ink-soft)" : "var(--crit)", whiteSpace: "nowrap" }}>
            {label}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {lineTrains.length > 0
              ? lineTrains.map((tr) => renderTrainBadge(tr, true))
              : <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
            }
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
            <span className="num" style={{ fontSize: "11px", fontWeight: "bold", color: "var(--ink-soft)", minWidth: "20px", textAlign: "center" }}>
              {rowNumber}
            </span>
          </div>
        );
      }

      const lineTrains = trains.filter(t => t.lineId === line.id && !t.isDisposed).sort((a, b) => a.slotIndex - b.slotIndex);
      const isActive = (line as any).isActive !== false;

      return (
        <div
          key={line.id}
          onClick={() => {
            setSelectedLine(line);
            setDestLineId(line.id);
          }}
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
            const trId = Number(trIdStr);
            const trainObj = trains.find((t) => t.id === trId);
            if (!trainObj) return;
            if (trainObj.lineId === line.id) return;
            const occupiedSlots = trains.filter(t => t.lineId === line.id && !t.isDisposed).map(t => t.slotIndex);
            if (occupiedSlots.length >= line.capacity) {
              alert("ظرفیت ریل مقصد تکمیل است.");
              return;
            }
            let targetSlotIdx = 0;
            for (let idx = 0; idx < line.capacity; idx++) {
              if (!occupiedSlots.includes(idx)) {
                targetSlotIdx = idx;
                break;
              }
            }
            setSourceLineId(trainObj.lineId);
            setDestLineId(line.id);
            setTargetSlot(targetSlotIdx);
            setPreSelectedTrainId(trainObj.id);
            setShowManovrModal(true);
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
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(var(--accent-rgb, 216, 132, 42), 0.06)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
            {lineTrains.length > 0
              ? lineTrains.map((tr) => renderTrainBadge(tr, true))
              : <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
            }
          </div>
          <span className="num" style={{ fontSize: "11px", fontWeight: "bold", color: "var(--ink-soft)", minWidth: "20px", textAlign: "center" }}>
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
        style={{ boxShadow: "var(--sh-2)", overflow: "hidden", display: "flex", flexDirection: "column", ...extraStyle }}
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
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {children}
          </div>
        </div>
      </BorderRotate>
    );

    // داده‌های هر بخش
    const mainLineObj = lines.find(l => l.name === "خط اصلی");
    const mainLineTrains = mainLineObj ? trains.filter(t => t.lineId === mainLineObj.id && !t.isDisposed).sort((a, b) => a.slotIndex - b.slotIndex) : [];
    const otherLines = lines.filter(l => l.terminal === 8).sort((a, b) => { const ma = a.name.match(/(\d+)/); const mb = b.name.match(/(\d+)/); if (ma && mb) return parseInt(ma[1], 10) - parseInt(mb[1], 10); return a.name.localeCompare(b.name, "fa"); });
    const aliabadLines = lines.filter(l => l.terminal === 9 || l.name.includes("علی‌آباد") || l.name.includes("علی اباد"));
    const sub1Lines = lines.filter(l => l.terminal === 6);
    const sub2Lines = lines.filter(l => l.terminal === 7);
    const wagonLines = lines.filter(l => l.terminal === 2);
    const dieselLines = lines.filter(l => l.terminal === 1);
    const northParkLines = lines.filter(l => l.terminal === 4).sort((a, b) => a.id - b.id);
    const southParkLines = lines.filter(l => l.terminal === 5).sort((a, b) => a.id - b.id);

    // لیست‌های ثابت دیزل‌شاپ
    const dieselSpecialNames = ["خط تست", "D7G", "باطری خانه", "دیزل شاپ B1", "دیزل شاپ B2"];
    const dieselNumbered = Array.from({ length: 10 }, (_, i) => `دیزل شاپ ${i + 1}`);
    const dieselFactory = ["کارخانه 1", "کارخانه 2", "کارخانه 3"];
    const dieselAllNames = [...dieselSpecialNames, ...dieselNumbered, ...dieselFactory];

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
          backgroundColor: appearance.theme === "dark" ? "#070a12" : "#f1f5f9",
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
            <span style={{ padding: "1px 5px", borderRadius: "3px", backgroundColor: "#f59e0b", color: "#fff", fontSize: "9.5px" }}>⚡ کفشک</span>
            <span style={{ padding: "1px 5px", borderRadius: "3px", backgroundColor: "#ef4444", color: "#fff", fontSize: "9.5px" }}>🚨 عدم ATP</span>
            <span style={{ padding: "1px 5px", borderRadius: "3px", backgroundColor: "#8b5cf6", color: "#fff", fontSize: "9.5px" }}>🔄 دوار A/B/C</span>
            <span style={{ padding: "1px 5px", borderRadius: "3px", backgroundColor: "#be123c", color: "#fff", fontSize: "9.5px" }}>🛑 بدون مجوز</span>
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
          {renderSection("پارکینگ جنوبی", "🅿️", { primary: '#0ea5e9', secondary: '#38bdf8', accent: '#7dd3fc' },
            <>
              {Array.from({ length: 25 }, (_, i) => {
                const parkLine = southParkLines.find(l => {
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
          {renderSection("پارکینگ شمالی", "🅿️", { primary: '#14b8a6', secondary: '#2dd4bf', accent: '#5eead4' },
            <>
              {Array.from({ length: 25 }, (_, i) => {
                const parkLine = northParkLines.find(l => {
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
            {renderSection("خط اصلی", "🚉", { primary: '#22c55e', secondary: '#4ade80', accent: '#86efac' },
              <div
                onClick={() => mainLineObj && setSelectedLine(mainLineObj)}
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
                  const trId = Number(trIdStr);
                  const trainObj = trains.find((t) => t.id === trId);
                  if (!trainObj) return;
                  if (trainObj.lineId === mainLineObj.id) return;
                  const occupiedSlots = trains.filter(t => t.lineId === mainLineObj.id && !t.isDisposed).map(t => t.slotIndex);
                  if (occupiedSlots.length >= mainLineObj.capacity) {
                    alert("ظرفیت ریل مقصد تکمیل است.");
                    return;
                  }
                  let targetSlotIdx = 0;
                  for (let idx = 0; idx < mainLineObj.capacity; idx++) {
                    if (!occupiedSlots.includes(idx)) {
                      targetSlotIdx = idx;
                      break;
                    }
                  }
                  setSourceLineId(trainObj.lineId);
                  setDestLineId(mainLineObj.id);
                  setTargetSlot(targetSlotIdx);
                  setPreSelectedTrainId(trainObj.id);
                  setShowManovrModal(true);
                }}
                style={{ cursor: "pointer", transition: "background 0.15s ease", padding: "6px" }}
              >
                {/* هدر ستون‌ها */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: mainLineTrains.length > 15
                      ? `repeat(${Math.min(Math.ceil(mainLineTrains.length / 12), 4)}, 1fr)`
                      : "1fr",
                    gap: mainLineTrains.length > 15 ? "8px" : "0",
                  }}
                >
                  {(() => {
                    const colCount = mainLineTrains.length > 15
                      ? Math.min(Math.ceil(mainLineTrains.length / 12), 4)
                      : 1;
                    const perCol = Math.ceil(mainLineTrains.length / colCount);
                    const columns = Array.from({ length: colCount }, (_, ci) =>
                      mainLineTrains.slice(ci * perCol, (ci + 1) * perCol)
                    );
                    return columns.map((colTrains, ci) => (
                      <div key={ci} style={{ display: "flex", flexDirection: "column" }}>
                        {/* سرستون هر ستون */}
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
                        {/* ردیف‌های قطار */}
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
                                setSelectedTrain(tr);
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
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(var(--accent-rgb, 216, 132, 42), 0.06)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                            >
                              <span className="num" style={{ textAlign: "center", fontWeight: "600", color: "var(--ink-soft)" }}>{tr.slotIndex + 1}</span>
                              <span style={{ textAlign: "center", fontSize: "10px", color: "var(--ink-soft)" }}>{tr.type === 0 ? "AC" : "DC"}</span>
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
                {canCreateManovr && mainLineObj && (() => {
                  const occupiedSlots = mainLineTrains.map(t => t.slotIndex);
                  const emptySlots = Array.from({ length: mainLineObj.capacity }, (_, i) => i).filter(i => !occupiedSlots.includes(i));
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
                            setSourceLineId(null);
                            setDestLineId(mainLineObj.id);
                            setTargetSlot(slotIdx);
                            setSelectedLine(mainLineObj);
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
                            const trId = Number(trIdStr);
                            const trainObj = trains.find((t) => t.id === trId);
                            if (!trainObj) return;
                            setSourceLineId(trainObj.lineId);
                            setDestLineId(mainLineObj.id);
                            setTargetSlot(slotIdx);
                            setPreSelectedTrainId(trainObj.id);
                            setShowManovrModal(true);
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
            {renderSection("سایر خطوط", "📋", { primary: '#475569', secondary: '#64748b', accent: '#94a3b8' },
              <>
                {otherLines.map(l => renderMapSlotRow(l, getPersianLineTitleMap(l)))}
                {otherLines.length === 0 && (
                  <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>بدون خط</div>
                )}
              </>,
              { flex: "0 0 auto" }
            )}

            {/* پایانه علی‌آباد */}
            {renderSection("پایانه علی آباد", "📍", { primary: '#0f766e', secondary: '#14b8a6', accent: '#5eead4' },
              <>
                {aliabadLines.map(l => renderMapSlotRow(l, getPersianLineTitleMap(l)))}
                {aliabadLines.length === 0 && (
                  <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>بدون خط</div>
                )}
              </>,
              { flex: "0 0 auto" }
            )}
          </div>

          {/* ستون ۲: واگن‌سازی */}
          {renderSection("واگن‌سازی", "🏗️", { primary: '#f59e0b', secondary: '#fbbf24', accent: '#fde68a' },
            <>
              {wagonNumbered.map(name => {
                const line = lines.find(l => l.name === name);
                const digitMatch = name.match(/(\d+)/);
                const label = digitMatch ? digitMatch[1] : name;
                if (!line) return (
                  <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid var(--line-soft)", minHeight: "32px" }}>
                    <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{label}</span>
                  </div>
                );
                return renderMapSlotRow(line, label);
              })}
              <div style={{ margin: "4px 0", borderTop: "1px dashed var(--line)" }} />
              {wagonSpecial.map(name => {
                const line = lines.find(l => l.name === name);
                if (!line) return (
                  <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid var(--line-soft)", minHeight: "32px" }}>
                    <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{name}</span>
                  </div>
                );
                return renderMapSlotRow(line, getPersianLineTitleMap(line));
              })}
            </>,
            { gridRow: "1 / 2" }
          )}

          {/* ستون ۱ (راست‌ترین RTL): دیزل‌شاپ */}
          {renderSection("دیزل‌شاپ", "🚂", { primary: '#ef4444', secondary: '#f87171', accent: '#fca5a5' },
            <>
              {dieselSpecialNames.map(name => {
                const line = lines.find(l => l.name === name);
                if (!line) return (
                  <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid var(--line-soft)", minHeight: "32px" }}>
                    <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{name}</span>
                  </div>
                );
                return renderMapSlotRow(line, getPersianLineTitleMap(line));
              })}
              <div style={{ margin: "4px 0", borderTop: "1px dashed var(--line)" }} />
              {dieselNumbered.map(name => {
                const line = lines.find(l => l.name === name);
                const digitMatch = name.match(/(\d+)/);
                const label = digitMatch ? digitMatch[1] : name;
                if (!line) return (
                  <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid var(--line-soft)", minHeight: "32px" }}>
                    <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{label}</span>
                  </div>
                );
                return renderMapSlotRow(line, label);
              })}
              <div style={{ margin: "4px 0", borderTop: "1px dashed var(--line)" }} />
              {dieselFactory.map(name => {
                const line = lines.find(l => l.name === name);
                if (!line) return (
                  <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid var(--line-soft)", minHeight: "32px" }}>
                    <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>—</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>{name}</span>
                  </div>
                );
                return renderMapSlotRow(line, getPersianLineTitleMap(line));
              })}
            </>,
            { gridRow: "1 / 2" }
          )}

          {/* ردیف پایین: فرعی ۲ (زیر دیزل‌شاپ) و فرعی ۱ (زیر واگن‌سازی) */}
          {renderSection("فرعی ۲", "🛤️", { primary: '#ec4899', secondary: '#f472b6', accent: '#f9a8d4' },
            <>
              {sub2Lines.map(l => renderMapSlotRow(l, getPersianLineTitleMap(l)))}
              {sub2Lines.length === 0 && (
                <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>بدون خط</div>
              )}
            </>
          )}

          {renderSection("فرعی ۱", "🛤️", { primary: '#8b5cf6', secondary: '#a78bfa', accent: '#c4b5fd' },
            <>
              {sub1Lines.map(l => renderMapSlotRow(l, getPersianLineTitleMap(l)))}
              {sub1Lines.length === 0 && (
                <div style={{ fontSize: "10px", color: "var(--ink-faint)", textAlign: "center", padding: "10px" }}>بدون خط</div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={sceneContainerRef}
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        backgroundColor: isFocusMode ? "var(--bg)" : undefined,
      }}
    >

      {/* دکمه شناور خروج از تمام‌صفحه */}
      {isFocusMode && (
        <button
          onClick={toggleFullscreen}
          style={{
            position: "absolute",
            bottom: "16px",
            right: "16px",
            zIndex: 9999,
            padding: "6px 14px",
            borderRadius: "var(--r-sm)",
            backgroundColor: "rgba(0,0,0,0.7)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)",
            fontSize: "12px",
            fontWeight: "bold",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            transition: "opacity 0.2s",
            opacity: 0.6,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
          title="خروج از تمام‌صفحه (Esc)"
        >
          ✕ خروج از تمام‌صفحه
        </button>
      )}

      {/* هدر بالایی کنترل صحنه دپو — در حالت تمام‌صفحه مخفی */}
      {!isFocusMode && (
        <div
          style={{
            width: "100%",
            padding: "8px 16px",
            backgroundColor: "var(--panel)",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            zIndex: 10,
            boxShadow: "var(--sh-1)",
          }}
        >
          <button
            className="btn primary sm"
            onClick={() => setCurrentQuality((prev) => (prev === "2d" ? "high" : "2d"))}
            style={{ fontWeight: "bold", background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)", color: "#fff" }}
          >
            {currentQuality === "2d" ? "🖥️ نمای سه‌بعدی دپو" : "📋 نمای دوبعدی (نقشه)"}
          </button>

          {currentQuality === "2d" && (
            <div style={{ display: "flex", gap: "4px", backgroundColor: "var(--bg)", padding: "2px 4px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)" }}>
              <button
                className={`btn sm ${view2DMode === "structured" ? "primary" : ""}`}
                onClick={() => setView2DMode("structured")}
                style={{ fontSize: "11.5px", fontWeight: view2DMode === "structured" ? "bold" : "normal" }}
              >
                📐 نمای افقی پایانه (جدید)
              </button>
              <button
                className={`btn sm ${view2DMode === "grid" ? "primary" : ""}`}
                onClick={() => setView2DMode("grid")}
                style={{ fontSize: "11.5px", fontWeight: view2DMode === "grid" ? "bold" : "normal" }}
              >
                🔲 نمای ۵ ستونه (کلاسیک)
              </button>
              <button
                className={`btn sm ${view2DMode === "map" ? "primary" : ""}`}
                onClick={() => setView2DMode("map")}
                style={{ fontSize: "11.5px", fontWeight: view2DMode === "map" ? "bold" : "normal" }}
              >
                🗺️ نقشه پایانه
              </button>
            </div>
          )}

          {currentQuality === "2d" && (
            <button
              className={`btn sm ${isFocusMode ? "accent" : ""}`}
              onClick={toggleFullscreen}
              style={{ fontSize: "11.5px", fontWeight: "bold" }}
              title="ورود/خروج از حالت تمام‌صفحه (Fullscreen)"
            >
              {isFocusMode ? "👁️ خروج از حالت تمام‌صفحه" : "🖥️ حالت تمام‌صفحه (Fullscreen)"}
            </button>
          )}

          {cameraFocusTarget && currentQuality !== "2d" && (
            <button
              className="btn accent"
              onClick={() => setCameraFocusTarget(null)}
              style={{ fontWeight: "bold" }}
            >
              🏠 نمای کلی پایانه
            </button>
          )}

          <button className="btn" onClick={() => setShowSearch(true)} title="جستجوی سریع (Ctrl+K)">
            🔍 جستجوی سریع
          </button>

          {Object.keys(modifiedPositions).length > 0 && currentQuality !== "2d" && (
            <button className="btn primary" onClick={handleSaveLayout} disabled={isSavingLayout}>
              {isSavingLayout ? "در حال ثبت چیدمان..." : "ذخیره نهایی چیدمان ریل‌ها"}
            </button>
          )}
        </div>
      )}

      {/* بدنه اصلی صحنه: سه‌بعدی یا دوبعدی */}
      {currentQuality === "2d" ? (
        view2DMode === "structured" ? renderStructured2DMap() : view2DMode === "map" ? renderMapView() : render2DMap()
      ) : (
        <Canvas
          shadows
          frameloop="demand"
          camera={{ position: [0, 380, 420], fov: 42, near: 1, far: 2500 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          style={{
            flex: 1,
            background: appearance.theme === "dark"
              ? "linear-gradient(180deg, #0a0e14 0%, #131a26 100%)"
              : "linear-gradient(180deg, #f5f7fa 0%, #dfe6ee 100%)",
          }}
        >
          {/* نورپردازی صحنه — لطیف در هر دو تم */}
          <ambientLight intensity={appearance.theme === "dark" ? 0.35 : 0.55} />
          <hemisphereLight
            args={[
              appearance.theme === "dark" ? "#7ea6d8" : "#eef4ff",
              appearance.theme === "dark" ? "#101828" : "#c7d2df",
              appearance.theme === "dark" ? 0.35 : 0.6,
            ]}
          />
          <directionalLight
            position={[120, 200, 80]}
            intensity={appearance.theme === "dark" ? 1.0 : 1.4}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-400}
            shadow-camera-right={400}
            shadow-camera-top={300}
            shadow-camera-bottom={-300}
            shadow-bias={-0.0005}
          />
          {currentQuality === "high" && (
            <Environment preset={appearance.theme === "dark" ? "night" : "city"} />
          )}

          {/* کف پایانه — گرید ظریف صنعتی */}
          <Grid
            args={[1400, 700]}
            position={[0, 0, 0]}
            cellSize={6}
            cellThickness={0.6}
            cellColor={appearance.theme === "dark" ? "#1e2a3b" : "#c3ccd8"}
            sectionSize={60}
            sectionThickness={1.2}
            sectionColor={appearance.theme === "dark" ? "#2a3a52" : "#94a3b8"}
            fadeDistance={520}
            fadeStrength={1}
            infiniteGrid={false}
            followCamera={false}
          />

          {/* کامپوننت هدایت زنده دوربین */}
          <CameraDirector focusTarget={cameraFocusTarget} controlsRef={controlsRef} />

          {/* رندر مناطق و سوله‌های پایانه دپو — عرض هر سوله بر اساس تعداد خطوطش پویا است */}
          {Object.entries(ZONES).map(([id, zone]) => {
            const termId = Number(id);
            const isFull = (zone as any).gridRow === "full";
            const lineCount = lines.filter((l) => l.terminal === termId).length;

            // مطابق seed-v3.mjs: SHED_PAD=12, RAIL_STEP=8, MIN=90, MAX=220
            const shedW = Math.min(220, Math.max(90, 24 + Math.max(0, lineCount - 1) * 8));
            const shedD = isFull ? 180 : 90;

            // کف زون کمی کوچک‌تر از سوله باشد تا بیرون از دیوار نشت نکند
            const gW = shedW - 4;
            const gD = shedD - 4;
            return (
              <group key={id}>
                {/* کف زون — رنگ لهجه با اشباع پایین برای شناسایی سریع */}
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[zone.x, 0.05, zone.z]}
                  receiveShadow
                  raycast={() => null}
                >
                  <planeGeometry args={[gW, gD]} />
                  <meshStandardMaterial
                    color={zone.color}
                    roughness={0.95}
                    metalness={0.02}
                    transparent
                    opacity={appearance.theme === "dark" ? 0.22 : 0.28}
                  />
                </mesh>

                {/* سایه‌ی نرم زیر سوله برای عمق تصویری */}
                {currentQuality === "high" && (
                  <ContactShadows
                    position={[zone.x, 0.06, zone.z]}
                    opacity={appearance.theme === "dark" ? 0.55 : 0.35}
                    scale={Math.max(gW, gD) * 1.1}
                    blur={2.4}
                    far={20}
                    resolution={512}
                    color="#000000"
                  />
                )}

                {/* سازه سه‌بعدی سوله */}
                <IndustrialShed
                  zoneX={zone.x}
                  zoneZ={zone.z}
                  label={zone.label}
                  color={zone.color}
                  gridRow={(zone as any).gridRow ?? "full"}
                  width={shedW}
                  depth={shedD}
                  onSelect={() => setCameraFocusTarget([zone.x, 0, zone.z])}
                />
              </group>
            );
          })}

          {/* رندر ریل‌ها و خطوط آهن */}
          {lines.map((line) => {
            const isModified = !!modifiedPositions[line.id];
            const posX = isModified ? modifiedPositions[line.id].posX : line.posX;
            const posY = isModified ? modifiedPositions[line.id].posY : line.posY;
            const rotation = isModified ? modifiedPositions[line.id].rotation : line.rotation;

            const angle = (rotation * Math.PI) / 180;

            return (
              <group
                key={line.id}
                position={[posX, 0.2, posY]}
                rotation={[0, angle, 0]}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredLineId(line.id);
                }}
                onPointerOut={() => {
                  setHoveredLineId(null);
                }}
              >
                {/* ریل فلزی PBR */}
                <mesh castShadow receiveShadow position={[0.9, 0.3, 0]}>
                  <boxGeometry args={[0.35, 0.35, line.length]} />
                  <meshStandardMaterial color="#8fa2b8" metalness={0.9} roughness={0.25} />
                </mesh>
                <mesh castShadow receiveShadow position={[-0.9, 0.3, 0]}>
                  <boxGeometry args={[0.35, 0.35, line.length]} />
                  <meshStandardMaterial color="#8fa2b8" metalness={0.9} roughness={0.25} />
                </mesh>
                {/* بستر تراورس با ته‌رنگ زون (از ZONE_CONFIG) */}
                <mesh receiveShadow>
                  <boxGeometry args={[3, 0.1, line.length]} />
                  <meshStandardMaterial
                    color={ZONES[line.terminal]?.color ?? "#78350f"}
                    roughness={0.95}
                    metalness={0.02}
                  />
                </mesh>

                {/* برچسب نام ریل — فقط هاور/انتخاب. مانور فعال → نشان کوچک (نه لیبل کامل) */}
                {(hoveredLineId === line.id || selectedLine?.id === line.id) && (
                  <Html position={[0, 1.6, -line.length / 2]} center distanceFactor={40} zIndexRange={[100, 0]}>
                    <div
                      style={{
                        background: "color-mix(in oklab, var(--panel) 92%, transparent)",
                        backdropFilter: "blur(6px)",
                        WebkitBackdropFilter: "blur(6px)",
                        color: "var(--ink)",
                        padding: "3px 9px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        boxShadow: "var(--sh-2)",
                        border: `1px solid ${selectedLine?.id === line.id ? "var(--accent)" : "var(--line)"}`,
                      }}
                      onClick={() => setSelectedLine(line)}
                    >
                      {line.name}
                    </div>
                  </Html>
                )}

                {/* نشان مانور فعال — نقطه‌ی سبز نبضی روی ریل، بدون لیبل متنی */}
                {activeManovrs.some((m) => m.destinationLineId === line.id) &&
                  hoveredLineId !== line.id && selectedLine?.id !== line.id && (
                    <mesh position={[0, 1.4, 0]} raycast={() => null}>
                      <sphereGeometry args={[0.55, 12, 12]} />
                      <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2.5} />
                    </mesh>
                  )}
              </group>
            );
          })}

          {/* رندر قطارها */}
          {trains.map((train) => {
            const line = lines.find((l) => l.id === train.lineId);
            return (
              <TrainModel3D
                key={train.id}
                train={train}
                line={line}
                isDragging={draggedTrainId === train.id}
                dragPos={dragPos}
                onPointerDown={(e) => {
                  if (canCreateManovr) handleTrainDragStart(train.id, [e.point.x, 1.8, e.point.z]);
                }}
                onClick={() => setSelectedTrain(train)}
              />
            );
          })}

          {/* رندر نشانگرهای اسلات خالی جهت بهبود تغییر موقعیت قطار منتخب */}
          {selectedTrain && lines.map((line) => {
            // پیدا کردن اسلات‌های پر شده
            const occupiedSlots = trains.filter((t) => t.lineId === line.id).map((t) => t.slotIndex);
            const emptySlots: number[] = [];
            for (let i = 0; i < line.capacity; i++) {
              if (!occupiedSlots.includes(i)) {
                emptySlots.push(i);
              }
            }

            const angle = (line.rotation * Math.PI) / 180;
            const slotSpacing = line.length / Math.max(1, line.capacity);

            return emptySlots.map((slotIdx) => {
              const offset = -line.length / 2 + slotIdx * slotSpacing + slotSpacing / 2;
              const dx = Math.sin(angle) * offset;
              const dz = Math.cos(angle) * offset;
              const slotPos = [line.posX + dx, 0.6, line.posY + dz] as [number, number, number];

              return (
                <mesh
                  key={`${line.id}-${slotIdx}`}
                  position={slotPos}
                  rotation={[0, angle, 0]}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSourceLineId(selectedTrain.lineId);
                    setDestLineId(line.id);
                    setTargetSlot(slotIdx);
                    setShowManovrModal(true);
                    setSelectedTrain(null);
                  }}
                  onPointerOver={() => { document.body.style.cursor = "pointer"; }}
                  onPointerOut={() => { document.body.style.cursor = "auto"; }}
                >
                  <cylinderGeometry args={[1.6, 1.6, 0.4, 16]} />
                  <meshStandardMaterial
                    color="#22c55e"
                    emissive="#22c55e"
                    emissiveIntensity={1.2}
                    transparent
                    opacity={0.75}
                  />
                </mesh>
              );
            });
          })}

          <CameraController defaultTerminal={prefs.defaultTerminal} lines={lines} zones={ZONES} />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            maxPolarAngle={Math.PI / 2.15}
            minDistance={20}
            maxDistance={800}
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>
      )}

      {/* مودال اطلاعات قطار منتخب */}
      {selectedTrain && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(15,23,42,0.4)",
            backdropFilter: "blur(6px)",
            zIndex: 100000,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div className="card" style={{ width: "450px", backgroundColor: "var(--panel)" }}>
            <div className="card-head">
              <h2>قطار شماره {selectedTrain.code}</h2>
              <span className="spacer" />
              <button className="btn sm" onClick={() => setSelectedTrain(null)}>
                بستن
              </button>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">نوع قطار:</span>
                <b>{TrainType[selectedTrain.type]}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">خط استقرار جاری:</span>
                <b>
                  {lines.find((l) => l.id === selectedTrain.lineId)?.name ?? "خارج از ریل / نامشخص"}
                </b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">جایگاه پارک (Slot):</span>
                <b className="num">{selectedTrain.slotIndex + 1}</b>
              </div>

              {canCreateManovr && selectedTrain.lineId && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                  <button
                    className="btn primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      const currentLineObj = lines.find((l) => l.id === selectedTrain.lineId);
                      if (currentLineObj) {
                        setSelectedLine(currentLineObj);
                        setActiveLineTab("manovr");
                        setManovrTrainId(selectedTrain.id);
                        setManovrDestLineId(selectedTrain.lineId ?? "");
                        setManovrSlotIdx(selectedTrain.slotIndex);
                        setManovrType(4); // پیش‌فرض مانور استاتیک / در محل
                        setSelectedTrain(null);
                      }
                    }}
                  >
                    ⚡ ثبت مانور در محل (ثابت / بدون جابه‌جایی)
                  </button>

                  <button
                    className="btn outline"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      setSourceLineId(selectedTrain.lineId);
                      setSelectedTrain(null);
                      alert("ریل مقصد را در صحنه کلیک کنید یا با درگ قطار را جابجا کنید.");
                    }}
                  >
                    🚀 شروع مانور جابه‌جایی (انتقال به ریل دیگر)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* مودال جامع کنترل و مدیریت ریل انتخابی */}
      {selectedLine && (() => {
        const lineTrains = trains.filter((t) => t.lineId === selectedLine.id);
        const isFull = lineTrains.length >= selectedLine.capacity;

        // محاسبه اسلات‌های خالی ریل مقصد انتخابی مانور
        const destLineObj = lines.find((l) => l.id === Number(manovrDestLineId));
        const emptyDestSlots: number[] = [];
        if (destLineObj) {
          const occupied = trains
            .filter((t) => t.lineId === destLineObj.id && t.id !== Number(manovrTrainId))
            .map((t) => t.slotIndex);
          for (let i = 0; i < destLineObj.capacity; i++) {
            if (!occupied.includes(i)) emptyDestSlots.push(i);
          }
        }

        // محاسبه اسلات‌های خالی ریل مقصد انتخابی جابجایی سریع
        const relocateLineObj = lines.find((l) => l.id === Number(relocateLineId));
        const emptyRelocateSlots: number[] = [];
        if (relocateLineObj) {
          const occupied = trains.filter((t) => t.lineId === relocateLineObj.id).map((t) => t.slotIndex);
          for (let i = 0; i < relocateLineObj.capacity; i++) {
            if (!occupied.includes(i)) emptyRelocateSlots.push(i);
          }
        }

        // سابمیت ثبت مانور
        const handleTab2Submit = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!manovrTrainId || !manovrDestLineId || !manovrRahbar1) {
            alert("لطفاً قطار، خط مقصد و راهبر مسئول را انتخاب کنید.");
            return;
          }
          const fd = new FormData();
          fd.append("trainId", String(manovrTrainId));
          fd.append("sourceLineId", String(selectedLine.id));
          fd.append("destinationLineId", String(manovrDestLineId));
          fd.append("slotIndex", String(manovrSlotIdx));
          fd.append("rahbar1Id", String(manovrRahbar1));
          if (manovrRahbar2) fd.append("rahbar2Id", String(manovrRahbar2));
          fd.append("type", String(manovrType));
          fd.append("description", manovrDesc);
          fd.append("executionTime", manovrExecutionTime);
          fd.append("noRedirect", "1");

          startTransition(async () => {
            const res = await createManovr(null, fd);
            if (res?.error) {
              alert(res.error);
            } else {
              setSelectedLine(null);
              setSuccessMsg("مانور سریع با موفقیت ثبت شد.");
              router.refresh();
            }
          });
        };

        // سابمیت جابجایی سریع
        const handleRelocateSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!relocateTrainId || !relocateLineId) {
            alert("لطفاً قطار و خط مقصد را انتخاب کنید.");
            return;
          }
          startTransition(async () => {
            const res = await relocateTrainDirectly(Number(relocateTrainId), Number(relocateLineId), relocateSlotIdx);
            if (res.error) {
              alert(res.error);
            } else {
              setSelectedLine(null);
              router.refresh();
            }
          });
        };

        return (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(15,23,42,0.4)",
              backdropFilter: "blur(6px)",
              zIndex: 100000,
              display: "grid",
              placeItems: "center",
            }}
          >
            <div
              className="card"
              style={{
                width: "520px",
                maxWidth: "95vw",
                maxHeight: "88vh",
                backgroundColor: "var(--panel)",
                display: "flex",
                flexDirection: "column",
                borderRadius: "16px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                overflow: "hidden",
              }}
            >
              <div className="card-head" style={{ borderBottom: "1px solid var(--line)", padding: "10px 14px", flexShrink: 0 }}>
                <div>
                  <h2 style={{ margin: 0 }}>کنترل ریل: {selectedLine.name}</h2>
                  <div style={{ fontSize: "11px", color: "var(--ink-faint)", marginTop: "2px" }}>
                    ترمینال: {TerminalEnum[selectedLine.terminal]} | ظرفیت: {lineTrains.length} / {selectedLine.capacity}
                  </div>
                </div>
                <span className="spacer" />
                {canManageLines && (
                  <button
                    className={`btn sm ${((selectedLine as any).isActive !== false) ? "danger" : "primary"}`}
                    onClick={async () => {
                      const currentActive = (selectedLine as any).isActive !== false;
                      const res = await toggleLineActive(selectedLine.id, !currentActive);
                      if (res.error) {
                        alert(res.error);
                      } else {
                        (selectedLine as any).isActive = !currentActive;
                        setSelectedLine({ ...selectedLine });
                        const found = lines.find(l => l.id === selectedLine.id);
                        if (found) (found as any).isActive = !currentActive;
                        router.refresh();
                      }
                    }}
                    style={{ fontWeight: "bold" }}
                  >
                    {((selectedLine as any).isActive !== false) ? "🔴 مسدود کردن خط" : "🟢 فعال‌سازی خط"}
                  </button>
                )}
                <button className="btn sm" onClick={() => setSelectedLine(null)}>
                  بستن
                </button>
              </div>

              {/* هدر تب‌ها */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--line)", backgroundColor: "var(--panel-2)" }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    border: 0,
                    backgroundColor: "transparent",
                    color: activeLineTab === "details" ? "var(--accent)" : "var(--ink-soft)",
                    borderBottom: activeLineTab === "details" ? "2px solid var(--accent)" : "none",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "12.5px",
                  }}
                  onClick={() => setActiveLineTab("details")}
                >
                  قطارهای مستقر
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    border: 0,
                    backgroundColor: "transparent",
                    color: activeLineTab === "manovr" ? "var(--accent)" : "var(--ink-soft)",
                    borderBottom: activeLineTab === "manovr" ? "2px solid var(--accent)" : "none",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "12.5px",
                  }}
                  onClick={() => {
                    setActiveLineTab("manovr");
                    // مقداردهی اولیه برای خروج اولین قطار در صورت وجود
                    if (lineTrains.length > 0 && !manovrTrainId) {
                      setManovrTrainId(lineTrains[0].id);
                    }
                  }}
                >
                  ثبت مانور جابجایی
                </button>
                {canLayout && (
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      border: 0,
                      backgroundColor: "transparent",
                      color: activeLineTab === "relocate" ? "var(--accent)" : "var(--ink-soft)",
                      borderBottom: activeLineTab === "relocate" ? "2px solid var(--accent)" : "none",
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontSize: "12.5px",
                    }}
                    onClick={() => {
                      setActiveLineTab("relocate");
                    }}
                  >
                    انتقال سریع (ادمین)
                  </button>
                )}
              </div>

              <div className="card-body" style={{ padding: "12px 16px", overflowY: "auto", flex: 1, position: "relative" }}>

                {/* تب ۱: قطارهای مستقر */}
                {activeLineTab === "details" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflow: "visible" }}>
                    <h3 style={{ fontSize: "13px", fontWeight: "bold", margin: "0 0 4px 0" }}>فهرست ناوگان پارک شده:</h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "2px" }}>
                      {lineTrains.length === 0 ? (
                        <div className="muted" style={{ padding: "16px", textAlign: "center", backgroundColor: "var(--panel-2)", borderRadius: "6px", fontSize: "12.5px" }}>
                          در حال حاضر هیچ قطاری در این ریل مستقر نیست.
                        </div>
                      ) : (
                        lineTrains.map((tr) => (
                          <div
                            key={tr.id}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              padding: "10px 12px",
                              backgroundColor: "var(--panel-2)",
                              borderRadius: "8px",
                              border: "1px solid var(--line)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: "bold", fontSize: "13.5px" }} className="num">قطار {tr.code}</span>
                                  <span className="pill p-mut num" style={{ fontSize: "10px" }}>
                                    جایگاه {tr.slotIndex + 1}
                                  </span>
                                  {tr.hasKafshak && <span className="pill" style={{ backgroundColor: "#f59e0b", color: "#fff", fontSize: "10px", padding: "1px 5px" }}>⚡ کفشک</span>}
                                  {tr.noAtp && <span className="pill" style={{ backgroundColor: "#ef4444", color: "#fff", fontSize: "10px", padding: "1px 5px" }}>🚨 عدم ATP</span>}
                                  {tr.movadDavvar && (
                                    <span
                                      className="pill"
                                      style={{
                                        backgroundColor: tr.movadDavvar === "A" ? "#8b5cf6" : tr.movadDavvar === "B" ? "#14b8a6" : "#f59e0b",
                                        color: "#fff",
                                        fontSize: "10px",
                                        padding: "1px 5px"
                                      }}
                                    >
                                      🔄 دوار {tr.movadDavvar}
                                    </span>
                                  )}
                                  {tr.noLicense && <span className="pill" style={{ backgroundColor: "#be123c", color: "#fff", fontSize: "10px", padding: "1px 5px" }}>🛑 بدون مجوز</span>}
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
                                  {tr.status === 2 ? "در اختیار تعمیرات" :
                                    tr.status === 3 ? "غیرفعال / خارج سرویس" :
                                      tr.status === 4 ? "در حال اعزام" : "آماده به کار / استندبای"}
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                {canManageLines && (
                                  <select
                                    value={tr.status}
                                    className="input sm"
                                    style={{ padding: "4px 8px", fontSize: "11.5px", width: "120px", height: "30px" }}
                                    onChange={async (e) => {
                                      const newStatus = Number(e.target.value);
                                      startTransition(async () => {
                                        const res = await updateTrainStatus(tr.id, newStatus);
                                        if (res.error) {
                                          alert(res.error);
                                        } else {
                                          router.refresh();
                                        }
                                      });
                                    }}
                                  >
                                    <option value="1">آماده / استندبای</option>
                                    <option value="2">تعمیرات</option>
                                    <option value="3">غیرفعال</option>
                                    <option value="4">در حال اعزام</option>
                                  </select>
                                )}

                                {canCreateManovr && (
                                  <button
                                    type="button"
                                    className="btn sm primary"
                                    style={{ padding: "5px 10px", fontSize: "11.5px", height: "30px" }}
                                    onClick={() => {
                                      setManovrTrainId(tr.id);
                                      setManovrSourceLineId(selectedLine.id);
                                      setActiveLineTab("manovr");
                                    }}
                                  >
                                    خروج مانور
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* نوار کنترل وضعیت فنی و تجهیزات قطار */}
                            {(canEditKafshak || canEditAtp || canEditRotary || canEditLicense) && (
                              <div style={{ display: "flex", gap: "6px", alignItems: "center", paddingTop: "6px", borderTop: "1px dashed var(--line)", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>تغییر وضعیت فنی:</span>
                                {canEditKafshak && (
                                  <button
                                    type="button"
                                    className={`btn sm ${tr.hasKafshak ? "accent" : ""}`}
                                    style={{ fontSize: "10px", padding: "2px 6px", height: "24px" }}
                                    disabled={isPending}
                                    onClick={() => {
                                      startTransition(async () => {
                                        await updateTrainFlags(tr.id, { hasKafshak: !tr.hasKafshak });
                                        router.refresh();
                                      });
                                    }}
                                  >
                                    {tr.hasKafshak ? "⚡ کفشک دارد" : "⚡ بدون کفشک"}
                                  </button>
                                )}
                                {canEditAtp && (
                                  <button
                                    type="button"
                                    className={`btn sm ${tr.noAtp ? "danger" : ""}`}
                                    style={{ fontSize: "10px", padding: "2px 6px", height: "24px" }}
                                    disabled={isPending}
                                    onClick={() => {
                                      startTransition(async () => {
                                        await updateTrainFlags(tr.id, { noAtp: !tr.noAtp });
                                        router.refresh();
                                      });
                                    }}
                                  >
                                    {tr.noAtp ? "🚨 عدم ATP" : "✅ ATP دارد"}
                                  </button>
                                )}
                                {canEditRotary && (
                                  <select
                                    value={tr.movadDavvar || ""}
                                    className="input sm"
                                    style={{ fontSize: "10px", padding: "1px 4px", height: "24px", width: "95px" }}
                                    disabled={isPending}
                                    onChange={(e) => {
                                      const val = e.target.value || null;
                                      startTransition(async () => {
                                        await updateTrainFlags(tr.id, { movadDavvar: val });
                                        router.refresh();
                                      });
                                    }}
                                  >
                                    <option value="">بدون دوّار</option>
                                    <option value="A">دوار A</option>
                                    <option value="B">دوار B</option>
                                    <option value="C">دوار C</option>
                                  </select>
                                )}
                                {canEditLicense && (
                                  <button
                                    type="button"
                                    className={`btn sm ${tr.noLicense ? "danger" : ""}`}
                                    style={{ fontSize: "10px", padding: "2px 6px", height: "24px" }}
                                    disabled={isPending}
                                    onClick={() => {
                                      startTransition(async () => {
                                        await updateTrainFlags(tr.id, { noLicense: !tr.noLicense });
                                        router.refresh();
                                      });
                                    }}
                                  >
                                    {tr.noLicense ? "🛑 بدون مجوز" : "🟢 با مجوز"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* بخش پارک مستقیم قطار جدید در صورت وجود ظرفیت خالی روی ریل */}
                    {!isFull && canLayout && (
                      <div style={{ marginTop: "14px", padding: "12px", border: "1px dashed var(--line)", borderRadius: "8px", backgroundColor: "var(--panel-2)" }}>
                        <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "bold", color: "var(--accent)" }}>استقرار قطار جدید روی این ریل:</h4>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            const trId = Number(fd.get("newTrainId"));
                            const slot = Number(fd.get("newSlotIdx"));
                            if (!trId) return alert("لطفاً قطار را انتخاب کنید.");

                            startTransition(async () => {
                              const res = await relocateTrainDirectly(trId, selectedLine.id, slot);
                              if (res.error) {
                                alert(res.error);
                              } else {
                                setSelectedLine(null);
                                router.refresh();
                              }
                            });
                          }}
                          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                        >
                          <div className="grid2" style={{ gap: "8px" }}>
                            <div className="field" style={{ marginBottom: 0 }}>
                              <SearchableSelect
                                name="newTrainId"
                                value={newTrainIdState}
                                onChange={setNewTrainIdState}
                                placeholder="-- انتخاب قطار دپو --"
                                required
                                options={trains.filter(t => t.lineId === null).map(t => ({ value: t.id, label: `قطار ${t.code}` }))}
                              />
                            </div>
                            <div className="field" style={{ marginBottom: 0 }}>
                              <select name="newSlotIdx" className="input sm" style={{ padding: "6px 8px", fontSize: "12px" }} required>
                                {(() => {
                                  const occupied = lineTrains.map(t => t.slotIndex);
                                  const empty: number[] = [];
                                  for (let i = 0; i < selectedLine.capacity; i++) {
                                    if (!occupied.includes(i)) empty.push(i);
                                  }
                                  return empty.map(slot => (
                                    <option key={slot} value={slot}>جایگاه {slot + 1}</option>
                                  ));
                                })()}
                              </select>
                            </div>
                          </div>
                          <button type="submit" className="btn sm accent" style={{ width: "100%", justifyContent: "center", padding: "6px 12px" }} disabled={isPending}>
                            {isPending ? "در حال ثبت..." : "ثبت استقرار مستقیم ناوگان"}
                          </button>
                        </form>
                      </div>
                    )}

                  </div>
                )}

                {/* تب ۲: ثبت مانور جابجایی */}
                {activeLineTab === "manovr" && (
                  <form onSubmit={handleTab2Submit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                        قطار انتخابی جهت جابجایی *
                      </label>
                      <SearchableSelect
                        value={manovrTrainId}
                        onChange={(val) => setManovrTrainId(val ? Number(val) : "")}
                        placeholder="-- انتخاب قطار از روی این خط --"
                        required
                        style={{ minHeight: "32px", padding: "4px 8px", fontSize: "12px" }}
                        options={lineTrains.map((t) => ({
                          value: t.id,
                          label: `قطار ${t.code} (مستقر در اسلات ${t.slotIndex + 1})`,
                        }))}
                      />
                    </div>

                    <div className="grid2" style={{ gap: "8px" }}>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                          خط ریل مقصد *
                        </label>
                        <SearchableSelect
                          value={manovrDestLineId}
                          onChange={(val) => {
                            setManovrDestLineId(val ? Number(val) : "");
                            setManovrSlotIdx(0);
                          }}
                          placeholder="-- انتخاب خط مقصد --"
                          required
                          style={{ minHeight: "32px", padding: "4px 8px", fontSize: "12px" }}
                          options={lines.map((l) => {
                            const isSameLine = l.id === selectedLine.id;
                            const currentTrainsOnLine = trains.filter(
                              (t) => t.lineId === l.id && t.id !== Number(manovrTrainId)
                            );
                            const capacityLeft = l.capacity - currentTrainsOnLine.length;
                            return {
                              value: l.id,
                              label: isSameLine
                                ? `${l.name} (همین خط — مانور در محل / ثابت)`
                                : `${l.name} (ظرفیت خالی: ${capacityLeft} قطار)`,
                              disabled: capacityLeft <= 0,
                            };
                          })}
                        />
                      </div>

                      <div className="field" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                          اسلات پارک مقصد *
                        </label>
                        <select
                          className="input sm"
                          style={{ height: "32px", padding: "4px 8px", fontSize: "12px" }}
                          value={manovrSlotIdx}
                          onChange={(e) => setManovrSlotIdx(Number(e.target.value))}
                          required
                        >
                          {emptyDestSlots.length === 0 ? (
                            <option value="">-- ابتدا خط مقصد را انتخاب کنید --</option>
                          ) : (
                            emptyDestSlots.map((slot) => (
                              <option key={slot} value={slot}>
                                جایگاه {slot + 1}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>

                    {/* دکمه تنظیم سریع مانور در محل */}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="btn sm"
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          height: "26px",
                          backgroundColor: manovrDestLineId === selectedLine.id ? "rgba(59, 130, 246, 0.15)" : undefined,
                          borderColor: manovrDestLineId === selectedLine.id ? "rgba(59, 130, 246, 0.4)" : undefined,
                          color: manovrDestLineId === selectedLine.id ? "var(--color-primary, #2563eb)" : undefined,
                        }}
                        onClick={() => {
                          setManovrDestLineId(selectedLine.id);
                          const selTrain = lineTrains.find((t) => t.id === Number(manovrTrainId));
                          if (selTrain) setManovrSlotIdx(selTrain.slotIndex);
                        }}
                      >
                        ⚡ مانور در محل (ثبت روی {selectedLine.name})
                      </button>
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="type" style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                        نوع مانور عملیاتی *
                      </label>
                      <SearchableSelect
                        value={manovrType}
                        onChange={(val) => {
                          const code = val ? Number(val) : 1;
                          setManovrType(code);
                          // اگر استاتیک (4)، تعویض کفشک (20) یا انتقال دائم است، مقصد روی همین خط تنظیم شود
                          if (code === 4 || code === 20 || isPermanentTransfer(code)) {
                            setManovrDestLineId(selectedLine.id);
                            const selTrain = lineTrains.find((t) => t.id === Number(manovrTrainId));
                            if (selTrain) setManovrSlotIdx(selTrain.slotIndex);
                          }
                        }}
                        placeholder="-- انتخاب نوع مانور --"
                        required
                        style={{ minHeight: "32px", padding: "4px 8px", fontSize: "12px" }}
                        options={(() => {
                          const list = manovrTypes ? manovrTypes.filter((v) => v.isActive !== false).map((v) => ({ value: v.code, label: v.label })) : [];
                          const existing = new Set(list.map((v) => v.value));
                          for (const [k, v] of Object.entries(ManovrType)) {
                            const code = Number(k);
                            if (!existing.has(code)) {
                              list.push({ value: code, label: v });
                            }
                          }
                          return list.sort((a, b) => a.value - b.value);
                        })()}
                      />
                    </div>

                    <div className="grid2" style={{ gap: "8px" }}>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                          راهبر مسئول ۱ *
                        </label>
                        <SearchableSelect
                          value={manovrRahbar1}
                          onChange={(val) => setManovrRahbar1(val ? Number(val) : "")}
                          placeholder="-- انتخاب راهبر --"
                          required
                          style={{ minHeight: "32px", padding: "4px 8px", fontSize: "12px" }}
                          options={rahbaran.map((r) => ({
                            value: r.id,
                            label: r.name,
                          }))}
                        />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                          راهبر مسئول ۲
                        </label>
                        <SearchableSelect
                          value={manovrRahbar2}
                          onChange={(val) => setManovrRahbar2(val ? Number(val) : "")}
                          placeholder="-- بدون راهبر دوم --"
                          style={{ minHeight: "32px", padding: "4px 8px", fontSize: "12px" }}
                          options={rahbaran.map((r) => ({
                            value: r.id,
                            label: r.name,
                          }))}
                        />
                      </div>
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="manovrExecutionTime" style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                        زمان اجرای مانور *
                      </label>
                      <JalaliDateTimePicker
                        value={manovrExecutionTime}
                        onChange={(val) => setManovrExecutionTime(val)}
                        required
                      />
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                        توضیحات مانور
                      </label>
                      <textarea
                        className="input sm"
                        rows={1}
                        style={{ fontSize: "12px", padding: "4px 8px", minHeight: "30px", maxHeight: "50px" }}
                        value={manovrDesc}
                        onChange={(e) => setManovrDesc(e.target.value)}
                      />
                    </div>

                    {/* دکمه سابمیت ثابت چسبیده به پایین */}
                    <div
                      style={{
                        position: "sticky",
                        bottom: 0,
                        backgroundColor: "var(--panel)",
                        paddingTop: "6px",
                        paddingBottom: "2px",
                        borderTop: "1px solid var(--line-soft)",
                        marginTop: "4px",
                        zIndex: 10,
                      }}
                    >
                      <button
                        type="submit"
                        className="btn primary"
                        style={{ width: "100%", height: "36px", fontSize: "13px", fontWeight: "bold", justifyContent: "center" }}
                        disabled={isPending}
                      >
                        {isPending ? "در حال ثبت مانور..." : "ثبت و اعمال نهایی مانور"}
                      </button>
                    </div>
                  </form>
                )}

                {/* تب ۳: انتقال سریع ادمین */}
                {activeLineTab === "relocate" && canLayout && (
                  <form onSubmit={handleRelocateSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="field">
                      <label>انتخاب قطار دپو *</label>
                      <SearchableSelect
                        value={relocateTrainId}
                        onChange={(val) => setRelocateTrainId(val ? Number(val) : "")}
                        placeholder="-- انتخاب قطار --"
                        required
                        options={trains.map((t) => {
                          const curLine = lines.find((l) => l.id === t.lineId);
                          return {
                            value: t.id,
                            label: `قطار ${t.code} (مستقر در ریل: {curLine?.name ?? "خارج ریل"})`,
                          };
                        })}
                      />
                    </div>

                    <div className="grid2">
                      <div className="field">
                        <label>خط ریل هدف *</label>
                        <SearchableSelect
                          value={relocateLineId}
                          onChange={(val) => {
                            setRelocateLineId(val ? Number(val) : "");
                            setRelocateSlotIdx(0);
                          }}
                          placeholder="-- انتخاب خط مقصد --"
                          required
                          options={lines.map((l) => ({
                            value: l.id,
                            label: `${l.name} (ظرفیت: ${l.capacity})`,
                          }))}
                        />
                      </div>

                      <div className="field">
                        <label>اسلات پارک هدف *</label>
                        <select
                          className="input"
                          value={relocateSlotIdx}
                          onChange={(e) => setRelocateSlotIdx(Number(e.target.value))}
                          required
                        >
                          {emptyRelocateSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              جایگاه {slot + 1}
                            </option>
                          ))}
                          {emptyRelocateSlots.length === 0 && (
                            <option value="">-- بدون اسلات خالی --</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <div style={{ background: "var(--warn-bg)", color: "var(--warn)", padding: "10px", borderRadius: "6px", fontSize: "11px", lineHeight: "1.6" }}>
                      ⚠️ توجه: این جابجایی به صورت مستقیم و بدون ثبت سند رسمی مانور در دیتابیس پایانه انجام می‌شود. صرفاً جهت اصلاحات سریع ادمین!
                    </div>

                    <button type="submit" className="btn primary" style={{ width: "100%", marginTop: "8px" }} disabled={isPending}>
                      {isPending ? "در حال انتقال..." : "انتقال سریع و مستقیم"}
                    </button>
                  </form>
                )}

              </div>
            </div>
          </div>
        );
      })()}

      {/* مودال شناور ثبت مانور سریع */}
      {showManovrModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(15,23,42,0.4)",
            backdropFilter: "blur(6px)",
            zIndex: 100000,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div className="card" style={{ width: "500px", backgroundColor: "var(--panel)" }}>
            <div className="card-head">
              <h2>ثبت مانور جابجایی قطار</h2>
              <span className="spacer" />
              <button className="btn sm" onClick={() => setShowManovrModal(false)}>
                بستن
              </button>
            </div>
            <form onSubmit={handleCreateManovrSubmit}>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="grid2">
                  <div className="field">
                    <label>مبدأ مانور</label>
                    <input
                      type="text"
                      className="input"
                      disabled
                      value={lines.find((l) => l.id === sourceLineId)?.name ?? "نامشخص"}
                    />
                  </div>
                  <div className="field">
                    <label>مقصد مانور</label>
                    <input
                      type="text"
                      className="input"
                      disabled
                      value={lines.find((l) => l.id === destLineId)?.name ?? "نامشخص"}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="trainId">قطار انتخابی جهت مانور</label>
                  <select
                    id="trainId"
                    name="trainId"
                    className="input"
                    value={preSelectedTrainId || undefined}
                    onChange={(e) => setPreSelectedTrainId(Number(e.target.value))}
                    required
                  >
                    {trains
                      .filter((t) => t.lineId === sourceLineId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          قطار {t.code} ({TrainType[t.type]})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="type">نوع مانور *</label>
                  <select id="type" name="type" className="input" defaultValue="2" required>
                    {(() => {
                      const list = manovrTypes ? manovrTypes.filter((v) => v.isActive !== false).map((v) => ({ code: v.code, label: v.label })) : [];
                      const existing = new Set(list.map((v) => v.code));
                      for (const [k, v] of Object.entries(ManovrType)) {
                        const code = Number(k);
                        if (!existing.has(code)) {
                          list.push({ code, label: v });
                        }
                      }
                      return list.sort((a, b) => a.code - b.code).map((v) => (
                        <option key={v.code} value={v.code}>
                          {v.label}
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                <div className="grid2">
                  <div className="field">
                    <label htmlFor="rahbar1Id">راهبر مسئول ۱ *</label>
                    <select id="rahbar1Id" name="rahbar1Id" className="input" required>
                      <option value="">-- انتخاب کنید --</option>
                      {rahbaran.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="rahbar2Id">راهبر مسئول ۲ (اختیاری)</label>
                    <select id="rahbar2Id" name="rahbar2Id" className="input">
                      <option value="">-- انتخاب کنید --</option>
                      {rahbaran.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="executionTime">زمان اجرای مانور *</label>
                  <JalaliDateTimePicker
                    name="executionTime"
                    defaultValue={new Date().toISOString()}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="description">توضیحات تکمیلی</label>
                  <textarea id="description" name="description" className="input" rows={2} />
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <button type="submit" className="btn primary" style={{ flex: 1 }}>
                    ثبت نهایی مانور و انتقال قطار
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ flex: 1 }}
                    onClick={() => setShowManovrModal(false)}
                  >
                    انصراف
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* پنل شناور جستجوی سریع (Ctrl+K) */}
      {showSearch && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(15,23,42,0.4)",
            backdropFilter: "blur(6px)",
            zIndex: 100000,
            display: "grid",
            placeItems: "start center",
            paddingTop: "120px",
          }}
          onClick={() => setShowSearch(false)}
        >
          <div
            className="card"
            style={{ width: "500px", backgroundColor: "var(--panel)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px" }}>
              <input
                type="text"
                className="input"
                placeholder="شماره قطار یا نام ریل را جستجو کنید..."
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div style={{ marginTop: "12px", maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                {filteredSearchList.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "var(--panel-2)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "bold",
                    }}
                    onClick={() => handleSearchResultClick(item)}
                  >
                    {item.title}
                  </div>
                ))}

                {searchQuery && filteredSearchList.length === 0 && (
                  <span className="muted" style={{ fontSize: "12px", padding: "4px" }}>
                    موردی یافت نشد.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال پیام موفقیت */}
      {successMsg && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(6px)",
            zIndex: 100000,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div className="card" style={{ width: "350px", backgroundColor: "var(--panel)", textAlign: "center" }}>
            <div className="card-head" style={{ justifyContent: "center" }}>
              <h2 style={{ color: "var(--ok)", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center", width: "100%" }}>
                <span>✅</span> عملیات موفق
              </h2>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center", padding: "24px 20px" }}>
              <p style={{ fontSize: "15px", lineHeight: "1.6" }}>{successMsg}</p>
              <button
                className="btn primary"
                onClick={() => setSuccessMsg("")}
                style={{ width: "100%", padding: "10px", fontWeight: "bold" }}
                autoFocus
              >
                تایید و ادامه کار
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
