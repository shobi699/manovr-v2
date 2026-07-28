"use client";

import React, { useState, useEffect } from "react";
import { saveSetting } from "@/app/actions/settings";
import { Icons } from "@/lib/icons";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

export interface BulkAction<T> {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "danger" | "accent" | "warning" | "default" | "success" | "secondary";
  onClick: (selectedItems: T[], clearSelection: () => void) => void | Promise<void>;
}

interface DataTableProps<T> {
  tableName: string;
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  initialHiddenColumns?: string[];
  getItemKey?: (item: T) => string | number;
  enableSelection?: boolean;
  bulkActions?: BulkAction<T>[];
}

export default function DataTable<T extends Record<string, any>>({
  tableName,
  columns,
  data,
  searchPlaceholder = "جستجو...",
  searchFields = [],
  initialHiddenColumns = [],
  getItemKey,
  enableSelection = false,
  bulkActions = [],
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hiddenCols, setHiddenCols] = useState<string[]>(initialHiddenColumns);
  const [showConfig, setShowConfig] = useState(false);

  // وضعیت انتخاب ردیف‌ها برای کارهای گروهی
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const getKey = (item: T): string | number => {
    if (getItemKey) return getItemKey(item);
    return item.id ?? item.code ?? JSON.stringify(item);
  };

  // لود ستون‌های مخفی از لوکال استوریج یا تنظیمات برای لود سریع‌تر (به عنوان fallback)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`dt.hidden.${tableName}`);
      if (saved) {
        try {
          setHiddenCols(JSON.parse(saved));
        } catch {}
      }
    }
  }, [tableName]);

  const handleToggleCol = async (colKey: string) => {
    const isHidden = hiddenCols.includes(colKey);
    const updated = isHidden
      ? hiddenCols.filter((k) => k !== colKey)
      : [...hiddenCols, colKey];

    setHiddenCols(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(`dt.hidden.${tableName}`, JSON.stringify(updated));
    }
    // ذخیره در سرور به عنوان AppSetting
    await saveSetting(`table.hidden.${tableName}`, updated);
  };

  const handleSort = (colKey: string) => {
    if (sortCol === colKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colKey);
      setSortDir("asc");
    }
  };

  // فیلتر داده‌ها
  const filtered = data.filter((item) => {
    if (!search || searchFields.length === 0) return true;
    const term = search.toLowerCase();
    return searchFields.some((field) => {
      const val = item[field];
      if (val === undefined || val === null) return false;
      return String(val).toLowerCase().includes(term);
    });
  });

  // مرتب‌سازی
  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0;
    let valA = a[sortCol];
    let valB = b[sortCol];

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (typeof valA === "string") {
      return sortDir === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    return sortDir === "asc"
      ? (valA > valB ? 1 : -1)
      : (valA < valB ? 1 : -1);
  });

  // صفحه‌بندی
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortCol, sortDir, pageSize]);

  const hasSelection = enableSelection || bulkActions.length > 0;

  const selectedItems = React.useMemo(() => {
    return sorted.filter((item) => selectedKeys.has(getKey(item)));
  }, [sorted, selectedKeys]);

  const allPaginatedSelected = React.useMemo(() => {
    if (paginated.length === 0) return false;
    return paginated.every((item) => selectedKeys.has(getKey(item)));
  }, [paginated, selectedKeys]);

  const toggleSelectAllPaginated = () => {
    const newKeys = new Set(selectedKeys);
    if (allPaginatedSelected) {
      paginated.forEach((item) => newKeys.delete(getKey(item)));
    } else {
      paginated.forEach((item) => newKeys.add(getKey(item)));
    }
    setSelectedKeys(newKeys);
  };

  const selectAllFiltered = () => {
    const newKeys = new Set<string | number>();
    sorted.forEach((item) => newKeys.add(getKey(item)));
    setSelectedKeys(newKeys);
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  const activeColumns = columns.filter((col) => !hiddenCols.includes(col.key));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* هدر کنترل جدول */}
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        {searchFields.length > 0 ? (
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="input search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: "300px" }}
          />
        ) : (
          <div />
        )}

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* انتخابگر تعداد صفحات */}
          <select
            className="input"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{ width: "90px", padding: "6px 8px", fontSize: "12px" }}
          >
            <option value="5">۵ ردیف</option>
            <option value="10">۱۰ ردیف</option>
            <option value="20">۲۰ ردیف</option>
            <option value="50">۵۰ ردیف</option>
          </select>

          {/* شخصی‌سازی ستون‌ها */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="btn sm"
              onClick={() => setShowConfig(!showConfig)}
              style={{ padding: "8px 12px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Icons.Lines size={14} weight="bold" />
              <span>ستون‌ها</span>
            </button>
            {showConfig && (
              <div
                style={{
                  position: "absolute",
                  top: "38px",
                  left: 0,
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "10px",
                  zIndex: 10,
                  width: "180px",
                  boxShadow: "var(--sh-2)",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px", borderBottom: "1px solid var(--line)", paddingBottom: "4px" }}>
                  انتخاب ستون‌های نمایشی
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {columns.map((col) => (
                    <label
                      key={col.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenCols.includes(col.key)}
                        onChange={() => handleToggleCol(col.key)}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* نوار اقدامات دسته‌جمعی و کارهای گروهی */}
      {hasSelection && selectedKeys.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "8px",
            backdropFilter: "blur(8px)",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              className="pill"
              style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: "bold", fontSize: "12px", padding: "4px 10px" }}
            >
              ⚡ {selectedKeys.size} مورد انتخاب گردید
            </span>

            {selectedKeys.size < sorted.length && (
              <button
                type="button"
                className="btn sm"
                style={{ fontSize: "11.5px", padding: "4px 8px" }}
                onClick={selectAllFiltered}
              >
                انتخاب تمام {sorted.length} مورد
              </button>
            )}

            <button
              type="button"
              className="btn sm"
              style={{ fontSize: "11.5px", padding: "4px 8px", color: "var(--ink-soft)" }}
              onClick={clearSelection}
            >
              ❌ لغو انتخاب
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--ink-soft)" }}>کارهای گروهی:</span>
            {bulkActions.map((action) => (
              <button
                key={action.key}
                type="button"
                disabled={isProcessingBulk}
                className={`btn sm ${action.variant === "danger" ? "danger" : action.variant === "accent" ? "accent" : action.variant === "warning" ? "warn" : ""}`}
                style={{
                  fontSize: "12px",
                  padding: "5px 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onClick={async () => {
                  setIsProcessingBulk(true);
                  try {
                    await action.onClick(selectedItems, clearSelection);
                  } finally {
                    setIsProcessingBulk(false);
                  }
                }}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* بخش جدول داده */}
      <div className="card tbl-wrap">
        <table className="data">
          <thead>
            <tr>
              {hasSelection && (
                <th style={{ width: "40px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={allPaginatedSelected}
                    onChange={toggleSelectAllPaginated}
                    style={{ accentColor: "var(--accent)", cursor: "pointer", width: "16px", height: "16px" }}
                    title="انتخاب همه ردیف‌های این صفحه"
                  />
                </th>
              )}
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    cursor: col.sortable ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {col.label}
                    {col.sortable && sortCol === col.key && (
                      <span style={{ fontSize: "10px" }}>{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + (hasSelection ? 1 : 0)} className="empty">
                  داده‌ای جهت نمایش یافت نشد.
                </td>
              </tr>
            ) : (
              paginated.map((item, idx) => {
                const itemKey = getKey(item);
                const isSelected = selectedKeys.has(itemKey);
                return (
                  <tr key={itemKey ?? idx} style={{ backgroundColor: isSelected ? "rgba(59, 130, 246, 0.08)" : undefined }}>
                    {hasSelection && (
                      <td style={{ width: "40px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const newKeys = new Set(selectedKeys);
                            if (newKeys.has(itemKey)) newKeys.delete(itemKey);
                            else newKeys.add(itemKey);
                            setSelectedKeys(newKeys);
                          }}
                          style={{ accentColor: "var(--accent)", cursor: "pointer", width: "16px", height: "16px" }}
                        />
                      </td>
                    )}
                    {activeColumns.map((col) => (
                      <td key={col.key}>
                        {col.render ? col.render(item) : item[col.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* بخش صفحه‌بندی */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
          <div className="muted" style={{ fontSize: "12px" }}>
            نمایش {(currentPage - 1) * pageSize + 1} تا {Math.min(currentPage * pageSize, sorted.length)} از {sorted.length} ردیف
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              className="btn sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              قبلی
            </button>
            <span style={{ alignSelf: "center", fontSize: "13px", padding: "0 10px" }} className="num">
              صفحه {currentPage} از {totalPages}
            </span>
            <button
              className="btn sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              بعدی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
