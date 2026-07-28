"use client";

import React from "react";
import DataTable from "@/components/DataTable";
import ManovrRowActions from "./ManovrRowActions";
import { ManovrType, ManovrStatus, ConfirmationStatus } from "@/lib/enums";

interface LookupValue {
  code: number;
  label: string;
  color: string | null;
}

interface ManovrsTableClientProps {
  manovrs: any[];
  canEdit: boolean;
  canConfirm: boolean;
  canDelete: boolean;
  manovrTypes?: LookupValue[];
  manovrStatuses?: LookupValue[];
  confirmationStatuses?: LookupValue[];
}

function fmt(d: string | Date) {
  const dateObj = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    calendar: "persian",
    dateStyle: "short",
    timeStyle: "short",
  }).format(dateObj);
}

import { useLiveRefresh } from "@/hooks/useLiveRefresh";

export default function ManovrsTableClient({
  manovrs,
  canEdit,
  canConfirm,
  canDelete,
  manovrTypes,
  manovrStatuses,
  confirmationStatuses,
}: ManovrsTableClientProps) {
  useLiveRefresh(["manovr_changed"]);

  const [showFilters, setShowFilters] = React.useState(false);
  const [filterTrainCode, setFilterTrainCode] = React.useState("");
  const [filterType, setFilterType] = React.useState("");
  const [filterSourceLine, setFilterSourceLine] = React.useState("");
  const [filterDestLine, setFilterDestLine] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterConfirmation, setFilterConfirmation] = React.useState("");
  const [filterRahbar, setFilterRahbar] = React.useState("");
  const [filterCreator, setFilterCreator] = React.useState("");

  const filteredManovrs = React.useMemo(() => {
    return manovrs.filter((m) => {
      if (filterTrainCode.trim()) {
        const tCode = m.train?.code || "";
        if (!tCode.toLowerCase().includes(filterTrainCode.trim().toLowerCase())) return false;
      }
      if (filterType !== "") {
        if (Number(m.type) !== Number(filterType)) return false;
      }
      if (filterSourceLine.trim()) {
        const sName = m.sourceLine?.name || "";
        if (!sName.toLowerCase().includes(filterSourceLine.trim().toLowerCase())) return false;
      }
      if (filterDestLine.trim()) {
        const dName = m.destinationLine?.name || "";
        if (!dName.toLowerCase().includes(filterDestLine.trim().toLowerCase())) return false;
      }
      if (filterStatus !== "") {
        if (Number(m.status) !== Number(filterStatus)) return false;
      }
      if (filterConfirmation !== "") {
        if (Number(m.confirmationStatus) !== Number(filterConfirmation)) return false;
      }
      if (filterRahbar.trim()) {
        const rName = m.rahbar1 ? `${m.rahbar1.firstName} ${m.rahbar1.lastName}` : "";
        if (!rName.toLowerCase().includes(filterRahbar.trim().toLowerCase())) return false;
      }
      if (filterCreator.trim()) {
        const cName = m.creator ? `${m.creator.firstName} ${m.creator.lastName}` : "سیستم";
        if (!cName.toLowerCase().includes(filterCreator.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [
    manovrs,
    filterTrainCode,
    filterType,
    filterSourceLine,
    filterDestLine,
    filterStatus,
    filterConfirmation,
    filterRahbar,
    filterCreator,
  ]);

  const handleClearFilters = () => {
    setFilterTrainCode("");
    setFilterType("");
    setFilterSourceLine("");
    setFilterDestLine("");
    setFilterStatus("");
    setFilterConfirmation("");
    setFilterRahbar("");
    setFilterCreator("");
  };

  const statusPill = (s: number) =>
    s === 1 ? "p-warn" : s === 2 ? "p-good" : "p-crit";
  const confPill = (c: number) =>
    c === 1 ? "p-rail" : c === 2 ? "p-crit" : "p-mut";

  const getManovrTypeLabel = (code: number) => {
    return manovrTypes?.find((v) => v.code === code)?.label || ManovrType[code] || `مانور نوع ${code}`;
  };

  const getManovrStatusLabel = (code: number) => {
    return manovrStatuses?.find((v) => v.code === code)?.label || ManovrStatus[code] || `وضعیت ${code}`;
  };

  const getConfirmationStatusLabel = (code: number) => {
    return confirmationStatuses?.find((v) => v.code === code)?.label || ConfirmationStatus[code] || `نامشخص`;
  };

  const columns = [
    { key: "id", label: "کد مانور", sortable: true, render: (m: any) => <span className="num">{m.id}</span> },
    { key: "type", label: "نوع مانور", sortable: true, render: (m: any) => getManovrTypeLabel(m.type) },
    {
      key: "route",
      label: "مسیر (مبدأ ← مقصد)",
      render: (m: any) => (
        <span>
          <span className="muted">{m.sourceLine?.name ?? "—"}</span>
          {" ← "}
          <b>{m.destinationLine?.name ?? "—"}</b>
        </span>
      ),
    },
    { key: "train", label: "قطار", sortable: true, render: (m: any) => <span className="num">{m.train?.code ?? "—"}</span> },
    {
      key: "rahbar",
      label: "راهبر ۱",
      sortable: true,
      render: (m: any) => (m.rahbar1 ? `${m.rahbar1.firstName} ${m.rahbar1.lastName}` : "—"),
    },
    {
      key: "creator",
      label: "کاربر ثبت‌کننده",
      sortable: true,
      render: (m: any) => (m.creator ? `${m.creator.firstName} ${m.creator.lastName}` : "سیستم"),
    },
    { key: "executionTime", label: "زمان اجرا", sortable: true, render: (m: any) => <span className="num" style={{ fontWeight: "bold" }}>{fmt(m.executionTime || m.createdAt)}</span> },
    { key: "createdAt", label: "زمان ثبت سند", sortable: true, render: (m: any) => <span className="num muted">{fmt(m.createdAt)}</span> },
    {
      key: "status",
      label: "وضعیت اجرا",
      sortable: true,
      render: (m: any) => (
        <span className={`pill ${statusPill(m.status)}`}>
          {getManovrStatusLabel(m.status)}
        </span>
      ),
    },
    {
      key: "confirmation",
      label: "تأییدیه",
      sortable: true,
      render: (m: any) => (
        <span className={`pill ${confPill(m.confirmationStatus)}`}>
          {getConfirmationStatusLabel(m.confirmationStatus)}
        </span>
      ),
    },
    ...((canEdit || canConfirm || canDelete)
      ? [
          {
            key: "actions",
            label: "عملیات",
            render: (m: any) => (
              <ManovrRowActions
                id={m.id}
                status={m.status}
                confirmation={m.confirmationStatus}
                canEdit={canEdit}
                canConfirm={canConfirm}
                canDelete={canDelete}
              />
            ),
          },
        ]
      : []),
  ];

  const hasAnyFilter =
    filterTrainCode ||
    filterType ||
    filterSourceLine ||
    filterDestLine ||
    filterStatus ||
    filterConfirmation ||
    filterRahbar ||
    filterCreator;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="card" style={{ padding: "16px" }}>
        <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
          <h2>فهرست مانورهای پایانه</h2>
          <span className="spacer" />
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn sm ${hasAnyFilter ? "primary" : "secondary"}`}
              style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold" }}
            >
              <span>🔍 فیلترهای پیشرفته</span>
              {hasAnyFilter && (
                <span className="pill p-warn" style={{ padding: "1px 6px", fontSize: "10px" }}>فعال</span>
              )}
            </button>
            <span className="pill p-mut">{manovrs.length} رکورد</span>
          </div>
        </div>

        {showFilters && (
          <div
            style={{
              padding: "16px 12px",
              backgroundColor: "var(--panel-2)",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "10px",
              }}
            >
              {/* ۱. کد قطار */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>شماره قطار</span>
                <input
                  type="text"
                  className="input sm"
                  style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                  value={filterTrainCode}
                  onChange={(e) => setFilterTrainCode(e.target.value)}
                  placeholder="مثال: 103"
                />
              </div>

              {/* ۲. نوع مانور */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>نوع مانور</span>
                <select
                  className="input sm"
                  style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">همه انواع</option>
                  {manovrTypes?.map((t) => (
                    <option key={t.code} value={t.code}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* ۳. ریل مبدأ */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>خط ریل مبدأ</span>
                <input
                  type="text"
                  className="input sm"
                  style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                  value={filterSourceLine}
                  onChange={(e) => setFilterSourceLine(e.target.value)}
                  placeholder="مثال: پارکینگ شمالی 1"
                />
              </div>

              {/* ۴. ریل مقصد */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>خط ریل مقصد</span>
                <input
                  type="text"
                  className="input sm"
                  style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                  value={filterDestLine}
                  onChange={(e) => setFilterDestLine(e.target.value)}
                  placeholder="مثال: خط اصلی"
                />
              </div>

              {/* ۵. وضعیت اجرا */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>وضعیت اجرا</span>
                <select
                  className="input sm"
                  style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">همه وضعیت‌ها</option>
                  {manovrStatuses?.map((s) => (
                    <option key={s.code} value={s.code}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* ۶. وضعیت تأییدیه */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>تأییدیه</span>
                <select
                  className="input sm"
                  style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                  value={filterConfirmation}
                  onChange={(e) => setFilterConfirmation(e.target.value)}
                >
                  <option value="">همه تأییدیه‌ها</option>
                  {confirmationStatuses?.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* ۷. راهبر مسئول */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>راهبر مسئول</span>
                <input
                  type="text"
                  className="input sm"
                  style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                  value={filterRahbar}
                  onChange={(e) => setFilterRahbar(e.target.value)}
                  placeholder="مثال: علی"
                />
              </div>

              {/* ۸. کاربر ثبت‌کننده */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--ink-soft)" }}>کاربر ثبت‌کننده</span>
                <input
                  type="text"
                  className="input sm"
                  style={{ height: "30px", fontSize: "11px", padding: "4px 8px" }}
                  value={filterCreator}
                  onChange={(e) => setFilterCreator(e.target.value)}
                  placeholder="مثال: محمد"
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
              <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
                تعداد نتایج فیلتر شده: <b>{filteredManovrs.length}</b> از {manovrs.length} رکورد
              </span>
              {hasAnyFilter && (
                <button
                  className="btn sm danger"
                  onClick={handleClearFilters}
                  style={{ padding: "4px 10px", height: "28px", fontSize: "11px" }}
                >
                  🧹 پاک کردن فیلترها
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: "14px" }}>
          <DataTable
            tableName="manovrs"
            columns={columns}
            data={filteredManovrs}
            searchPlaceholder="جستجو بر اساس قطار، نوع یا خط..."
            searchFields={["id"]}
          />
        </div>
      </div>
    </div>
  );
}
