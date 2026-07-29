"use client";

import React, { useState, useEffect } from "react";
import { saveSetting } from "@/app/actions/settings";
import { Icons } from "@/lib/icons";
import { PAGE_SIZE_OPTIONS } from "@/lib/list-query";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  getValue?: (item: T) => any;
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

  // وضعیت‌های فیلتر ستون‌ها
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<any>>>({});
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const [colSearchTerm, setColSearchTerm] = useState("");

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
        // جستجوی سراسری
        if (search && searchFields.length > 0) {
          const term = search.toLowerCase();
          const matchesGlobal = searchFields.some((field) => {
            const val = item[field];
            if (val === undefined || val === null) return false;
            return String(val).toLowerCase().includes(term);
          });
          if (!matchesGlobal) return false;
        }

        // فیلترهای ستونی
        for (const [colKey, activeValues] of Object.entries(columnFilters)) {
          if (activeValues.size === 0) continue;
          const colDef = columns.find((c) => c.key === colKey);
          let val = colDef?.getValue ? colDef.getValue(item) : item[colKey];
          if (!activeValues.has(val)) return false;
        }

        return true;
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
  }, [search, sortCol, sortDir, pageSize, isServerMode, columnFilters]);

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
                  style={{
                    position: "relative",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                    <div
                      onClick={() => col.sortable && handleSort(col.key)}
                      style={{ display: "flex", alignItems: "center", gap: "6px", cursor: col.sortable ? "pointer" : "default", flex: 1 }}
                    >
                      {col.label}
                      {col.sortable && activeSortCol === col.key && (
                        <span style={{ fontSize: "10px" }}>{activeSortDir === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                    {col.filterable && (
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          className="btn icon sm"
                          style={{
                            padding: "4px",
                            background: columnFilters[col.key]?.size > 0 ? "var(--accent-soft)" : "transparent",
                            color: columnFilters[col.key]?.size > 0 ? "var(--accent)" : "var(--ink-soft)",
                            border: "none",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openFilterCol === col.key) {
                              setOpenFilterCol(null);
                            } else {
                              setOpenFilterCol(col.key);
                              setColSearchTerm("");
                            }
                          }}
                        >
                          <Icons.Funnel size={14} weight={columnFilters[col.key]?.size > 0 ? "fill" : "regular"} />
                        </button>
                        {openFilterCol === col.key && (
                          <>
                            <div 
                              style={{ position: "fixed", inset: 0, zIndex: 99 }} 
                              onClick={(e) => { e.stopPropagation(); setOpenFilterCol(null); }} 
                            />
                            <div
                              className="card"
                              style={{
                                position: "absolute",
                                top: "100%",
                                right: 0,
                                marginTop: "4px",
                                zIndex: 100,
                                width: "220px",
                                padding: "12px",
                                boxShadow: "var(--shadow-lg)",
                                fontWeight: "normal",
                                cursor: "default",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px" }}>فیلتر {col.label}</div>
                              {col.sortable && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px", borderBottom: "1px solid var(--line-soft)", paddingBottom: "8px" }}>
                                  <button type="button" className="btn sm outline" onClick={() => handleSort(col.key)} style={{ justifyContent: "flex-start", fontSize: "11px" }}>
                                    {activeSortCol === col.key && activeSortDir === "asc" ? "▼ مرتب‌سازی نزولی" : "▲ مرتب‌سازی صعودی"}
                                  </button>
                                </div>
                              )}
                              {!isServerMode && (
                                <>
                                  <input
                                    type="text"
                                    placeholder="جستجو در مقادیر..."
                                    className="input search sm"
                                    style={{ width: "100%", marginBottom: "8px", fontSize: "11px", padding: "4px 8px" }}
                                    value={colSearchTerm}
                                    onChange={(e) => setColSearchTerm(e.target.value)}
                                  />
                                  <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                                    {(() => {
                                      const allVals = Array.from(new Set(data.map(item => col.getValue ? col.getValue(item) : item[col.key])));
                                      const filteredVals = allVals.filter(v => v !== undefined && v !== null && String(v).toLowerCase().includes(colSearchTerm.toLowerCase()));
                                      const activeSet = columnFilters[col.key] || new Set();
                                      
                                      return filteredVals.map((v, i) => (
                                        <label key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", cursor: "pointer" }}>
                                          <input
                                            type="checkbox"
                                            checked={activeSet.has(v)}
                                            onChange={(e) => {
                                              const nextSet = new Set(activeSet);
                                              if (e.target.checked) nextSet.add(v);
                                              else nextSet.delete(v);
                                              setColumnFilters(prev => ({ ...prev, [col.key]: nextSet }));
                                            }}
                                            style={{ accentColor: "var(--accent)", width: "12px", height: "12px", flexShrink: 0 }}
                                          />
                                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(v)}</span>
                                        </label>
                                      ));
                                    })()}
                                  </div>
                                  <div style={{ display: "flex", gap: "6px", justifyContent: "space-between" }}>
                                    <button
                                      type="button"
                                      className="btn sm"
                                      style={{ fontSize: "11px", padding: "2px 6px" }}
                                      onClick={() => {
                                        const allVals = new Set(data.map(item => col.getValue ? col.getValue(item) : item[col.key]).filter(v => v !== undefined && v !== null));
                                        setColumnFilters(prev => ({ ...prev, [col.key]: allVals }));
                                      }}
                                    >
                                      انتخاب همه
                                    </button>
                                    <button
                                      type="button"
                                      className="btn sm"
                                      style={{ fontSize: "11px", padding: "2px 6px", color: "var(--crit-soft)" }}
                                      onClick={() => setColumnFilters(prev => ({ ...prev, [col.key]: new Set() }))}
                                    >
                                      پاک کردن
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
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
