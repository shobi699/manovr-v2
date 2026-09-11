"use client";

import React from "react";
import { TrainType, ManovrType } from "@/lib/enums";
import SearchableSelect from "@/components/SearchableSelect";
import JalaliDateTimePicker from "@/components/JalaliDateTimePicker";
import { LineData, TrainData, RahbarData, ManovrTypeLookupItem } from "../types";

export interface DepotCreateManovrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  lines: LineData[];
  trains: TrainData[];
  rahbaran: RahbarData[];
  manovrTypes?: ManovrTypeLookupItem[];
  sourceLineId: number | null;
  destLineId: number | null;
  preSelectedTrainId: number | "";
  setPreSelectedTrainId: React.Dispatch<React.SetStateAction<number | "">> | ((id: number | "") => void);
  quickType: string;
  setQuickType: (val: string) => void;
  quickRahbar1: string;
  setQuickRahbar1: (val: string) => void;
  quickRahbar2: string;
  setQuickRahbar2: (val: string) => void;
}

export default function DepotCreateManovrModal({
  isOpen,
  onClose,
  onSubmit,
  lines,
  trains,
  rahbaran,
  manovrTypes,
  sourceLineId,
  destLineId,
  preSelectedTrainId,
  setPreSelectedTrainId,
  quickType,
  setQuickType,
  quickRahbar1,
  setQuickRahbar1,
  quickRahbar2,
  setQuickRahbar2,
}: DepotCreateManovrModalProps) {
  if (!isOpen) return null;

  const sourceLine = lines.find((l) => l.id === sourceLineId);
  const destLine = lines.find((l) => l.id === destLineId);

  // گزینه‌های انواع مانور بر اساس لوکاپ و مقادیر پیش‌فرض
  const manovrTypeOptions = (() => {
    const list = manovrTypes
      ? manovrTypes
          .filter((v) => v.isActive !== false)
          .map((v) => ({ code: v.code, label: v.label }))
      : [];
    const existing = new Set(list.map((v) => v.code));
    for (const [k, v] of Object.entries(ManovrType)) {
      const code = Number(k);
      if (!existing.has(code)) {
        list.push({ code, label: v });
      }
    }
    return list
      .sort((a, b) => a.code - b.code)
      .map((v) => ({
        value: String(v.code),
        label: v.label,
      }));
  })();

  const trainOptions = trains
    .filter((t) => t.lineId === sourceLineId)
    .map((t) => ({
      value: String(t.id),
      label: `قطار ${t.code} (${TrainType[t.type] || "نامشخص"})`,
    }));

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
      <div className="card" style={{ width: "500px", maxWidth: "95vw", backgroundColor: "var(--panel)" }}>
        <div className="card-head">
          <h2>ثبت مانور جابجایی قطار</h2>
          <span className="spacer" />
          <button className="btn sm" onClick={onClose}>
            بستن
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="grid2">
              <div className="field">
                <label>مبدأ مانور</label>
                <input
                  type="text"
                  className="input"
                  disabled
                  value={sourceLine?.name ?? "نامشخص"}
                />
              </div>
              <div className="field">
                <label>مقصد مانور</label>
                <input
                  type="text"
                  className="input"
                  disabled
                  value={destLine?.name ?? "نامشخص"}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="trainId">قطار انتخابی جهت مانور *</label>
              <SearchableSelect
                name="trainId"
                value={preSelectedTrainId || ""}
                onChange={(val) => setPreSelectedTrainId(val ? Number(val) : "")}
                options={trainOptions}
                placeholder="جستجو و انتخاب قطار..."
                required
              />
            </div>

            <div className="field">
              <label htmlFor="type">نوع مانور *</label>
              <SearchableSelect
                name="type"
                value={quickType}
                onChange={(val) => setQuickType(String(val))}
                options={manovrTypeOptions}
                placeholder="جستجوی نوع مانور..."
                required
              />
            </div>

            <div className="grid2">
              <div className="field">
                <label htmlFor="rahbar1Id">راهبر مسئول ۱ *</label>
                <SearchableSelect
                  name="rahbar1Id"
                  value={quickRahbar1}
                  onChange={(val) => setQuickRahbar1(String(val))}
                  options={rahbaran.map((r) => ({
                    value: String(r.id),
                    label: r.name,
                  }))}
                  placeholder="جستجوی راهبر ۱..."
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="rahbar2Id">راهبر مسئول ۲ (اختیاری)</label>
                <SearchableSelect
                  name="rahbar2Id"
                  value={quickRahbar2}
                  onChange={(val) => setQuickRahbar2(String(val))}
                  options={[
                    { value: "", label: "-- بدون راهبر کمکی --" },
                    ...rahbaran.map((r) => ({
                      value: String(r.id),
                      label: r.name,
                    })),
                  ]}
                  placeholder="جستجوی راهبر کمکی..."
                />
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
                onClick={onClose}
              >
                انصراف
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
