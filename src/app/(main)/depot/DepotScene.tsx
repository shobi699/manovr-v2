"use client";

import React, { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Terminal as TerminalEnum, TrainType, ManovrType } from "@/lib/enums";
import { isPermanentTransfer } from "@/lib/manovr-rules";
import { createManovr } from "@/app/actions/manovr";
import { saveLinePositions, toggleLineActive } from "@/app/actions/line";
import { relocateTrainDirectly, updateTrainStatus, updateTrainFlags } from "@/app/actions/train";
import { useTheme } from "@/components/ThemeProvider";
import JalaliDateTimePicker from "@/components/JalaliDateTimePicker";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

import { ZONE_CONFIG, STATUS_STYLE } from "@/lib/depot-visuals";
import { Icons } from "@/lib/icons";
import SearchableSelect from "@/components/SearchableSelect";
import { BorderRotate } from "@/components/ui/animated-gradient-border";
import { useToast } from "@/components/ui/Toast";

import {
  LineData,
  TrainData,
  ActiveManovrData,
  RahbarData,
  TerminalData,
  ManovrTypeLookupItem,
  DepotSceneProps,
  ZoneMap,
} from "./types";
import DepotCreateManovrModal from "./modals/DepotCreateManovrModal";
import DepotTrainDetailsModal from "./modals/DepotTrainDetailsModal";
import DepotLineDetailsModal from "./modals/DepotLineDetailsModal";
import DepotClassic2DView from "./views/DepotClassic2DView";
import DepotStructured2DView from "./views/DepotStructured2DView";
import DepotMap2DView from "./views/DepotMap2DView";

