"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Icons } from "@/lib/icons";

interface Option {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: Option[];
  value: string | number;
  onChange: (val: any) => void;
  placeholder?: string;
  required?: boolean;
  name?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "-- انتخاب کنید --",
  required = false,
  name,
  style,
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // محاسبه موقعیت لیست بازشو نسبت به viewport (fixed positioning)
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 320; // حداکثر ارتفاع لیست
    // اگر فضای پایین کافی نبود، بالای دکمه نشان بده
    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      setDropdownPos({
        top: rect.top - Math.min(dropdownHeight, rect.top - 8),
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownPos({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // بستن لیست با کلیک خارج از کامپوننت
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // بررسی اینکه آیا کلیک روی لیست بازشو (که fixed است) نیست
        const target = event.target as HTMLElement;
        if (target.closest("[data-searchable-dropdown]")) return;
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // به‌روزرسانی موقعیت هنگام اسکرول یا تغییر اندازه
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleUpdate = () => updatePosition();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isOpen, updatePosition]);

  // فوکوس روی فیلد سرچ هنگام باز شدن
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, search]);

  const handleSelect = (val: string | number, optDisabled?: boolean) => {
    if (optDisabled) return;
    onChange(val);
    setSearch("");
    setIsOpen(false);
  };

  // ناوبری با کیبورد
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, filteredOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < filteredOptions.length) {
        handleSelect(filteredOptions[highlightIdx].value, filteredOptions[highlightIdx].disabled);
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0].value, filteredOptions[0].disabled);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // اسکرول به آیتم هایلایت‌شده
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option]");
      items[highlightIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        direction: "rtl",
        ...style,
      }}
    >
      {/* فیلد مخفی برای کارکرد فرم‌های استاندارد */}
      {name && <input type="hidden" name={name} value={value} required={required} />}

      {/* دکمه بازشو (شبیه‌ساز تگ Select) */}
      <div
        onClick={() => {
          if (!disabled) {
            if (!isOpen) {
              setHighlightIdx(-1);
            }
            setIsOpen(!isOpen);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: style?.padding || "8px 12px",
          border: isOpen ? "1px solid var(--accent)" : "1px solid var(--line)",
          borderRadius: "var(--r-sm)",
          backgroundColor: disabled ? "rgba(0,0,0,0.03)" : "var(--panel)",
          color: selectedOption ? "var(--ink)" : "var(--ink-soft)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: style?.fontSize || "12.5px",
          minHeight: style?.minHeight || "38px",
          boxShadow: isOpen ? "0 0 0 2px var(--accent-soft)" : "none",
          transition: "var(--transition-fluid)",
          userSelect: "none",
        }}
      >
        <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flex: 1 }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span style={{ display: "flex", alignItems: "center", opacity: 0.7, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginRight: "6px" }}>
          <Icons.CaretDown size={14} />
        </span>
      </div>

      {/* پانل بازشو — fixed position تا از overflow والدین خارج نشود */}
      {isOpen && dropdownPos && (
        <div
          data-searchable-dropdown="true"
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            backgroundColor: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)",
            zIndex: 99999,
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            maxHeight: "320px",
            direction: "rtl",
          }}
          onMouseDown={(e) => {
            // جلوگیری از بسته شدن توسط handleClickOutside
            e.stopPropagation();
          }}
        >
          {/* فیلد جستجوی سریع */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <span style={{ position: "absolute", right: "10px", color: "var(--ink-soft)", display: "flex", alignItems: "center" }}>
              <Icons.Search size={14} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="جستجو..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIdx(0);
              }}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%",
                padding: "8px 10px 8px 32px",
                fontSize: "12.5px",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-sm)",
                backgroundColor: "rgba(0,0,0,0.01)",
                outline: "none",
                color: "var(--ink)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-soft)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--line)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* تعداد نتایج */}
          <div style={{ fontSize: "10px", color: "var(--ink-faint)", padding: "0 4px", flexShrink: 0 }}>
            {filteredOptions.length} مورد {search.trim() ? `از ${options.length}` : ""}
          </div>

          {/* لیست گزینه‌ها */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1px",
            }}
          >
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--ink-faint)", fontSize: "12px" }}>
                موردی یافت نشد.
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightIdx;
                return (
                  <div
                    key={opt.value}
                    data-option="true"
                    onClick={() => handleSelect(opt.value, opt.disabled)}
                    style={{
                      padding: "8px 12px",
                      fontSize: "12.5px",
                      borderRadius: "var(--r-sm)",
                      cursor: opt.disabled ? "not-allowed" : "pointer",
                      backgroundColor: isSelected
                        ? "var(--accent)"
                        : isHighlighted
                        ? "var(--panel-2)"
                        : "transparent",
                      color: isSelected
                        ? "#ffffff"
                        : opt.disabled
                        ? "var(--ink-faint)"
                        : "var(--ink)",
                      opacity: opt.disabled ? 0.5 : 1,
                      transition: "background-color 0.1s, color 0.1s",
                      fontWeight: isSelected ? "bold" : "normal",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onMouseEnter={(e) => {
                      setHighlightIdx(idx);
                      if (!opt.disabled && !isSelected) {
                        e.currentTarget.style.backgroundColor = "var(--panel-2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!opt.disabled && !isSelected && idx !== highlightIdx) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    {isSelected && (
                      <span style={{ display: "inline-flex", flexShrink: 0 }}>
                        <Icons.Check size={12} weight="bold" />
                      </span>
                    )}
                    {opt.label}
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
