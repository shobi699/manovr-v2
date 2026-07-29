"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DataTable from "@/components/DataTable";
import ManovrRowActions from "./ManovrRowActions";
import { ManovrType, ManovrStatus, ConfirmationStatus } from "@/lib/enums";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import type { ListParams } from "@/lib/list-query";

interface LookupValue {
  code: number;
  label: string;
  color: string | null;
}

interface ManovrsTableClientProps {
  manovrs: any[];
  totalRows: number;
  params: ListParams;
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

export default function ManovrsTableClient({
  manovrs,
  totalRows,
  params,
  canEdit,
  canConfirm,
  canDelete,
  manovrTypes,
  manovrStatuses,
  confirmationStatuses,
}: ManovrsTableClientProps) {
  useLiveRefresh(["manovr_changed"]);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showFilters, setShowFilters] = useState(false);

  // وضعیت فیلترها از URL مقداردهی می‌شوند
  const [filterTrainCode, setFilterTrainCode] = useState(searchParams.get("trainCode") || "");
  const [filterType, setFilterType] = useState(searchParams.get("typeFilter") || "");
  const [filterSourceLine, setFilterSourceLine] = useState(searchParams.get("srcLine") || "");
  const [filterDestLine, setFilterDestLine] = useState(searchParams.get("destLine") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("statusFilter") || "");
  const [filterConfirmation, setFilterConfirmation] = useState(searchParams.get("confFilter") || "");
  const [filterRahbar, setFilterRahbar] = useState(searchParams.get("rahbarFilter") || "");
  const [filterCreator, setFilterCreator] = useState(searchParams.get("creatorFilter") || "");

  const updateUrl = (newParams: Record<string, string | number | null | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") {
        sp.delete(k);
      } else {
        sp.set(k, String(v));
      }
    });
    router.push(`/manovrs?${sp.toString()}`);
  };

  // اعمال فیلترهای متنی به صورت Debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterTrainCode !== (searchParams.get("trainCode") || "")) {
        updateUrl({ trainCode: filterTrainCode, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filterTrainCode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterSourceLine !== (searchParams.get("srcLine") || "")) {
        updateUrl({ srcLine: filterSourceLine, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filterSourceLine]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterDestLine !== (searchParams.get("destLine") || "")) {
        updateUrl({ destLine: filterDestLine, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filterDestLine]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterRahbar !== (searchParams.get("rahbarFilter") || "")) {
        updateUrl({ rahbarFilter: filterRahbar, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filterRahbar]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterCreator !== (searchParams.get("creatorFilter") || "")) {
        updateUrl({ creatorFilter: filterCreator, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filterCreator]);

  const handleClearFilters = () => {
    setFilterTrainCode("");
    setFilterType("");
    setFilterSourceLine("");
    setFilterDestLine("");
    setFilterStatus("");
    setFilterConfirmation("");
    setFilterRahbar("");
    setFilterCreator("");
    router.push("/manovrs");
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
    { key: "train", label: "قطار", sortable: false, render: (m: any) => <span className="num">{m.train?.code ?? "—"}</span> },
    {
      key: "rahbar",
      label: "راهبر ۱",
      sortable: false,
      render: (m: any) => (m.rahbar1 ? `${m.rahbar1.firstName} ${m.rahbar1.lastName}` : "—"),
    },
    {
      key: "creator",
      label: "کاربر ثبت‌کننده",
      sortable: false,
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
    filterCreator ||
    params.search;

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
            <span className="pill p-mut">{totalRows} رکورد</span>
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterType(val);
                    updateUrl({ typeFilter: val, page: 1 });
                  }}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterStatus(val);
                    updateUrl({ statusFilter: val, page: 1 });
                  }}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterConfirmation(val);
                    updateUrl({ confFilter: val, page: 1 });
                  }}
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
                تعداد نتایج یافت‌شده: <b>{totalRows}</b> رکورد
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
            data={manovrs}
            searchPlaceholder="جستجو بر اساس قطار یا توضیحات..."
            searchFields={["id"]}
            server={{
              page: params.page,
              pageSize: params.pageSize,
              totalRows,
              onPageChange: (p) => updateUrl({ page: p }),
              onPageSizeChange: (ps) => updateUrl({ pageSize: ps, page: 1 }),
              search: params.search,
              onSearchChange: (s) => updateUrl({ search: s, page: 1 }),
              sortCol: params.sortField,
              sortDir: params.sortDir,
              onSortChange: (col, dir) => updateUrl({ sort: col, dir }),
            }}
          />
        </div>
      </div>
    </div>
  );
}
