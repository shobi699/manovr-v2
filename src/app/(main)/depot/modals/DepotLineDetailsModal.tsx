"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Terminal as TerminalEnum, ManovrType } from "@/lib/enums";
import { isPermanentTransfer } from "@/lib/manovr-rules";
import { createManovr } from "@/app/actions/manovr";
import { toggleLineActive } from "@/app/actions/line";
import { relocateTrainDirectly, updateTrainStatus, updateTrainFlags } from "@/app/actions/train";
import { useToast } from "@/components/ui/Toast";
import SearchableSelect from "@/components/SearchableSelect";
import JalaliDateTimePicker from "@/components/JalaliDateTimePicker";
import { toEnglishDigits } from "@/lib/digits";
import { LineData, TrainData, RahbarData, TerminalData, ManovrTypeLookupItem } from "../types";

export interface DepotLineDetailsModalProps {
  line: LineData | null;
  onClose: () => void;
  lines: LineData[];
  trains: TrainData[];
  rahbaran: RahbarData[];
  terminals: TerminalData[];
  manovrTypes?: ManovrTypeLookupItem[];
  canManageLines: boolean;
  canCreateManovr: boolean;
  canLayout: boolean;
  canEditKafshak?: boolean;
  canEditAtp?: boolean;
  canEditRotary?: boolean;
  canEditLicense?: boolean;
  initialTab?: "trains" | "manovr" | "relocate" | "details";
  initialTrainId?: number | "";
  initialDestLineId?: number | "";
  initialSlotIdx?: number;
  initialType?: number;
  onLineChange?: (line: LineData) => void;
  onTrainChange?: (train: TrainData) => void;
}