const Depot3DCanvas = dynamic(() => import("./scene3d/Depot3DCanvas"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "12px",
        minHeight: "400px",
      }}
    >
      <div className="spinner" />
      <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>در حال بارگذاری موتور شبیه‌سازی سه‌بعدی دپو...</span>
    </div>
  ),
});



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
  const toast = useToast();

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
  const [activeLineTab, setActiveLineTab] = useState<"trains" | "manovr" | "relocate">("trains");
  const [manovrTrainId, setManovrTrainId] = useState<number | "">("");
  const [manovrSourceLineId, setManovrSourceLineId] = useState<number | "">("");
  const [manovrDestLineId, setManovrDestLineId] = useState<number | "">("");
  const [manovrSlotIdx, setManovrSlotIdx] = useState<number>(0);
  const [manovrRahbar1, setManovrRahbar1] = useState<number | "">("");
  const [manovrRahbar2, setManovrRahbar2] = useState<number | "">("");
  const [manovrType, setManovrType] = useState<number>(2);
  const [manovrDesc, setManovrDesc] = useState<string>("");

  const [quickType, setQuickType] = useState<string>("2");
  const [quickRahbar1, setQuickRahbar1] = useState<string>("");
  const [quickRahbar2, setQuickRahbar2] = useState<string>("");

  const [successMsg, setSuccessMsg] = useState<string>("");

  // فیلدهای جابجایی سریع ادمین
  const [relocateTrainId, setRelocateTrainId] = useState<number | "">("");
  const [relocateLineId, setRelocateLineId] = useState<number | "">("");
  const [relocateSlotIdx, setRelocateSlotIdx] = useState<number>(0);
  const [newTrainIdState, setNewTrainIdState] = useState<number | "">("");

  // وضعیت کیفیت و نمای ۲بعدی/۳بعدی جاری — به درخواست صریح کاربر پیش‌فرض اکیداً نمای ۲بعدی است
  const [currentQuality, setCurrentQuality] = useState<"high" | "low" | "2d">("2d");
  const [view2DMode, setView2DMode] = useState<"grid" | "structured" | "map">(prefs?.view2DMode || "structured");
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
      setActiveLineTab("trains");
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
      toast.error(res.error);
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
      toast.error(res.error);
    } else {
      setModifiedPositions({});
      toast.success("چیدمان پایانه با موفقیت در دیتابیس ثبت شد.");
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

  // هندلر مشترک انتقال/مانور قطار به یک ریل یا جایگاه خالی
  const handleTrainDropOnLine = (trainId: number, targetLine: LineData, slotIdx?: number) => {
    const trainObj = trains.find((t) => t.id === trainId);
    if (!trainObj || trainObj.lineId === targetLine.id) return;
    const occupiedSlots = trains.filter((t) => t.lineId === targetLine.id && !t.isDisposed).map((t) => t.slotIndex);
    if (occupiedSlots.length >= targetLine.capacity) {
      toast.warning("ظرفیت ریل مقصد تکمیل است.");
      return;
    }
    let targetSlotIdx = typeof slotIdx === "number" ? slotIdx : 0;
    if (typeof slotIdx !== "number") {
      for (let idx = 0; idx < targetLine.capacity; idx++) {
        if (!occupiedSlots.includes(idx)) {
          targetSlotIdx = idx;
          break;
        }
      }
    }
    setSourceLineId(trainObj.lineId);
    setDestLineId(targetLine.id);
    setTargetSlot(targetSlotIdx);
    setPreSelectedTrainId(trainObj.id);
    setShowManovrModal(true);
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
        view2DMode === "structured" ? (
          <DepotStructured2DView
            lines={lines}
            trains={trains}
            activeManovrs={activeManovrs}
            terminals={terminals}
            canCreateManovr={canCreateManovr}
            canManageLines={canManageLines}
            canLayout={canLayout}
            isFocusMode={isFocusMode}
            theme={appearance.theme}
            onSelectLine={(l) => {
              setSelectedLine(l);
              setDestLineId(l.id);
            }}
            onSelectTrain={setSelectedTrain}
            onDropTrainToLine={handleTrainDropOnLine}
            onSelectEmptySlot={(srcLineId, dstLineId, slotIdx) => {
              setSourceLineId(srcLineId);
              setDestLineId(dstLineId);
              setTargetSlot(slotIdx);
              setShowManovrModal(true);
              setSelectedTrain(null);
            }}
          />
        ) : view2DMode === "map" ? (
          <DepotMap2DView
            lines={lines}
            trains={trains}
            activeManovrs={activeManovrs}
            terminals={terminals}
            canCreateManovr={canCreateManovr}
            canManageLines={canManageLines}
            canLayout={canLayout}
            isFocusMode={isFocusMode}
            theme={appearance.theme}
            onSelectLine={(l) => {
              setSelectedLine(l);
              setDestLineId(l.id);
            }}
            onSelectTrain={setSelectedTrain}
            onDropTrainToLine={handleTrainDropOnLine}
            onSelectEmptySlot={(srcLineId, dstLineId, slotIdx) => {
              setSourceLineId(srcLineId);
              setDestLineId(dstLineId);
              setTargetSlot(slotIdx);
              setShowManovrModal(true);
              setSelectedTrain(null);
            }}
          />
        ) : (
          <DepotClassic2DView
            lines={lines}
            trains={trains}
            activeManovrs={activeManovrs}
            terminals={terminals}
            columnsData={columnsData}
            canCreateManovr={canCreateManovr}
            canManageLines={canManageLines}
            canLayout={canLayout}
            isFocusMode={isFocusMode}
            theme={appearance.theme}
            onSelectLine={(l) => {
              setSelectedLine(l);
              setDestLineId(l.id);
            }}
            onSelectTrain={setSelectedTrain}
            onDropTrainToLine={handleTrainDropOnLine}
            onSelectEmptySlot={(srcLineId, dstLineId, slotIdx) => {
              setSourceLineId(srcLineId);
              setDestLineId(dstLineId);
              setTargetSlot(slotIdx);
              setShowManovrModal(true);
              setSelectedTrain(null);
            }}
          />
        )
      ) : (
        <Depot3DCanvas
          appearance={appearance}
          currentQuality={currentQuality}
          lines={lines}
          trains={trains}
          activeManovrs={activeManovrs}
          zones={ZONES}
          defaultTerminal={prefs.defaultTerminal}
          modifiedPositions={modifiedPositions}
          cameraFocusTarget={cameraFocusTarget}
          setCameraFocusTarget={setCameraFocusTarget}
          controlsRef={controlsRef}
          hoveredLineId={hoveredLineId}
          setHoveredLineId={setHoveredLineId}
          selectedLine={selectedLine}
          setSelectedLine={setSelectedLine}
          selectedTrain={selectedTrain}
          setSelectedTrain={setSelectedTrain}
          draggedTrainId={draggedTrainId}
          dragPos={dragPos}
          canCreateManovr={canCreateManovr}
          onTrainDragStart={handleTrainDragStart}
          onSelectEmptySlot={(srcLineId, dstLineId, slotIdx) => {
            setSourceLineId(srcLineId);
            setDestLineId(dstLineId);
            setTargetSlot(slotIdx);
            setShowManovrModal(true);
            setSelectedTrain(null);
          }}
        />
      )}

      {/* مودال اطلاعات قطار منتخب */}
      <DepotTrainDetailsModal
        train={selectedTrain}
        lines={lines}
        canCreateManovr={canCreateManovr}
        onClose={() => setSelectedTrain(null)}
        onStartStaticManovr={(train, line) => {
          setSelectedLine(line);
          setActiveLineTab("manovr");
          setManovrTrainId(train.id);
          setManovrDestLineId(train.lineId ?? "");
          setManovrSlotIdx(train.slotIndex);
          setManovrType(4);
          setSelectedTrain(null);
        }}
        onStartMoveManovr={(train) => {
          setSourceLineId(train.lineId);
          setSelectedTrain(null);
          toast.info("ریل مقصد را در صحنه کلیک کنید یا با درگ قطار را جابجا کنید.");
        }}
      />

      {/* مودال جامع کنترل و مدیریت ریل انتخابی */}
      <DepotLineDetailsModal
        line={selectedLine}
        onClose={() => setSelectedLine(null)}
        lines={lines}
        trains={trains}
        rahbaran={rahbaran}
        terminals={terminals}
        manovrTypes={manovrTypes}
        canManageLines={canManageLines}
        canCreateManovr={canCreateManovr}
        canLayout={canLayout}
        canEditKafshak={canEditKafshak}
        canEditAtp={canEditAtp}
        canEditRotary={canEditRotary}
        canEditLicense={canEditLicense}
        initialTab={activeLineTab}
        initialTrainId={manovrTrainId}
        initialDestLineId={manovrDestLineId}
        initialSlotIdx={manovrSlotIdx}
        initialType={manovrType}
        onLineChange={(updated) => {
          setSelectedLine(updated);
          const found = lines.find((l) => l.id === updated.id);
          if (found) (found as any).isActive = updated.isActive;
        }}
      />

      {/* مودال شناور ثبت مانور سریع */}
      <DepotCreateManovrModal
        isOpen={showManovrModal}
        onClose={() => setShowManovrModal(false)}
        onSubmit={handleCreateManovrSubmit}
        lines={lines}
        trains={trains}
        rahbaran={rahbaran}
        manovrTypes={manovrTypes}
        sourceLineId={sourceLineId}
        destLineId={destLineId}
        preSelectedTrainId={preSelectedTrainId}
        setPreSelectedTrainId={setPreSelectedTrainId}
        quickType={quickType}
        setQuickType={setQuickType}
        quickRahbar1={quickRahbar1}
        setQuickRahbar1={setQuickRahbar1}
        quickRahbar2={quickRahbar2}
        setQuickRahbar2={setQuickRahbar2}
      />

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
