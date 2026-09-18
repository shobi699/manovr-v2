"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";

interface TrainItem {
  id: number;
  code: string;
  type?: number;
  status?: number;
}

interface TrainSearchableComboboxProps {
  trains: TrainItem[];
  selectedTrainId: number | "all";
  onSelect: (trainId: number | "all") => void;
}

export default function TrainSearchableCombobox({
  trains,
  selectedTrainId,
  onSelect,
}: TrainSearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // بستن منو با کلیک بیرون
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedTrain = useMemo(() => {
    if (selectedTrainId === "all") return null;
    return trains.find((t) => t.id === selectedTrainId) || null;
  }, [trains, selectedTrainId]);

  const filteredTrains = useMemo(() => {
    if (!query.trim()) return trains;
    const q = query.trim().toLowerCase();
    return trains.filter((t) => {
      const typeStr = t.type === 0 ? "ac" : t.type === 1 ? "dc" : t.type === 2 ? "دیزل" : "";
      return t.code.toLowerCase().includes(q) || typeStr.includes(q);
    });
  }, [trains, query]);

  const getTypeBadge = (type?: number) => {
    if (type === 0) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold">AC</span>;
    if (type === 1) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">DC</span>;
    if (type === 2) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold">دیزل</span>;
    return null;
  };

  return (
    <div className="relative min-w-[240px]" ref={containerRef} dir="rtl">
      {/* دکمه / ورودی بازکننده دراپ‌داون */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-background border border-border hover:border-primary/50 rounded-xl px-3 py-2 text-sm font-medium transition-all cursor-pointer shadow-2xs select-none focus:ring-2 focus:ring-primary/40"
      >
        <div className="flex items-center gap-2 truncate">
          {selectedTrainId === "all" ? (
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <span>🚦</span>
              <span>همه ناوگان (کل قطارها)</span>
            </span>
          ) : selectedTrain ? (
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <span>🚆</span>
              <span>قطار {selectedTrain.code}</span>
              {getTypeBadge(selectedTrain.type)}
            </span>
          ) : (
            <span className="text-muted-foreground">انتخاب قطار...</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-muted-foreground me-1">
          {selectedTrainId !== "all" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect("all");
              }}
              className="p-1 hover:text-red-500 rounded-full transition-colors"
              title="پاکسازی فیلتر و انتخاب کل ناوگان"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* منوی بازشونده و فیلد جستجو */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-card border border-border/80 rounded-xl shadow-xl overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          {/* نوار جستجوی درون منو */}
          <div className="p-2 border-b border-border/60 bg-muted/30">
            <div className="relative">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی شماره قطار (مثلا 105)..."
                className="w-full bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/40 font-medium"
                onClick={(e) => e.stopPropagation()}
              />
              {query && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery("");
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* لیست گزینه‌ها */}
          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
            {/* گزینه همه ناوگان */}
            <div
              onClick={() => {
                onSelect("all");
                setIsOpen(false);
                setQuery("");
              }}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                selectedTrainId === "all"
                  ? "bg-primary text-primary-foreground font-bold"
                  : "hover:bg-muted/70 text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>🚦</span>
                <span>همه ناوگان (کل قطارها)</span>
              </span>
              <span className="text-[10px] opacity-75 font-normal">({trains.length} قطار)</span>
            </div>

            {/* قطارهای فیلترشده */}
            {filteredTrains.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                قطاری با عبارت «{query}» یافت نشد.
              </div>
            ) : (
              filteredTrains.map((t) => {
                const isSelected = selectedTrainId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      onSelect(t.id);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold"
                        : "hover:bg-muted/70 text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="opacity-75">🚆</span>
                      <span>قطار {t.code}</span>
                    </span>
                    <div>{getTypeBadge(t.type)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
