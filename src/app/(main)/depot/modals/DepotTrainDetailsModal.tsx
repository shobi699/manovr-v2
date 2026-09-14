"use client";

import React from "react";
import { TrainType, TrainTypeFull } from "@/lib/enums";
import { LineData, TrainData } from "../types";

export interface DepotTrainDetailsModalProps {
  train: TrainData | null;
  lines: LineData[];
  canCreateManovr: boolean;
  onClose: () => void;
  onStartStaticManovr: (train: TrainData, line: LineData) => void;
  onStartMoveManovr: (train: TrainData) => void;
}

export default function DepotTrainDetailsModal({
  train,
  lines,
  canCreateManovr,
  onClose,
  onStartStaticManovr,
  onStartMoveManovr,
}: DepotTrainDetailsModalProps) {
  if (!train) return null;

  const currentLine = lines.find((l) => l.id === train.lineId);

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
      <div className="card" style={{ width: "450px", maxWidth: "95vw", backgroundColor: "var(--panel)" }}>
        <div className="card-head">
          <h2>قطار شماره {train.code}</h2>
          <span className="spacer" />
          <button className="btn sm" onClick={onClose}>
            بستن
          </button>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="muted">نوع قطار:</span>
            <b>{TrainTypeFull[train.type] || TrainType[train.type]}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="muted">خط استقرار جاری:</span>
            <b>{currentLine?.name ?? "خارج از ریل / نامشخص"}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="muted">جایگاه پارک (Slot):</span>
            <b className="num">{train.slotIndex + 1}</b>
          </div>

          {canCreateManovr && train.lineId && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
              <button
                className="btn primary"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => {
                  if (currentLine) {
                    onStartStaticManovr(train, currentLine);
                  }
                }}
              >
                ⚡ ثبت مانور در محل (ثابت / بدون جابه‌جایی)
              </button>

              <button
                className="btn outline"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => onStartMoveManovr(train)}
              >
                🚀 شروع مانور جابه‌جایی (انتقال به ریل دیگر)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
