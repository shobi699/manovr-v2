"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  getYear,
  getMonth,
  getDate,
  getDaysInMonth,
  startOfMonth,
  getDay,
  setYear,
  setMonth,
  setDate as setJalaliDate,
} from "date-fns-jalali";

const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند"
];

const WEEK_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

interface JalaliDateTimePickerProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (isoString: string) => void;
  required?: boolean;
}

export default function JalaliDateTimePicker({
  name,
  value,
  defaultValue,
  onChange,
  required
}: JalaliDateTimePickerProps) {
  // Parse initial date
  const parseInitialDate = () => {
    const raw = value || defaultValue;
    if (raw) {
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  };

  const [selectedDate, setSelectedDate] = useState<Date>(parseInitialDate());
  const [viewDate, setViewDate] = useState<Date>(parseInitialDate());
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state if value prop changes
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate((prev) => (prev.getTime() === parsed.getTime() ? prev : parsed));
        setViewDate((prev) => (prev.getTime() === parsed.getTime() ? prev : parsed));
      }
    }
  }, [value]);

  // Click away listener
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handler);
    }
    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [isOpen]);

  const jalaliYear = getYear(selectedDate);
  const jalaliMonth = getMonth(selectedDate);
  const jalaliDay = getDate(selectedDate);
  const hours = selectedDate.getHours();
  const minutes = selectedDate.getMinutes();

  const viewYear = getYear(viewDate);
  const viewMonth = getMonth(viewDate);

  // Grid math
  const firstOfMonth = startOfMonth(viewDate);
  const startDOW = getDay(firstOfMonth);
  const offset = (startDOW + 1) % 7; // Saturday is 0
  const totalDays = getDaysInMonth(viewDate);

  const daysGrid: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1)
  ];

  const updateDate = (newDateVal: Date) => {
    setSelectedDate(newDateVal);
    if (onChange) {
      onChange(newDateVal.toISOString());
    }
  };

  const handleDaySelect = (day: number) => {
    let d = new Date(selectedDate);
    d = setYear(d, viewYear);
    d = setMonth(d, viewMonth);
    d = setJalaliDate(d, day);
    updateDate(d);
  };

  const handleMonthChange = (monthIdx: number) => {
    let d = new Date(viewDate);
    d = setMonth(d, monthIdx);
    setViewDate(d);
  };

  const handleYearChange = (yearVal: number) => {
    let d = new Date(viewDate);
    d = setYear(d, yearVal);
    setViewDate(d);
  };

  const handleHourChange = (h: number) => {
    const d = new Date(selectedDate);
    d.setHours(h);
    updateDate(d);
  };

  const handleMinuteChange = (m: number) => {
    const d = new Date(selectedDate);
    d.setMinutes(m);
    updateDate(d);
  };

  const handleTodayClick = () => {
    const now = new Date();
    setSelectedDate(now);
    setViewDate(now);
    if (onChange) {
      onChange(now.toISOString());
    }
  };

  // Generate Year Options (1395 to 1415)
  const yearOptions: number[] = [];
  for (let y = 1395; y <= 1415; y++) {
    yearOptions.push(y);
  }

  // Format display text
  const yStr = jalaliYear;
  const mStr = String(jalaliMonth + 1).padStart(2, "0");
  const dStr = String(jalaliDay).padStart(2, "0");
  const hrStr = String(hours).padStart(2, "0");
  const minStr = String(minutes).padStart(2, "0");
  const displayText = `${yStr}/${mStr}/${dStr}   ${hrStr}:${minStr}`;

  return (
    <div ref={containerRef} className="relative w-full" style={{ direction: "rtl" }}>
      {/* Hidden input to pass value in form submissions */}
      <input type="hidden" name={name} value={selectedDate.toISOString()} />

      <div
        className="input flex items-center justify-between cursor-pointer"
        style={{
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none"
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="num" style={{ letterSpacing: "0.5px" }}>{displayText}</span>
        <svg
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          className="muted"
          style={{ opacity: 0.6 }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 p-3 rounded-lg shadow-xl border border-line z-50 text-white"
          style={{
            backgroundColor: "rgba(15,23,42,0.95)",
            backdropFilter: "blur(12px)",
            width: "300px",
            borderColor: "var(--line)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
            zIndex: 1000
          }}
        >
          {/* Calendar Header: Year & Month Selectors */}
          <div className="flex gap-2 mb-3" style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <select
              className="input sm"
              style={{ flex: 1, padding: "4px 8px", fontSize: "12px", backgroundColor: "var(--panel-2)", color: "#fff", border: "1px solid var(--line)", borderRadius: "4px" }}
              value={viewMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
            >
              {JALALI_MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>

            <select
              className="input sm"
              style={{ flex: 1, padding: "4px 8px", fontSize: "12px", backgroundColor: "var(--panel-2)", color: "#fff", border: "1px solid var(--line)", borderRadius: "4px" }}
              value={viewYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Weekday Headers */}
          <div
            className="grid grid-cols-7 text-center text-xs font-semibold mb-2"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              textAlign: "center",
              fontSize: "11px",
              fontWeight: "600",
              marginBottom: "8px",
              opacity: 0.6
            }}
          >
            {WEEK_DAYS.map((day, idx) => (
              <div key={idx} className={idx === 6 ? "text-red-400" : ""}>{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div
            className="grid grid-cols-7 gap-1 text-center text-sm"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "4px",
              textAlign: "center",
              fontSize: "13px"
            }}
          >
            {daysGrid.map((day, idx) => {
              if (day === null) {
                return <div key={idx} />;
              }

              const isSelected =
                viewYear === jalaliYear &&
                viewMonth === jalaliMonth &&
                day === jalaliDay;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDaySelect(day)}
                  className={`py-1 rounded text-center transition-all ${
                    isSelected
                      ? "bg-amber-500 text-slate-900 font-bold"
                      : "hover:bg-slate-700 hover:text-white"
                  }`}
                  style={{
                    padding: "4px 0",
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "var(--accent)" : "transparent",
                    color: isSelected ? "var(--bg)" : "#fff",
                    fontWeight: isSelected ? "bold" : "normal"
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="my-3 border-t border-line" style={{ margin: "12px 0", borderTop: "1px solid var(--line)" }} />

          {/* Time Picker */}
          <div className="flex items-center justify-between gap-2" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ fontSize: "12px", opacity: 0.8 }}>ساعت اجرای مانور:</span>
            <div className="flex items-center gap-1" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {/* Minutes Select */}
              <select
                className="input sm text-center"
                style={{ width: "60px", padding: "2px 4px", fontSize: "12px", backgroundColor: "var(--panel-2)", color: "#fff", border: "1px solid var(--line)", borderRadius: "4px" }}
                value={minutes}
                onChange={(e) => handleMinuteChange(Number(e.target.value))}
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                ))}
              </select>
              <span>:</span>
              {/* Hours Select */}
              <select
                className="input sm text-center"
                style={{ width: "60px", padding: "2px 4px", fontSize: "12px", backgroundColor: "var(--panel-2)", color: "#fff", border: "1px solid var(--line)", borderRadius: "4px" }}
                value={hours}
                onChange={(e) => handleHourChange(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-between mt-3 gap-2" style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", gap: "8px" }}>
            <button
              type="button"
              onClick={handleTodayClick}
              className="btn sm"
              style={{ flex: 1, padding: "4px 8px", fontSize: "11px", justifyContent: "center" }}
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn sm primary"
              style={{ flex: 1, padding: "4px 8px", fontSize: "11px", justifyContent: "center" }}
            >
              تایید و بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
