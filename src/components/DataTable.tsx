"use client";

import React, { useState, useEffect } from "react";
import { saveSetting } from "@/app/actions/settings";
import { Icons } from "@/lib/icons";
import { PAGE_SIZE_OPTIONS } from "@/lib/list-query";

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

export interface ServerPagination {
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sortCol: string | null;
  sortDir: "asc" | "desc";
  onSortChange: (col: string, dir: "asc" | "desc") => void;
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
  /** در صورت وجود، فیلتر/مرتب‌سازی/صفحه‌بندی سمت سرور انجام می‌شود */
  server?: ServerPagination;
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
  server,
}: DataTableProps<T>) {
  const isServerMode = server !== undefined;

  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`dt.hidden.${tableName}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return initialHiddenColumns;
  });
  const [showConfig, setShowConfig] = useState(false);

  // وضعیت‌های فعال بستگی به حالت کلاینت یا سرور دارند
  const activeSearch = isServerMode ? server.search : search;
  const activeSortCol = isServerMode ? server.sortCol : sortCol;
  const activeSortDir = isServerMode ? server.sortDir : sortDir;
  const activePage = isServerMode ? server.page : currentPage;
  const activePageSize = isServerMode ? server.pageSize : pageSize;

  // وضعیت انتخاب ردیف‌ها برای کارهای گروهی
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const getKey = React.useCallback((item: T): string | number => {
    if (getItemKey) return getItemKey(item);
    return item.id ?? item.code ?? JSON.stringify(item);
  }, [getItemKey]);

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
    if (isServerMode) {
      const nextDir = activeSortCol === colKey && activeSortDir === "asc" ? "desc" : "asc";
      server.onSortChange(colKey, nextDir);
    } else {
      if (sortCol === colKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(colKey);
        setSortDir("asc");
      }
    }
  };

  // فیلتر داده‌ها
  const filtered = isServerMode
    ? data
    : data.filter((item) => {
        if (!search || searchFields.length === 0) return true;
        const term = search.toLowerCase();
        return searchFields.some((field) => {
          const val = item[field];
          if (val === undefined || val === null) return false;
          return String(val).toLowerCase().includes(term);
        });
      });

  // مرتب‌سازی
  const sorted = isServerMode
    ? data
    : [...filtered].sort((a, b) => {
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
  const totalRows = isServerMode ? server.totalRows : sorted.length;
  const totalPages = isServerMode
    ? Math.max(1, Math.ceil(server.totalRows / server.pageSize))
    : Math.max(1, Math.ceil(sorted.length / pageSize));

  const paginated = isServerMode
    ? data
    : sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (!isServerMode) {
      setCurrentPage(1);
    }
  }, [search, sortCol, sortDir, pageSize, isServerMode]);

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
        {searchFields.length > 0 || isServerMode ? (
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="input search"
            value={activeSearch}
            onChange={(e) => {
              if (isServerMode) {
                server.onSearchChange(e.target.value);
              } else {
                setSearch(e.target.value);
              }
            }}
            style={{ maxWidth: "300px" }}
          />
        ) : (
          <div />
        )}

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* انتخابگر تعداد صفحات */}
          <select
            className="input"
            value={activePageSize}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (isServerMode) {
                server.onPageSizeChange(val);
              } else {
                setPageSize(val);
              }
            }}
            style={{ width: "95px", padding: "6px 8px", fontSize: "12px" }}
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt} ردیف
              </option>
            ))}
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
                className="card"
                style={{
                  position: "absolute",
                  left: 0,
                  top: "100%",
                  marginTop: "6px",
                  zIndex: 50,
                  width: "220px",
                  padding: "10px",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px" }}>
                  نمایش / مخفی‌سازی ستون‌ها
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "200px", overflowY: "auto" }}>
                  {columns.map((col) => (
                    <label
                      key={col.key}
                      style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenCols.includes(col.key)}
                        onChange={() => handleToggleCol(col.key)}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* بار کارهای گروهی (Bulk Actions) */}
      {hasSelection && selectedKeys.size > 0 && (
        <div
          className="card"
          style={{
            padding: "8px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--accent)",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              className="pill"
              style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: "bold", fontSize: "12px", padding: "4px 10px" }}
            >
              ⚡ {selectedKeys.size} مورد انتخاب گردید
            </span>

            {!isServerMode && selectedKeys.size < sorted.length && (
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
                    {col.sortable && activeSortCol === col.key && (
                      <span style={{ fontSize: "10px" }}>{activeSortDir === "asc" ? "▲" : "▼"}</span>
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
      {(totalPages > 1 || (isServerMode && totalRows > 0)) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
          <div className="muted" style={{ fontSize: "12px" }}>
            نمایش {(activePage - 1) * activePageSize + (totalRows > 0 ? 1 : 0)} تا {Math.min(activePage * activePageSize, totalRows)} از {totalRows} ردیف
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              className="btn sm"
              disabled={activePage <= 1}
              onClick={() => {
                if (isServerMode) {
                  server.onPageChange(activePage - 1);
                } else {
                  setCurrentPage((p) => p - 1);
                }
              }}
            >
              قبلی
            </button>
            <span style={{ alignSelf: "center", fontSize: "13px", padding: "0 10px" }} className="num">
              صفحه {activePage} از {totalPages}
            </span>
            <button
              className="btn sm"
              disabled={activePage >= totalPages}
              onClick={() => {
                if (isServerMode) {
                  server.onPageChange(activePage + 1);
                } else {
                  setCurrentPage((p) => p + 1);
                }
              }}
            >
              بعدی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
