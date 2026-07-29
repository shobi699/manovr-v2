"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // بستن لیست با کلیک خارج از کامپوننت
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        onClick={() => !disabled && setIsOpen(!isOpen)}
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
        <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span style={{ display: "flex", alignItems: "center", opacity: 0.7, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <Icons.CaretDown size={14} />
        </span>
      </div>

      {/* پانل بازشو حاوی فیلد جستجو و لیست نتایج */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "42px",
            right: 0,
            left: 0,
            backgroundColor: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--sh-3)",
            zIndex: 9999,
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* فیلد جستجوی سریع */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", right: "10px", color: "var(--ink-soft)", display: "flex", alignItems: "center" }}>
              <Icons.Search size={14} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="جستجو..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px 6px 30px",
                fontSize: "12px",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-sm)",
                backgroundColor: "rgba(0,0,0,0.01)",
                outline: "none",
                color: "var(--ink)",
              }}
              onKeyDown={(e) => {
                // جلوگیری از ارسال فرم با زدن Enter در فیلد سرچ
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filteredOptions.length > 0) {
                    handleSelect(filteredOptions[0].value, filteredOptions[0].disabled);
                  }
                }
              }}
            />
          </div>

          {/* لیست گزینه‌ها */}
          <div
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "12px", textAlign: "center", color: "var(--ink-faint)", fontSize: "12px" }}>
                موردی یافت نشد.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value, opt.disabled)}
                    style={{
                      padding: "8px 10px",
                      fontSize: "12px",
                      borderRadius: "var(--r-sm)",
                      cursor: opt.disabled ? "not-allowed" : "pointer",
                      backgroundColor: isSelected
                        ? "var(--accent)"
                        : "transparent",
                      color: isSelected
                        ? "#ffffff"
                        : opt.disabled
                        ? "var(--ink-faint)"
                        : "var(--ink)",
                      opacity: opt.disabled ? 0.5 : 1,
                      transition: "background-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!opt.disabled && !isSelected) {
                        e.currentTarget.style.backgroundColor = "var(--panel-2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!opt.disabled && !isSelected) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
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
