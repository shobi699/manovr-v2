"use client";

import React, { useState, useEffect, useRef, useTransition, useMemo, useCallback } from "react";
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
import { persianSearchMatch } from "@/lib/persian-text";
import { useRegisterContextMenu, ContextMenuItem } from "@/components/context-menu";

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
  const isPendingRef = useRef(isPending);
  useEffect(() => {
    isPendingRef.current = isPending;
  }, [isPending]);
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

  // وضعیت کیفیت و نمای ۲بعدی/۳بعدی جاری — به درخواست صریح کاربر پیش‌فرض اکیداً نمای نقشه پایانه (۲بعدی) است
  const [currentQuality, setCurrentQuality] = useState<"high" | "low" | "2d">("2d");
  const [view2DMode, setView2DMode] = useState<"grid" | "structured" | "map">(prefs?.view2DMode || "map");
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  // بزرگ‌نمایی صفحه پایانه و المان‌های ریلی (بزرگ‌نمایی با مثبت/منفی و کلیدهای میانبر)
  const [mapZoom, setMapZoom] = useState<number>(100);

  // تابع کمکی سوئیچ بین حالت تمام‌صفحه مرورگر (HTML5 Fullscreen) و معمولی
  // فقط container دپو fullscreen می‌شود تا PageHeader و عملیات پایانه مخفی شوند
  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;
    const el = document.getElementById("depot-scene-container") || document.documentElement;
    if (!document.fullscreenElement) {
      if (el && el.requestFullscreen) {
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
  }, []);

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

  // میانبرهای صفحه‌کلید برای کنترل بزرگ‌نمایی نقشه (Ctrl +, Ctrl -, Ctrl 0) در تمام حالات به‌ویژه تمام‌صفحه
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

      if (currentQuality !== "2d") return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          setMapZoom((prev) => Math.min(160, prev + 10));
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          setMapZoom((prev) => Math.max(70, prev - 10));
        } else if (e.key === "0") {
          e.preventDefault();
          setMapZoom(100);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQuality]);

  // شناسه قطار پیش‌انتخاب شده برای مودال مانور کشیدن و رها کردن
  const [preSelectedTrainId, setPreSelectedTrainId] = useState<number | "">("");

  // زمان اجرای مانور انتخابی کاربر
  const [manovrExecutionTime, setManovrExecutionTime] = useState<string>(new Date().toISOString());

  // هدایت هوشمند انتخاب خط: نوع مانور پیش‌فرض اکیداً «انتقال قطار» (کد ۲)
  const handleSelectLine = (l: LineData) => {
    setSelectedLine(l);
    setDestLineId(l.id);
    const lineTrains = trains.filter((t) => t.lineId === l.id);
    if (lineTrains.length === 0) {
      setActiveLineTab("manovr");
      setManovrDestLineId(l.id);
      setManovrSourceLineId("");
      setManovrType(2); // پیش‌فرض: انتقال قطار (کد ۲)
    } else {
      setActiveLineTab("trains");
      setManovrSourceLineId(l.id);
      setManovrDestLineId("");
      setManovrType(2); // پیش‌فرض: انتقال قطار (کد ۲)
    }
  };

  // ریست کردن فیلدهای مودال با تغییر ریل انتخابی
  useEffect(() => {
    if (selectedLine) {
      const lineTrains = trains.filter((t) => t.lineId === selectedLine.id);
      const isLineEmpty = lineTrains.length === 0;

      if (isLineEmpty) {
        setActiveLineTab("manovr");
        setManovrTrainId("");
        setManovrSourceLineId("");
        setManovrDestLineId(selectedLine.id);
        setManovrSlotIdx(0);
        setManovrType(2); // پیش‌فرض: انتقال قطار (کد ۲)
      } else {
        setActiveLineTab("trains");
        setManovrTrainId("");
        setManovrSourceLineId(selectedLine.id);
        setManovrDestLineId("");
        setManovrSlotIdx(0);
        setManovrType(2); // پیش‌فرض: انتقال قطار (کد ۲)
      }

      setManovrRahbar1("");
      setManovrRahbar2("");
      setManovrDesc("");
      setManovrExecutionTime(new Date().toISOString());

      setRelocateTrainId("");
      setRelocateLineId(selectedLine.id);
      setRelocateSlotIdx(0);
      setNewTrainIdState("");
    }
  }, [selectedLine?.id]);

  // همگام‌سازی وضعیت قطارها با تغییر پروپس ورودی از سرور
  useEffect(() => {
    setTrains(initialTrains);
  }, [initialTrains]);

  // وضعیت درگ سه‌بعدی
  const [draggedTrainId, setDraggedTrainId] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<[number, number, number]>([0, 0, 0]);

  // مودال‌ها
  const [showManovrModal, setShowManovrModal] = useState(false);
  const [sourceLineId, setSourceLineId] = useState<number | null>(null);
  const [destLineId, setDestLineId] = useState<number | null>(null);
  const [targetSlot, setTargetSlot] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // تغییرات چیدمان ریل‌ها توسط ادمین
  const [modifiedPositions, setModifiedPositions] = useState<Record<number, { posX: number; posY: number; rotation: number }>>({});
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  // ثبت خودکار ابزارهای تعاملی پایانه دپو در موتور کلیک‌راست هوشمند
  const depotContextMenuItems = useMemo<ContextMenuItem[]>(() => {
    const activeTargetLine = selectedLine || (hoveredLineId ? lines.find((l) => l.id === hoveredLineId) : null);
    const activeTargetTrain = selectedTrain || (trains.length > 0 ? trains[0] : null);

    const items: ContextMenuItem[] = [];

    // ۱. کنترل قفل یا آزادسازی خط ریلی
    if (activeTargetLine) {
      items.push({
        id: "depot-track-lock",
        label: activeTargetLine.isActive
          ? `قفل و مسدودسازی ریل «${activeTargetLine.name}»`
          : `آزادسازی و فعال‌سازی ریل «${activeTargetLine.name}»`,
        icon: <span>{activeTargetLine.isActive ? "🔒" : "🔓"}</span>,
        badge: activeTargetLine.isActive ? "فعال / آزاد" : "مسدود",
        badgeVariant: activeTargetLine.isActive ? "good" : "warn",
        onClick: async () => {
          if (!canManageLines) {
            toast.error("شما مجوز تغییر وضعیت خطوط ریل را ندارید.");
            return;
          }
          const nextActive = !activeTargetLine.isActive;
          try {
            const res = await toggleLineActive(activeTargetLine.id, nextActive);
            if (res?.ok) {
              toast.success(`خط ریلی «${activeTargetLine.name}» با موفقیت ${nextActive ? "آزاد" : "مسدود"} شد.`);
              router.refresh();
            } else {
              toast.error(res?.error || "خطا در تغییر وضعیت ریل");
            }
          } catch {
            toast.error("خطا در برقراری ارتباط با سرور پایانه");
          }
        },
      });
    }

    // ۲. ثبت سریع جابجایی و مانور قطار
    items.push({
      id: "depot-quick-manovr",
      label: activeTargetTrain
        ? `ثبت مانور برای قطار ${activeTargetTrain.code}`
        : "ثبت سریع مانور قطار",
      icon: <span>⚡</span>,
      shortcut: "Ctrl+M",
      badge: "عملیاتی",
      badgeVariant: "accent",
      onClick: () => {
        if (activeTargetTrain) {
          setPreSelectedTrainId(activeTargetTrain.id);
          setSourceLineId(activeTargetTrain.lineId);
        }
        setShowManovrModal(true);
      },
    });

    // ۳. شناسنامه و بررسی وضعیت ناوگان
    if (activeTargetTrain) {
      items.push({
        id: "depot-train-inspect",
        label: `شناسنامه و وضعیت فنی قطار ${activeTargetTrain.code}`,
        icon: <span>🚆</span>,
        shortcut: "Ctrl+T",
        onClick: () => {
          setSelectedTrain(activeTargetTrain);
        },
      });
    }

    // ۴. تغییر حالت نمایش پایانه (نقشه پایانه / ۲بعدی افقی / شبیه‌سازی سه‌بعدی)
    items.push({
      id: "depot-switch-view",
      label:
        currentQuality === "2d"
          ? view2DMode === "map"
            ? "تغییر نما به چیدمان ۲بعدی افقی"
            : view2DMode === "structured"
            ? "تغییر نما به شبیه‌سازی سه‌بعدی"
            : "تغییر نما به نقشه خطوط پایانه"
          : "تغییر نما به نقشه پایانه",
      icon: <span>🗺️</span>,
      badge:
        currentQuality === "2d"
          ? view2DMode === "map"
            ? "نقشه پایانه"
            : view2DMode === "structured"
            ? "۲بعدی افقی"
            : "۲بعدی ۵ ستونه"
          : "سه‌بعدی",
      badgeVariant: "blue",
      onClick: () => {
        if (currentQuality === "2d" && view2DMode === "map") {
          setView2DMode("structured");
          toast.info("نمای ۲بعدی ساختاریافته پایانه فعال شد.");
        } else if (currentQuality === "2d" && view2DMode === "structured") {
          setCurrentQuality("low");
          toast.info("موتور سه‌بعدی شبیه‌سازی پایانه فعال شد.");
        } else {
          setCurrentQuality("2d");
          setView2DMode("map");
          toast.info("نمای نقشه خطوط پایانه فعال شد.");
        }
      },
    });

    // ۵. بازنشانی زاویه دید و دوربین
    items.push({
      id: "depot-reset-camera",
      label: "بازنشانی زاویه دید و موقعیت دوربین",
      icon: <span>🎯</span>,
      shortcut: "Home",
      onClick: () => {
        setCameraFocusTarget([0, 0, 0]);
        toast.info("زاویه دید و مرکز پایانه به حالت پیش‌فرض بازنشانی شد.");
      },
    });

    // ۶. سوئیچ حالت تمام‌صفحه (Focus Mode)
    items.push({
      id: "depot-toggle-fullscreen",
      label: isFocusMode ? "خروج از حالت تمام‌صفحه" : "حالت تمام‌صفحه پایانه (Focus Mode)",
      icon: <span>🖥️</span>,
      shortcut: "F11",
      badge: isFocusMode ? "فعال" : undefined,
      badgeVariant: "accent",
      separatorAfter: true,
      onClick: toggleFullscreen,
    });

    return items;
  }, [
    selectedLine,
    hoveredLineId,
    lines,
    selectedTrain,
    trains,
    canManageLines,
    currentQuality,
    view2DMode,
    isFocusMode,
    router,
    toast,
    toggleFullscreen,
  ]);

  useRegisterContextMenu("depot_tools", depotContextMenuItems);

  // مدیریت رفرش خودکار بر اساس پولینگ با حفاظت در برابر تراکم درخواست در شبکه کند
  useEffect(() => {
    if (prefs.refreshSec === 0) return;
    const intervalMs = Math.max(prefs.refreshSec, 5) * 1000;
    const timer = setInterval(() => {
      if (!isPendingRef.current) {
        startTransition(() => {
          router.refresh();
        });
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [prefs.refreshSec, router]);

  // رویداد فشردن کیبورد Ctrl+K برای جستجو و Ctrl + / Ctrl - / Ctrl 0 برای بزرگ‌نمایی
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.key === "ک")) {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        setMapZoom((prev) => Math.min(160, prev + 10));
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        setMapZoom((prev) => Math.max(70, prev - 10));
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "0" || e.key === "۰")) {
        e.preventDefault();
        setMapZoom(100);
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
    if (sourceLineId && !fd.has("sourceLineId")) fd.append("sourceLineId", String(sourceLineId));
    if (destLineId && !fd.has("destinationLineId")) fd.append("destinationLineId", String(destLineId));
    if (!fd.has("slotIndex")) fd.append("slotIndex", String(targetSlot));
    fd.append("noRedirect", "1");

    const tId = Number(fd.get("trainId"));
    const dId = Number(fd.get("destinationLineId"));
    const sIdx = Number(fd.get("slotIndex") ?? targetSlot);

    // به‌روزرسانی محلی و آنی وضعیت قطارها در نقشه (Optimistic UI Update)
    if (tId && dId) {
      setTrains((prev) =>
        prev.map((t) => (t.id === tId ? { ...t, lineId: dId, slotIndex: sIdx } : t))
      );
    }

    setShowManovrModal(false);
    setQuickRahbar1("");
    setQuickRahbar2("");
    setManovrRahbar1("");
    setManovrRahbar2("");
    setManovrDesc("");
    toast.success("مانور با موفقیت ثبت شد و در سیستم قرار گرفت.");

    const res = await createManovr(null, fd);
    if (res?.error) {
      toast.error(res.error);
      router.refresh();
    } else {
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

  // فیلتر کردن ریل‌ها و قطارها بر اساس جستجوی کاربر با نرمال‌سازی حروف فارسی و عربی
  const filteredSearchList = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const matchesLine = lines.filter(
      (l) =>
        persianSearchMatch(l.name, searchQuery) ||
        (l.tag && persianSearchMatch(l.tag, searchQuery))
    );
    const matchesTrain = trains.filter(
      (t) =>
        persianSearchMatch(t.code, searchQuery) ||
        (t.movadDavvar && persianSearchMatch(t.movadDavvar, searchQuery))
    );

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

  // هندلر مشترک انتقال/مانور قطار به یک ریل یا جایگاه خالی با اعتبارسنجی کامل
  const handleTrainDropOnLine = (trainId: number, targetLine: LineData, slotIdx?: number) => {
    if ((targetLine as any).isActive === false) {
      toast.warning(`خط ریلی «${targetLine.name}» مسدود است و امکان مانور به آن وجود ندارد.`);
      return;
    }

    const trainObj = trains.find((t) => t.id === trainId);
    if (!trainObj) return;

    // مانور درون همان خط (جابجایی جایگاه یا مانور در محل)
    if (trainObj.lineId === targetLine.id) {
      setSelectedLine(targetLine);
      setActiveLineTab("manovr");
      setManovrTrainId(trainObj.id);
      setManovrSourceLineId(targetLine.id);
      setManovrDestLineId(targetLine.id);
      setManovrSlotIdx(typeof slotIdx === "number" ? slotIdx : trainObj.slotIndex);
      setManovrType(2); // پیش‌فرض سراسری: انتقال قطار (کد ۲)
      setQuickType("2");
      toast.info(`فرم مانور قطار ${trainObj.code} در خط «${targetLine.name}» باز شد.`);
      return;
    }

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
    setQuickType("2"); // پیش‌فرض سراسری: انتقال قطار (کد ۲)
    setShowManovrModal(true);
  };

  // المان چندمنظوره بزرگ‌نمایی نقشه دپو (هم در نوار ابزار و هم در حالت تمام‌صفحه)
  const renderZoomControl = (isFloating = false) => {
    if (currentQuality !== "2d") return null;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          backgroundColor: isFloating
            ? (appearance.theme === "dark" ? "rgba(15, 23, 42, 0.88)" : "rgba(255, 255, 255, 0.95)")
            : "var(--bg)",
          color: isFloating ? "var(--ink)" : undefined,
          padding: isFloating ? "4px 8px" : "2px 6px",
          borderRadius: "var(--r-sm, 6px)",
          border: isFloating
            ? (appearance.theme === "dark" ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid var(--line)")
            : "1px solid var(--line)",
          boxShadow: isFloating ? "var(--sh-2, 0 8px 24px rgba(0, 0, 0, 0.25))" : undefined,
          backdropFilter: isFloating ? "blur(12px)" : undefined,
          direction: "rtl",
        }}
      >
        <button
          type="button"
          className="btn sm"
          style={{
            padding: "2px 8px",
            fontSize: "12px",
            fontWeight: "bold",
            minWidth: "26px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          onClick={() => setMapZoom((prev) => Math.min(160, prev + 10))}
          title="افزایش بزرگ‌نمایی (Ctrl +)"
        >
          ➕
        </button>
        <span
          style={{
            fontSize: "11.5px",
            fontWeight: "bold",
            minWidth: "38px",
            textAlign: "center",
            userSelect: "none",
            color: "var(--ink)",
          }}
          className="num"
        >
          {mapZoom}٪
        </span>
        <button
          type="button"
          className="btn sm"
          style={{
            padding: "2px 8px",
            fontSize: "12px",
            fontWeight: "bold",
            minWidth: "26px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          onClick={() => setMapZoom((prev) => Math.max(70, prev - 10))}
          title="کاهش بزرگ‌نمایی (Ctrl -)"
        >
          ➖
        </button>
        {mapZoom !== 100 && (
          <button
            type="button"
            className="btn sm outline"
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              cursor: "pointer",
              fontWeight: "600",
            }}
            onClick={() => setMapZoom(100)}
            title="اندازه پیش‌فرض ۱۰۰٪ (Ctrl 0)"
          >
            ۱۰۰٪
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      id="depot-scene-container"
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

      {/* نوار کنترل شناور در حالت تمام‌صفحه (شامل بزرگ‌نمایی و خروج) */}
      {isFocusMode && (
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            right: "16px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {renderZoomControl(true)}

          <button
            onClick={toggleFullscreen}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--r-sm, 6px)",
              backgroundColor: appearance.theme === "dark" ? "rgba(0, 0, 0, 0.75)" : "rgba(30, 41, 59, 0.85)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: "12px",
              fontWeight: "bold",
              cursor: "pointer",
              backdropFilter: "blur(12px)",
              transition: "opacity 0.2s, transform 0.15s ease",
              opacity: 0.85,
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.85";
              e.currentTarget.style.transform = "scale(1)";
            }}
            title="خروج از تمام‌صفحه (Esc)"
          >
            <span>✕</span>
            <span>خروج از تمام‌صفحه</span>
          </button>
        </div>
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
                className={`btn sm ${view2DMode === "map" ? "primary" : ""}`}
                onClick={() => setView2DMode("map")}
                style={{ fontSize: "11.5px", fontWeight: view2DMode === "map" ? "bold" : "normal" }}
              >
                🗺️ نقشه پایانه
              </button>
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
            </div>
          )}

          {/* ابزار کنترل بزرگ‌نمایی نقشه پایانه */}
          {renderZoomControl(false)}

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
            onSelectLine={handleSelectLine}
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
            zoom={mapZoom}
            onSelectLine={handleSelectLine}
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
            onSelectLine={handleSelectLine}
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
          setManovrType(2); // پیش‌فرض سراسری: انتقال قطار (کد ۲)
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
        onTrainChange={(updated) => {
          setTrains((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }}
      />

      {/* مودال شناور ثبت مانور سریع */}
      <DepotCreateManovrModal
        isOpen={showManovrModal}
        onClose={() => {
          setShowManovrModal(false);
          setQuickRahbar1("");
          setQuickRahbar2("");
        }}
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
