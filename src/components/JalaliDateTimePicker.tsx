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

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setViewDate(parsed);
      }
    }
  }

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
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            backgroundColor: "#0f172a",
            backdropFilter: "blur(16px)",
            width: "300px",
            padding: "12px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.4)",
            zIndex: 99999,
            color: "#f8fafc",
          }}
        >
          {/* Calendar Header: Year & Month Selectors */}
          <div className="flex gap-2 mb-3" style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <select
              className="input sm"
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "12px",
                backgroundColor: "#1e293b",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "6px",
                outline: "none",
                cursor: "pointer",
              }}
              value={viewMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
            >
              {JALALI_MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx} style={{ backgroundColor: "#1e293b", color: "#ffffff", padding: "6px" }}>{name}</option>
              ))}
            </select>

            <select
              className="input sm"
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "12px",
                backgroundColor: "#1e293b",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "6px",
                outline: "none",
                cursor: "pointer",
              }}
              value={viewYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y} style={{ backgroundColor: "#1e293b", color: "#ffffff", padding: "6px" }}>{y}</option>
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
              color: "#94a3b8"
            }}
          >
            {WEEK_DAYS.map((day, idx) => (
              <div key={idx} style={{ color: idx === 6 ? "#f87171" : "#94a3b8" }}>{day}</div>
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
                  style={{
                    padding: "6px 0",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#3b82f6" : "transparent",
                    color: isSelected ? "#ffffff" : "#f8fafc",
                    fontWeight: isSelected ? "bold" : "normal",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div style={{ margin: "12px 0", borderTop: "1px solid rgba(255, 255, 255, 0.12)" }} />

          {/* Time Picker */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#cbd5e1" }}>ساعت اجرای مانور:</span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {/* Minutes Select */}
              <select
                className="input sm text-center"
                style={{ width: "60px", padding: "4px", fontSize: "12px", backgroundColor: "#1e293b", color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "6px" }}
                value={minutes}
                onChange={(e) => handleMinuteChange(Number(e.target.value))}
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m} style={{ backgroundColor: "#1e293b", color: "#ffffff" }}>{String(m).padStart(2, "0")}</option>
                ))}
              </select>
              <span style={{ color: "#94a3b8", fontWeight: "bold" }}>:</span>
              {/* Hours Select */}
              <select
                className="input sm text-center"
                style={{ width: "60px", padding: "4px", fontSize: "12px", backgroundColor: "#1e293b", color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "6px" }}
                value={hours}
                onChange={(e) => handleHourChange(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <option key={h} value={h} style={{ backgroundColor: "#1e293b", color: "#ffffff" }}>{String(h).padStart(2, "0")}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", gap: "8px" }}>
            <button
              type="button"
              onClick={handleTodayClick}
              className="btn sm"
              style={{ flex: 1, padding: "6px 8px", fontSize: "11.5px", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.08)", color: "#f8fafc", border: "1px solid rgba(255, 255, 255, 0.15)" }}
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn sm primary"
              style={{ flex: 1, padding: "6px 8px", fontSize: "11.5px", justifyContent: "center" }}
            >
              تأیید و بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