export default function DepotLineDetailsModal({
  line,
  onClose,
  lines,
  trains,
  rahbaran,
  terminals,
  manovrTypes,
  canManageLines,
  canCreateManovr,
  canLayout,
  canEditKafshak,
  canEditAtp,
  canEditRotary,
  canEditLicense,
  initialTab = "trains",
  initialTrainId = "",
  initialDestLineId = "",
  initialSlotIdx = 0,
  initialType = 2, // پیش‌فرض سراسری: انتقال قطار (کد ۲)
  onLineChange,
  onTrainChange,
}: DepotLineDetailsModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"trains" | "manovr" | "relocate">(
    initialTab === "details" ? "trains" : initialTab
  );
  const [manovrTrainId, setManovrTrainId] = useState<number | "">(initialTrainId);
  const [manovrDestLineId, setManovrDestLineId] = useState<number | "">(initialDestLineId);
  const [manovrSourceLineId, setManovrSourceLineId] = useState<number | "">("");
  const [manualTrainCode, setManualTrainCode] = useState<string>("");
  const [isInboundMode, setIsInboundMode] = useState<boolean>(false);
  const [manovrSlotIdx, setManovrSlotIdx] = useState<number>(initialSlotIdx);
  const [manovrType, setManovrType] = useState<number>(initialType);
  const [manovrRahbar1, setManovrRahbar1] = useState<number | "">("");
  const [manovrRahbar2, setManovrRahbar2] = useState<number | "">("");
  const [manovrDesc, setManovrDesc] = useState<string>("");
  const [manovrExecutionTime, setManovrExecutionTime] = useState<string>(() => new Date().toISOString());

  const [relocateTrainId, setRelocateTrainId] = useState<number | "">("");
  const [relocateLineId, setRelocateLineId] = useState<number | "">("");
  const [relocateSlotIdx, setRelocateSlotIdx] = useState<number>(0);

  const [newTrainIdState, setNewTrainIdState] = useState<string>("");

  const [formError, setFormError] = useState<string | null>(null);
  const [relocateError, setRelocateError] = useState<string | null>(null);

  const [localTrains, setLocalTrains] = useState<TrainData[]>(trains);

  useEffect(() => {
    setLocalTrains(trains);
  }, [trains]);

  const lineTrains = line ? localTrains.filter((t) => t.lineId === line.id) : [];
  const isFull = line ? lineTrains.length >= line.capacity : false;
  const isActive = line ? line.isActive !== false : true;
  const isEmptyLine = lineTrains.length === 0;
  const isTargetMode = isEmptyLine || isInboundMode;

  // همگام‌سازی و تنظیم اولیه تب و متغیرهای مانور بر اساس وضعیت ریل (خالی یا دارای ناوگان)
  useEffect(() => {
    if (!line) return;
    const currentTrains = localTrains.filter((t) => t.lineId === line.id);
    const lineIsEmpty = currentTrains.length === 0;

    if (lineIsEmpty) {
      setActiveTab("manovr");
      setIsInboundMode(true);
      setManovrDestLineId(line.id);
      setManovrSourceLineId("");
      setManovrTrainId("");
      setManualTrainCode("");
      setManovrSlotIdx(0);
      setManovrType(2); // پیش‌فرض: انتقال قطار (کد ۲)
    } else {
      setActiveTab(initialTab === "details" ? "trains" : initialTab);
      setIsInboundMode(false);
      setManovrDestLineId(initialDestLineId || "");
      setManovrSourceLineId(line.id);
      setManovrTrainId(initialTrainId || "");
      setManualTrainCode("");
      setManovrSlotIdx(initialSlotIdx || 0);
      setManovrType(initialType || 2); // پیش‌فرض: انتقال قطار (کد ۲)
    }

    // راهبرهای مسئول و توضیحات برای هر مانور جدید همیشه باید خالی باشند تا از ثبت اشتباه جلوگیری شود
    setManovrRahbar1("");
    setManovrRahbar2("");
    setManovrDesc("");
  }, [line?.id, initialTab, initialDestLineId, initialTrainId, initialSlotIdx, initialType]);

  // اسلات‌های خالی ریل جاری (به عنوان مقصد برای مانور ورود به ریل)
  const emptyCurrentLineSlots: number[] = useMemo(() => {
    if (!line) return [];
    const occupied = localTrains
      .filter((t) => t.lineId === line.id && t.id !== Number(manovrTrainId))
      .map((t) => t.slotIndex);
    const slots: number[] = [];
    for (let i = 0; i < line.capacity; i++) {
      if (!occupied.includes(i)) slots.push(i);
    }
    return slots;
  }, [line, localTrains, manovrTrainId]);

  // اسلات‌های خالی ریل مقصد انتخابی مانور (برای حالت خروج از ریل جاری)
  const destLineObj = lines.find((l) => l.id === Number(manovrDestLineId));
  const emptyDestSlots: number[] = useMemo(() => {
    if (!destLineObj) return [];
    const occupied = localTrains
      .filter((t) => t.lineId === destLineObj.id && t.id !== Number(manovrTrainId))
      .map((t) => t.slotIndex);
    const slots: number[] = [];
    for (let i = 0; i < destLineObj.capacity; i++) {
      if (!occupied.includes(i)) slots.push(i);
    }
    return slots;
  }, [destLineObj, localTrains, manovrTrainId]);

  // گزینه‌های خط مبدأ در حالت ورود ناوگان
  const sourceLineOptions = useMemo(() => {
    if (!line) return [];
    return lines
      .filter((l) => l.id !== line.id)
      .map((l) => {
        const trs = localTrains.filter((t) => t.lineId === l.id && !t.isDisposed);
        return {
          value: l.id,
          label: trs.length > 0 ? `${l.name} (${trs.length} قطار مستقر)` : `${l.name} (خالی)`,
          trainCount: trs.length,
        };
      })
      .sort((a, b) => b.trainCount - a.trainCount);
  }, [lines, line, localTrains]);

  // گزینه‌های قطار جهت جابه‌جایی در حالت ورود ناوگان
  const inboundTrainOptions = useMemo(() => {
    if (!line) return [];
    const available = localTrains.filter((t) => !t.isDisposed && t.lineId !== line.id);
    if (manovrSourceLineId) {
      const onSource = available.filter((t) => t.lineId === Number(manovrSourceLineId));
      const others = available.filter((t) => t.lineId !== Number(manovrSourceLineId));
      return [
        ...onSource.map((t) => ({
          value: t.id,
          label: `قطار ${t.code} (مستقر در خط مبدأ انتخابی - اسلات ${t.slotIndex + 1})`,
        })),
        ...others.map((t) => {
          const srcLine = lines.find((l) => l.id === t.lineId);
          return {
            value: t.id,
            label: `قطار ${t.code} (در ${srcLine?.name ?? "نامشخص"} - اسلات ${t.slotIndex + 1})`,
          };
        }),
      ];
    }
    return available.map((t) => {
      const srcLine = lines.find((l) => l.id === t.lineId);
      return {
        value: t.id,
        label: `قطار ${t.code} (در ${srcLine?.name ?? "نامشخص"} - اسلات ${t.slotIndex + 1})`,
      };
    });
  }, [localTrains, line, manovrSourceLineId, lines]);

  // کنترل تغییر دستی شماره / پلاک قطار
  const handleManualTrainCodeChange = (val: string) => {
    setFormError(null);
    setManualTrainCode(val);
    const clean = toEnglishDigits(val).trim().toLowerCase();
    if (!clean) {
      setManovrTrainId("");
      return;
    }
    const matched = localTrains.find(
      (t) =>
        !t.isDisposed &&
        (toEnglishDigits(t.code).toLowerCase() === clean || String(t.id) === clean)
    );
    if (matched) {
      setManovrTrainId(matched.id);
      if (isTargetMode && matched.lineId && matched.lineId !== line?.id) {
        setManovrSourceLineId(matched.lineId);
      }
    } else {
      setManovrTrainId("");
    }
  };

  // کنترل انتخاب قطار از فهرست
  const handleTrainSelect = (val: string | number) => {
    setFormError(null);
    const tId = val ? Number(val) : "";
    setManovrTrainId(tId);
    if (tId) {
      const found = localTrains.find((t) => t.id === tId);
      if (found) {
        setManualTrainCode(found.code);
        if (isTargetMode && found.lineId && found.lineId !== line?.id) {
          setManovrSourceLineId(found.lineId);
        }
      }
    } else {
      setManualTrainCode("");
    }
  };

  const selectedTrainObj = localTrains.find((t) => t.id === Number(manovrTrainId));

  // اسلات‌های خالی ریل مقصد انتخابی جابجایی سریع
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
    if (!line) return;

    const finalTrainId = Number(manovrTrainId);
    const finalSourceLineId = isTargetMode ? Number(manovrSourceLineId) : line.id;
    const finalDestLineId = isTargetMode ? line.id : Number(manovrDestLineId);

    if (!finalTrainId) {
      const msg = "لطفاً شماره قطار را وارد کنید یا از لیست انتخاب نمایید.";
      setFormError(msg);
      toast.warning(msg);
      return;
    }
    if (!finalSourceLineId) {
      const msg = "لطفاً خط ریل مبدأ را مشخص کنید.";
      setFormError(msg);
      toast.warning(msg);
      return;
    }
    if (!finalDestLineId) {
      const msg = "لطفاً خط ریل مقصد را انتخاب کنید.";
      setFormError(msg);
      toast.warning(msg);
      return;
    }
    const destLineObj = lines.find((l) => l.id === finalDestLineId);
    if (destLineObj && !isPermanentTransfer(manovrType)) {
      const currentTrainsOnDest = localTrains.filter(
        (t) => t.lineId === finalDestLineId && t.id !== finalTrainId
      );
      if (currentTrainsOnDest.length >= destLineObj.capacity) {
        const msg = `ظرفیت خط مقصد (${destLineObj.name}) تکمیل است (${currentTrainsOnDest.length}/${destLineObj.capacity} قطار). امکان مانور به این خط وجود ندارد.`;
        setFormError(msg);
        toast.warning(msg);
        return;
      }
    }
    if (finalSourceLineId === finalDestLineId && isTargetMode) {
      const msg = "خط ریل مبدأ و مقصد نمی‌توانند یکسان باشند.";
      setFormError(msg);
      toast.warning(msg);
      return;
    }
    if (!manovrRahbar1) {
      const msg = "لطفاً راهبر مسئول ۱ را انتخاب کنید.";
      setFormError(msg);
      toast.warning(msg);
      return;
    }

    setFormError(null);

    const fd = new FormData();
    fd.append("trainId", String(finalTrainId));
    fd.append("sourceLineId", String(finalSourceLineId));
    fd.append("destinationLineId", String(finalDestLineId));
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
        setFormError(res.error);
        toast.error(res.error);
      } else {
        setFormError(null);
        toast.success("مانور جابه‌جایی با موفقیت ثبت شد.");
        const movedTrain = localTrains.find((t) => t.id === finalTrainId);
        if (movedTrain && onTrainChange) {
          onTrainChange({ ...movedTrain, lineId: finalDestLineId, slotIndex: manovrSlotIdx });
        }
        // پاکسازی کامل راهبرها و توضیحات برای مانور بعدی
        setManovrRahbar1("");
        setManovrRahbar2("");
        setManovrDesc("");
        onClose();
        router.refresh();
      }
    });
  };

  // سابمیت جابجایی مستقیم سریع
  const handleRelocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relocateTrainId || !relocateLineId) {
      const msg = "لطفاً قطار و خط مقصد را انتخاب کنید.";
      setRelocateError(msg);
      toast.warning(msg);
      return;
    }
    setRelocateError(null);
    startTransition(async () => {
      const res = await relocateTrainDirectly(Number(relocateTrainId), Number(relocateLineId), relocateSlotIdx);
      if (res.error) {
        setRelocateError(res.error);
        toast.error(res.error);
      } else {
        setRelocateError(null);
        toast.success("جابه‌جایی مستقیم قطار با موفقیت انجام شد.");
        onClose();
        router.refresh();
      }
    });
  };

  if (!line) return null;

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
      dir="rtl"
    >
      <div
        className="card"
        style={{
          width: "520px",
          maxWidth: "95vw",
          maxHeight: "92vh",
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
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ margin: 0 }}>کنترل ریل: {line.name}</h2>
              {isEmptyLine && (
                <span
                  style={{
                    fontSize: "10.5px",
                    padding: "1px 7px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                    color: "#16a34a",
                    fontWeight: "bold",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                  }}
                >
                  🟢 ریل خالی
                </span>
              )}
            </div>
            <div style={{ fontSize: "11px", color: "var(--ink-faint)", marginTop: "2px" }}>
              ترمینال: {terminals.find((t) => t.code === line.terminal)?.label ?? TerminalEnum[line.terminal] ?? line.terminal} | ظرفیت: {lineTrains.length} / {line.capacity}
            </div>
          </div>
          <span className="spacer" />
          {canManageLines && (
            <button
              className={`btn sm ${isActive ? "danger" : "primary"}`}
              onClick={async () => {
                const res = await toggleLineActive(line.id, !isActive);
                if (res.error) {
                  toast.error(res.error);
                } else {
                  const updated = { ...line, isActive: !isActive };
                  if (onLineChange) onLineChange(updated);
                  toast.success(!isActive ? "خط با موفقیت فعال شد." : "خط با موفقیت مسدود شد.");
                  router.refresh();
                }
              }}
              style={{ fontWeight: "bold" }}
            >
              {isActive ? "🔴 مسدود کردن خط" : "🟢 فعال‌سازی خط"}
            </button>
          )}
          <button className="btn sm" onClick={onClose}>
            بستن
          </button>
        </div>

        {/* هدر ناوبری تب‌ها */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--line)", backgroundColor: "var(--panel-2)", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setActiveTab("trains")}
            style={{
              flex: 1,
              padding: "9px 12px",
              border: "none",
              borderBottom: activeTab === "trains" ? "2px solid var(--accent)" : "2px solid transparent",
              background: activeTab === "trains" ? "var(--panel)" : "transparent",
              color: activeTab === "trains" ? "var(--ink)" : "var(--ink-soft)",
              fontWeight: activeTab === "trains" ? "bold" : "normal",
              fontSize: "12.5px",
              cursor: "pointer",
            }}
          >
            🚆 قطارهای روی خط ({lineTrains.length})
          </button>
          {canCreateManovr && (
            <button
              type="button"
              onClick={() => setActiveTab("manovr")}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: "none",
                borderBottom: activeTab === "manovr" ? "2px solid var(--accent)" : "2px solid transparent",
                background: activeTab === "manovr" ? "var(--panel)" : "transparent",
                color: activeTab === "manovr" ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: activeTab === "manovr" ? "bold" : "normal",
                fontSize: "12.5px",
                cursor: "pointer",
              }}
            >
              {isEmptyLine ? "🔄 ثبت مانور جابه‌جایی (ورود به ریل)" : "🔄 ثبت مانور جابه‌جایی"}
            </button>
          )}
          {canLayout && (
            <button
              type="button"
              onClick={() => setActiveTab("relocate")}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: "none",
                borderBottom: activeTab === "relocate" ? "2px solid var(--accent)" : "2px solid transparent",
                background: activeTab === "relocate" ? "var(--panel)" : "transparent",
                color: activeTab === "relocate" ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: activeTab === "relocate" ? "bold" : "normal",
                fontSize: "12.5px",
                cursor: "pointer",
              }}
            >
              ⚡ انتقال مستقیم
            </button>
          )}
        </div>

        {/* محتوای تب‌ها */}
        <div style={{ padding: "14px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* تب ۱: قطارهای مستقر */}
          {activeTab === "trains" && (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {lineTrains.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 16px",
                      color: "var(--ink-soft)",
                      fontSize: "12.5px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span>این ریل خالی است و در حال حاضر هیچ قطاری روی آن قرار ندارد.</span>
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={() => {
                        setActiveTab("manovr");
                        setIsInboundMode(true);
                      }}
                      style={{ fontSize: "12px", padding: "6px 14px", fontWeight: "bold" }}
                    >
                      🔄 ثبت مانور و انتقال ناوگان به این ریل
                    </button>
                  </div>
                ) : (
                  lineTrains.map((tr) => (
                    <div
                      key={tr.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        padding: "10px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: "8px",
                        backgroundColor: "var(--panel-2)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <b style={{ fontSize: "14px" }}>قطار شماره {tr.code}</b>
                          <span className="muted" style={{ fontSize: "11px", marginInlineStart: "8px" }}>
                            جایگاه {tr.slotIndex + 1}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "6px" }}>
                          {canLayout && (
                            <select
                              value={tr.status}
                              className="input sm"
                              style={{ padding: "4px 8px", fontSize: "11.5px", width: "120px", height: "30px" }}
                              onChange={async (e) => {
                                const newStatus = Number(e.target.value);
                                const prev = localTrains;
                                const updatedTrain = { ...tr, status: newStatus };
                                setLocalTrains((p) => p.map((item) => (item.id === tr.id ? updatedTrain : item)));
                                if (onTrainChange) onTrainChange(updatedTrain);
                                startTransition(async () => {
                                  const res = await updateTrainStatus(tr.id, newStatus);
                                  if (res.error) {
                                    setLocalTrains(prev);
                                    if (onTrainChange) onTrainChange(tr);
                                    toast.error(res.error);
                                  } else {
                                    toast.success("وضعیت قطار با موفقیت بروزرسانی شد.");
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
                                setActiveTab("manovr");
                              }}
                            >
                              خروج مانور
                            </button>
                          )}
                        </div>
                      </div>

                      {/* نوار کنترل وضعیت فنی */}
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
                                const prev = localTrains;
                                const updatedTrain = { ...tr, hasKafshak: !tr.hasKafshak };
                                setLocalTrains((p) => p.map((item) => (item.id === tr.id ? updatedTrain : item)));
                                if (onTrainChange) onTrainChange(updatedTrain);
                                startTransition(async () => {
                                  const res = await updateTrainFlags(tr.id, { hasKafshak: updatedTrain.hasKafshak });
                                  if (res?.error) {
                                    setLocalTrains(prev);
                                    if (onTrainChange) onTrainChange(tr);
                                    toast.error(res.error);
                                  } else {
                                    router.refresh();
                                  }
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
                                const prev = localTrains;
                                const updatedTrain = { ...tr, noAtp: !tr.noAtp };
                                setLocalTrains((p) => p.map((item) => (item.id === tr.id ? updatedTrain : item)));
                                if (onTrainChange) onTrainChange(updatedTrain);
                                startTransition(async () => {
                                  const res = await updateTrainFlags(tr.id, { noAtp: updatedTrain.noAtp });
                                  if (res?.error) {
                                    setLocalTrains(prev);
                                    if (onTrainChange) onTrainChange(tr);
                                    toast.error(res.error);
                                  } else {
                                    router.refresh();
                                  }
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
                                const prev = localTrains;
                                const updatedTrain = { ...tr, movadDavvar: val };
                                setLocalTrains((p) => p.map((item) => (item.id === tr.id ? updatedTrain : item)));
                                if (onTrainChange) onTrainChange(updatedTrain);
                                startTransition(async () => {
                                  const res = await updateTrainFlags(tr.id, { movadDavvar: val });
                                  if (res?.error) {
                                    setLocalTrains(prev);
                                    if (onTrainChange) onTrainChange(tr);
                                    toast.error(res.error);
                                  } else {
                                    router.refresh();
                                  }
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
                                const prev = localTrains;
                                const updatedTrain = { ...tr, noLicense: !tr.noLicense };
                                setLocalTrains((p) => p.map((item) => (item.id === tr.id ? updatedTrain : item)));
                                if (onTrainChange) onTrainChange(updatedTrain);
                                startTransition(async () => {
                                  const res = await updateTrainFlags(tr.id, { noLicense: updatedTrain.noLicense });
                                  if (res?.error) {
                                    setLocalTrains(prev);
                                    if (onTrainChange) onTrainChange(tr);
                                    toast.error(res.error);
                                  } else {
                                    router.refresh();
                                  }
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

              {/* استقرار مستقیم قطار جدید در صورت وجود جای خالی */}
              {!isFull && canLayout && (
                <div style={{ marginTop: "14px", padding: "12px", border: "1px dashed var(--line)", borderRadius: "8px", backgroundColor: "var(--panel-2)" }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "bold", color: "var(--accent)" }}>استقرار قطار جدید روی این ریل:</h4>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const trId = Number(fd.get("newTrainId"));
                      const slot = Number(fd.get("newSlotIdx"));
                      if (!trId) return toast.warning("لطفاً قطار را انتخاب کنید.");

                      startTransition(async () => {
                        const res = await relocateTrainDirectly(trId, line.id, slot);
                        if (res.error) {
                          toast.error(res.error);
                        } else {
                          toast.success("استقرار قطار روی ریل با موفقیت انجام شد.");
                          onClose();
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
                          options={trains.filter((t) => t.lineId === null).map((t) => ({ value: t.id, label: `قطار ${t.code}` }))}
                        />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <select name="newSlotIdx" className="input sm" style={{ height: "34px" }} required>
                          {(() => {
                            const occupied = lineTrains.map((t) => t.slotIndex);
                            const opts: React.ReactNode[] = [];
                            for (let i = 0; i < line.capacity; i++) {
                              if (!occupied.includes(i)) {
                                opts.push(
                                  <option key={i} value={i}>
                                    جایگاه {i + 1} (خالی)
                                  </option>
                                );
                              }
                            }
                            return opts;
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
          {activeTab === "manovr" && (
            <form onSubmit={handleTab2Submit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* اگر ریل در حال حاضر قطار دارد، امکان سوئیچ بین حالت خروج و ورود ناوگان */}
              {!isEmptyLine && (
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    marginBottom: "4px",
                    backgroundColor: "rgba(0,0,0,0.03)",
                    padding: "3px",
                    borderRadius: "6px",
                  }}
                >
                  <button
                    type="button"
                    className={`btn sm ${!isInboundMode ? "primary" : ""}`}
                    style={{ flex: 1, fontSize: "11px", height: "26px", justifyContent: "center" }}
                    onClick={() => {
                      setIsInboundMode(false);
                      setManovrSourceLineId(line.id);
                      setManovrDestLineId("");
                      setManovrTrainId("");
                      setManualTrainCode("");
                    }}
                  >
                    📤 مانور خروج از این ریل (مبدأ)
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${isInboundMode ? "primary" : ""}`}
                    style={{ flex: 1, fontSize: "11px", height: "26px", justifyContent: "center" }}
                    onClick={() => {
                      setIsInboundMode(true);
                      setManovrDestLineId(line.id);
                      setManovrSourceLineId("");
                      setManovrTrainId("");
                      setManualTrainCode("");
                    }}
                  >
                    📥 مانور ورود ناوگان به این ریل (مقصد)
                  </button>
                </div>
              )}

              {/* بنر وضعیت ریل مقصد برای مانور ورود / ریل خالی */}
              {isTargetMode && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(34, 197, 94, 0.08)",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                    color: "var(--ink)",
                    fontSize: "11.5px",
                    fontWeight: 600,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>📥</span>
                    <span>
                      {isEmptyLine ? "ریل خالی انتخابی" : "ثبت مانور ورود"} — انتقال ناوگان به ریل <strong>{line.name}</strong>
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: "rgba(34, 197, 94, 0.2)",
                      color: "#15803d",
                      fontWeight: "bold",
                    }}
                  >
                    ریل مقصد مانور
                  </span>
                </div>
              )}

              {/* در حالت ورود به ریل (isTargetMode): انتخاب ریل مبدأ و نمایش ریل مقصد */}
              {isTargetMode ? (
                <>
                  <div className="grid2" style={{ gap: "8px" }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                        خط ریل مبدأ *
                      </label>
                      <SearchableSelect
                        value={manovrSourceLineId}
                        onChange={(val) => {
                          const sId = val ? Number(val) : "";
                          setManovrSourceLineId(sId);
                          if (sId && manovrTrainId) {
                            const tr = localTrains.find((t) => t.id === Number(manovrTrainId));
                            if (tr && tr.lineId !== sId) {
                              setManovrTrainId("");
                              setManualTrainCode("");
                            }
                          }
                        }}
                        placeholder="-- انتخاب خط ریل مبدأ --"
                        required
                        style={{ minHeight: "32px", padding: "4px 8px", fontSize: "12px" }}
                        options={sourceLineOptions}
                      />
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                        خط ریل مقصد *
                      </label>
                      <input
                        type="text"
                        className="input sm"
                        disabled
                        value={`${line.name} (همین ریل انتخابی)`}
                        style={{
                          height: "32px",
                          padding: "4px 8px",
                          fontSize: "12px",
                          backgroundColor: "rgba(0,0,0,0.04)",
                          fontWeight: "bold",
                          color: "var(--ink)",
                          cursor: "not-allowed",
                        }}
                      />
                    </div>
                  </div>

                  {/* ردیف ورود دستی شماره قطار + انتخاب از فهرست */}
                  <div className="grid2" style={{ gap: "8px" }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                        ورود دستی شماره / پلاک قطار *
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          className="input sm"
                          placeholder="مثال: 121 یا ۱۲۱"
                          value={manualTrainCode}
                          onChange={(e) => handleManualTrainCodeChange(e.target.value)}
                          style={{
                            height: "32px",
                            padding: "4px 8px",
                            fontSize: "12px",
                            width: "100%",
                            borderColor: manovrTrainId ? "rgba(34, 197, 94, 0.6)" : undefined,
                          }}
                        />
                        {manovrTrainId && (
                          <span
                            style={{
                              position: "absolute",
                              left: "8px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              fontSize: "10.5px",
                              color: "#16a34a",
                              fontWeight: "bold",
                            }}
                          >
                            ✓ معتبر
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                        یا انتخاب از فهرست قطارها
                      </label>
                      <SearchableSelect
                        value={manovrTrainId}
                        onChange={handleTrainSelect}
                        placeholder="-- انتخاب قطار از فهرست --"
                        style={{ minHeight: "32px", padding: "4px 8px", fontSize: "12px" }}
                        options={inboundTrainOptions}
                      />
                    </div>
                  </div>

                  {/* خلاصه وضعیت قطار شناسایی‌شده */}
                  {selectedTrainObj && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 8px",
                        backgroundColor: "rgba(59, 130, 246, 0.08)",
                        borderRadius: "4px",
                        fontSize: "11px",
                        color: "var(--ink)",
                        border: "1px solid rgba(59, 130, 246, 0.2)",
                      }}
                    >
                      <span>
                        🚆 ناوگان انتخابی: <strong>قطار {selectedTrainObj.code}</strong>
                      </span>
                      <span>
                        مستقر در: <strong>{lines.find((l) => l.id === selectedTrainObj.lineId)?.name ?? "نامشخص"}</strong> (اسلات {selectedTrainObj.slotIndex + 1})
                      </span>
                    </div>
                  )}

                  {/* اسلات پارک مقصد روی همین خط */}
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                      اسلات پارک مقصد روی {line.name} *
                    </label>
                    <select
                      className="input sm"
                      style={{ height: "32px", padding: "4px 8px", fontSize: "12px" }}
                      value={manovrSlotIdx}
                      onChange={(e) => setManovrSlotIdx(Number(e.target.value))}
                      required
                    >
                      {emptyCurrentLineSlots.length === 0 ? (
                        <option value="">-- ظرفیت این ریل تکمیل است --</option>
                      ) : (
                        emptyCurrentLineSlots.map((slot) => (
                          <option key={slot} value={slot}>
                            جایگاه {slot + 1}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </>
              ) : (
                /* حالت خروج از ریل جاری (استاندارد) */
                <>
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
                          const isSameLine = l.id === line.id;
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
                        backgroundColor: manovrDestLineId === line.id ? "rgba(59, 130, 246, 0.15)" : undefined,
                        borderColor: manovrDestLineId === line.id ? "rgba(59, 130, 246, 0.4)" : undefined,
                        color: manovrDestLineId === line.id ? "var(--color-primary, #2563eb)" : undefined,
                      }}
                      onClick={() => {
                        setManovrDestLineId(line.id);
                        const selTrain = lineTrains.find((t) => t.id === Number(manovrTrainId));
                        if (selTrain) setManovrSlotIdx(selTrain.slotIndex);
                      }}
                    >
                      ⚡ مانور در محل (ثبت روی {line.name})
                    </button>
                  </div>
                </>
              )}

              {/* نوع مانور عملیاتی */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="type" style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                  نوع مانور عملیاتی *
                </label>
                <SearchableSelect
                  value={manovrType}
                  onChange={(val) => {
                    const code = val ? Number(val) : 1;
                    setManovrType(code);
                    if (!isTargetMode && (code === 4 || code === 20 || isPermanentTransfer(code))) {
                      setManovrDestLineId(line.id);
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
                {formError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      color: "#ef4444",
                      fontSize: "12px",
                      fontWeight: "bold",
                      marginBottom: "6px",
                      lineHeight: "1.4",
                    }}
                  >
                    <span style={{ fontSize: "15px" }}>⚠️</span>
                    <span style={{ flex: 1 }}>{formError}</span>
                    <button
                      type="button"
                      onClick={() => setFormError(null)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: "13px",
                        padding: "0 4px",
                        fontWeight: "bold",
                      }}
                      title="بستن اخطار"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <button
                  type="submit"
                  className="btn primary"
                  style={{ width: "100%", height: "36px", fontSize: "13px", fontWeight: "bold", justifyContent: "center" }}
                  disabled={isPending}
                >
                  {isPending ? "در حال ثبت مانور..." : isTargetMode ? `ثبت و اعمال نهایی مانور به ${line.name}` : "ثبت و اعمال نهایی مانور"}
                </button>
              </div>
            </form>
          )}

          {/* تب ۳: انتقال سریع ادمین */}
          {activeTab === "relocate" && canLayout && (
            <form onSubmit={handleRelocateSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="field">
                <label>انتخاب قطار دپو *</label>
                <SearchableSelect
                  value={relocateTrainId}
                  onChange={(val) => {
                    setRelocateError(null);
                    setRelocateTrainId(val ? Number(val) : "");
                  }}
                  placeholder="-- انتخاب قطار --"
                  required
                  options={trains.map((t) => {
                    const curLine = lines.find((l) => l.id === t.lineId);
                    return {
                      value: t.id,
                      label: `قطار ${t.code} (مستقر در ریل: ${curLine?.name ?? "خارج ریل"})`,
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
                      setRelocateError(null);
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
                    onChange={(e) => {
                      setRelocateError(null);
                      setRelocateSlotIdx(Number(e.target.value));
                    }}
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

              {relocateError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#ef4444",
                    fontSize: "12px",
                    fontWeight: "bold",
                    lineHeight: "1.4",
                  }}
                >
                  <span style={{ fontSize: "15px" }}>⚠️</span>
                  <span style={{ flex: 1 }}>{relocateError}</span>
                  <button
                    type="button"
                    onClick={() => setRelocateError(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: "13px",
                      padding: "0 4px",
                      fontWeight: "bold",
                    }}
                    title="بستن اخطار"
                  >
                    ✕
                  </button>
                </div>
              )}

              <button type="submit" className="btn primary" style={{ width: "100%", marginTop: "8px" }} disabled={isPending}>
                {isPending ? "در حال انتقال..." : "انتقال سریع و مستقیم"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
