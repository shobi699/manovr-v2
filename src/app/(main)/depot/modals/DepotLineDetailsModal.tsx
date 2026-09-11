"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Terminal as TerminalEnum, ManovrType } from "@/lib/enums";
import { isPermanentTransfer } from "@/lib/manovr-rules";
import { createManovr } from "@/app/actions/manovr";
import { toggleLineActive } from "@/app/actions/line";
import { relocateTrainDirectly, updateTrainStatus, updateTrainFlags } from "@/app/actions/train";
import { useToast } from "@/components/ui/Toast";
import SearchableSelect from "@/components/SearchableSelect";
import JalaliDateTimePicker from "@/components/JalaliDateTimePicker";
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
  initialType = 1,
  onLineChange,
}: DepotLineDetailsModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"trains" | "manovr" | "relocate">(
    initialTab === "details" ? "trains" : initialTab
  );
  const [manovrTrainId, setManovrTrainId] = useState<number | "">(initialTrainId);
  const [manovrDestLineId, setManovrDestLineId] = useState<number | "">(initialDestLineId);
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

  if (!line) return null;

  const lineTrains = trains.filter((t) => t.lineId === line.id);
  const isFull = lineTrains.length >= line.capacity;
  const isActive = line.isActive !== false;

  // اسلات‌های خالی ریل مقصد انتخابی مانور
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
    if (!manovrTrainId || !manovrDestLineId || !manovrRahbar1) {
      toast.warning("لطفاً قطار، خط مقصد و راهبر مسئول را انتخاب کنید.");
      return;
    }
    const fd = new FormData();
    fd.append("trainId", String(manovrTrainId));
    fd.append("sourceLineId", String(line.id));
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
        toast.error(res.error);
      } else {
        toast.success("مانور با موفقیت ثبت شد.");
        onClose();
        router.refresh();
      }
    });
  };

  // سابمیت جابجایی مستقیم سریع
  const handleRelocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relocateTrainId || !relocateLineId) {
      toast.warning("لطفاً قطار و خط مقصد را انتخاب کنید.");
      return;
    }
    startTransition(async () => {
      const res = await relocateTrainDirectly(Number(relocateTrainId), Number(relocateLineId), relocateSlotIdx);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("جابه‌جایی مستقیم قطار با موفقیت انجام شد.");
        onClose();
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
      dir="rtl"
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
            <h2 style={{ margin: 0 }}>کنترل ریل: {line.name}</h2>
            <div style={{ fontSize: "11px", color: "var(--ink-faint)", marginTop: "2px" }}>
              ترمینال: {TerminalEnum[line.terminal] ?? line.terminal} | ظرفیت: {lineTrains.length} / {line.capacity}
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
              🔄 ثبت مانور جابه‌جایی
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
                  <div style={{ textAlign: "center", padding: "30px", color: "var(--ink-faint)", fontSize: "13px" }}>
                    هیچ قطاری روی این ریل مستقر نیست.
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
                                startTransition(async () => {
                                  const res = await updateTrainStatus(tr.id, newStatus);
                                  if (res.error) {
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

              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="type" style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-soft)", marginBottom: "2px", display: "block" }}>
                  نوع مانور عملیاتی *
                </label>
                <SearchableSelect
                  value={manovrType}
                  onChange={(val) => {
                    const code = val ? Number(val) : 1;
                    setManovrType(code);
                    if (code === 4 || code === 20 || isPermanentTransfer(code)) {
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
          {activeTab === "relocate" && canLayout && (
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
}
