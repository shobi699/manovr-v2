"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";

interface TrainColumnFilterPopoverProps {
  columnKey: string;
  title: string;
  distinctValues: string[];
  selectedValues: Set<string>;
  onFilterChange: (newSelected: Set<string>) => void;
  sortDirection: "asc" | "desc" | null;
  onSortChange: (dir: "asc" | "desc" | null) => void;
}

export default function TrainColumnFilterPopover({
  columnKey,
  title,
  distinctValues,
  selectedValues,
  onFilterChange,
  sortDirection,
  onSortChange,
}: TrainColumnFilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set(selectedValues));
  const popoverRef = useRef<HTMLDivElement>(null);

  // همگام‌سازی هنگام باز شدن
  useEffect(() => {
    if (isOpen) {
      setTempSelected(new Set(selectedValues));
      setSearchQuery("");
    }
  }, [isOpen, selectedValues]);

  // بستن با کلیک خارج
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredValues = useMemo(() => {
    if (!searchQuery.trim()) return distinctValues;
    const q = searchQuery.trim().toLowerCase();
    return distinctValues.filter((v) => v.toLowerCase().includes(q));
  }, [distinctValues, searchQuery]);

  const isFiltered = selectedValues.size > 0 && selectedValues.size < distinctValues.length;

  const handleToggleValue = (val: string) => {
    const next = new Set(tempSelected);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    setTempSelected(next);
  };

  const handleSelectAll = () => {
    setTempSelected(new Set(distinctValues));
  };

  const handleClearAll = () => {
    setTempSelected(new Set());
  };

  const handleApply = () => {
    onFilterChange(tempSelected);
    setIsOpen(false);
  };

  const handleReset = () => {
    onFilterChange(new Set(distinctValues));
    onSortChange(null);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex items-center" ref={popoverRef} dir="rtl">
      {/* آیکون فیلتر روی سرستون */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-1 rounded-md transition-all ${
          isFiltered || sortDirection
            ? "bg-primary text-primary-foreground shadow-2xs font-bold"
            : "text-muted-foreground/70 hover:text-foreground hover:bg-muted"
        }`}
        title={`فیلتر و مرتب‌سازی ستون ${title}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={isFiltered || sortDirection ? 2.5 : 1.8}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
      </button>

      {/* پاپ‌اور فیلتر اکسل‌گونه */}
      {isOpen && (
        <div className="absolute top-full start-0 z-50 mt-1.5 w-60 bg-card border border-border rounded-xl shadow-2xl p-2.5 space-y-2 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-start font-sans">
          {/* هدر پاپ‌اور */}
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <span className="text-xs font-bold text-foreground">فیلتر: {title}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </div>

          {/* دکمه‌های مرتب‌سازی سبک اکسل */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                onSortChange(sortDirection === "asc" ? null : "asc");
                setIsOpen(false);
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                sortDirection === "asc"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted text-foreground"
              }`}
            >
              <span>↑ صعودی</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onSortChange(sortDirection === "desc" ? null : "desc");
                setIsOpen(false);
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                sortDirection === "desc"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted text-foreground"
              }`}
            >
              <span>↓ نزولی</span>
            </button>
          </div>

          {/* جستجوی مقادیر درون ستون */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در مقادیر..."
              className="w-full bg-background border border-border rounded-lg px-2 py-1 text-[11px] font-medium focus:outline-hidden focus:border-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* گزینه‌های انتخاب همه / پاکسازی */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
            <button
              type="button"
              onClick={handleSelectAll}
              className="hover:text-primary transition-colors font-medium"
            >
              انتخاب همه
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="hover:text-red-500 transition-colors font-medium"
            >
              لغو همه
            </button>
          </div>

          {/* لیست مقادیر با چک‌باکس */}
          <div className="max-h-36 overflow-y-auto space-y-1 border border-border/50 rounded-lg p-1.5 bg-background/50 text-xs">
            {filteredValues.length === 0 ? (
              <div className="py-2 text-center text-[10px] text-muted-foreground">موردی یافت نشد</div>
            ) : (
              filteredValues.map((val) => {
                const checked = tempSelected.has(val);
                return (
                  <label
                    key={val}
                    className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/70 cursor-pointer select-none text-[11px]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleValue(val)}
                      className="rounded border-border text-primary focus:ring-primary/40"
                    />
                    <span className="truncate text-foreground">{val || "— (خالی)"}</span>
                  </label>
                );
              })
            )}
          </div>

          {/* دکمه‌های تایید و اعمال */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/70">
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-1 rounded-lg hover:bg-primary/90 transition-colors shadow-2xs"
            >
              اعمال فیلتر
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-2 bg-muted text-muted-foreground hover:text-foreground text-xs font-medium py-1 rounded-lg transition-colors"
              title="بازنشانی فیلتر و مرتب‌سازی این ستون"
            >
              ریست
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
