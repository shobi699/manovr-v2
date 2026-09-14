"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  "اسفند",
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
  required,
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
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const jalaliYear = getYear(selectedDate);
  const jalaliMonth = getMonth(selectedDate);
  const jalaliDay = getDate(selectedDate);
  const hours = selectedDate.getHours();
  const minutes = selectedDate.getMinutes();

  const viewYear = getYear(viewDate);
  const viewMonth = getMonth(viewDate);

  const today = new Date();
  const todayJalaliYear = getYear(today);
  const todayJalaliMonth = getMonth(today);
  const todayJalaliDay = getDate(today);

  // Grid math
  const firstOfMonth = startOfMonth(viewDate);
  const startDOW = getDay(firstOfMonth);
  const offset = (startDOW + 1) % 7; // Saturday is 0
  const totalDays = getDaysInMonth(viewDate);

  const daysGrid: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
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

  const handlePrevMonth = () => {
    let m = viewMonth - 1;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    let d = new Date(viewDate);
    d = setYear(d, y);
    d = setMonth(d, m);
    setViewDate(d);
  };

  const handleNextMonth = () => {
    let m = viewMonth + 1;
    let y = viewYear;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    let d = new Date(viewDate);
    d = setYear(d, y);
    d = setMonth(d, m);
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
      <input type="hidden" name={name} value={selectedDate.toISOString()} required={required} />

      {/* Clickable trigger button */}
      <div
        role="button"
        tabIndex={0}
        aria-label="انتخاب تاریخ و زمان"
        className="input flex items-center justify-between cursor-pointer"
        style={{
          padding: "7px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          cursor: "pointer",
          borderRadius: "8px",
          transition: "all 0.15s ease",
        }}
        onClick={() => {
          setViewDate(selectedDate);
          setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setViewDate(selectedDate);
            setIsOpen(true);
          }
        }}
      >
        <span className="num" style={{ letterSpacing: "0.5px", fontSize: "12.5px" }}>
          {displayText}
        </span>
        <svg
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          className="muted"
          style={{ opacity: 0.7 }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      {/* Modal Popup via React Portal (Escapes parent overflow & z-index constraints) */}
      {isOpen &&
        mounted &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              zIndex: 100050,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
            dir="rtl"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="انتخاب تاریخ و زمان"
              style={{
                width: "380px",
                maxWidth: "96vw",
                backgroundColor: "#0f172a",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                borderRadius: "16px",
                boxShadow:
                  "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 0, 0, 0.4)",
                color: "#f8fafc",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "10px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>📅</span>
                  <span style={{ fontSize: "13.5px", fontWeight: "700", color: "#f1f5f9" }}>
                    انتخاب تاریخ و زمان مانور
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "8px",
                    width: "28px",
                    height: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                    cursor: "pointer",
                    fontSize: "14px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
                    e.currentTarget.style.color = "#fca5a5";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                    e.currentTarget.style.color = "#94a3b8";
                  }}
                  aria-label="بستن پنجره"
                >
                  ✕
                </button>
              </div>

              {/* Real-time Display Badge */}
              <div
                style={{
                  backgroundColor: "rgba(30, 41, 59, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>زمان تعیین شده:</span>
                <span
                  className="num"
                  style={{
                    fontSize: "13.5px",
                    fontWeight: "bold",
                    color: "#38bdf8",
                    letterSpacing: "0.5px",
                  }}
                >
                  {displayText}
                </span>
              </div>

              {/* Month & Year Navigation */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  justifyContent: "space-between",
                }}
              >
                <button
                  type="button"
                  onClick={handleNextMonth}
                  title="ماه بعد"
                  style={{
                    backgroundColor: "#1e293b",
                    color: "#e2e8f0",
                    border: "1px solid rgba(255, 255, 255, 0.18)",
                    borderRadius: "8px",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ▶
                </button>

                <div style={{ display: "flex", gap: "6px", flex: 1 }}>
                  <select
                    className="input sm"
                    style={{
                      flex: 1.3,
                      padding: "6px 8px",
                      fontSize: "12.5px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "8px",
                      outline: "none",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                    value={viewMonth}
                    onChange={(e) => handleMonthChange(Number(e.target.value))}
                  >
                    {JALALI_MONTH_NAMES.map((mName, idx) => (
                      <option
                        key={idx}
                        value={idx}
                        style={{ backgroundColor: "#1e293b", color: "#ffffff" }}
                      >
                        {mName}
                      </option>
                    ))}
                  </select>

                  <select
                    className="input sm"
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      fontSize: "12.5px",
                      backgroundColor: "#1e293b",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "8px",
                      outline: "none",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                    value={viewYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                  >
                    {yearOptions.map((y) => (
                      <option
                        key={y}
                        value={y}
                        style={{ backgroundColor: "#1e293b", color: "#ffffff" }}
                      >
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handlePrevMonth}
                  title="ماه قبل"
                  style={{
                    backgroundColor: "#1e293b",
                    color: "#e2e8f0",
                    border: "1px solid rgba(255, 255, 255, 0.18)",
                    borderRadius: "8px",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ◀
                </button>
              </div>

              {/* Weekday Headers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  textAlign: "center",
                  fontSize: "11.5px",
                  fontWeight: "600",
                  color: "#94a3b8",
                  padding: "0 2px",
                }}
              >
                {WEEK_DAYS.map((day, idx) => (
                  <div key={idx} style={{ color: idx === 6 ? "#f87171" : "#94a3b8" }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: "4px",
                  textAlign: "center",
                  fontSize: "13px",
                  padding: "0 2px",
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

                  const isToday =
                    viewYear === todayJalaliYear &&
                    viewMonth === todayJalaliMonth &&
                    day === todayJalaliDay;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDaySelect(day)}
                      style={{
                        height: "34px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "8px",
                        border: isSelected
                          ? "1px solid #3b82f6"
                          : isToday
                          ? "1px solid rgba(56, 189, 248, 0.6)"
                          : "1px solid transparent",
                        cursor: "pointer",
                        backgroundColor: isSelected
                          ? "#2563eb"
                          : isToday
                          ? "rgba(56, 189, 248, 0.12)"
                          : "rgba(255, 255, 255, 0.03)",
                        color: isSelected
                          ? "#ffffff"
                          : isToday
                          ? "#38bdf8"
                          : "#f8fafc",
                        fontWeight: isSelected ? "bold" : isToday ? "600" : "normal",
                        transition: "all 0.12s ease",
                        boxShadow: isSelected
                          ? "0 2px 8px rgba(37, 99, 235, 0.4)"
                          : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.12)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = isToday
                            ? "rgba(56, 189, 248, 0.12)"
                            : "rgba(255, 255, 255, 0.03)";
                        }
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Time Picker */}
              <div
                style={{
                  marginTop: "2px",
                  padding: "10px 12px",
                  backgroundColor: "rgba(30, 41, 59, 0.5)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "14px" }}>⏰</span>
                  <span style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600" }}>
                    ساعت اجرای مانور:
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {/* Minutes Select */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <select
                      className="input sm text-center"
                      style={{
                        width: "64px",
                        padding: "5px 4px",
                        fontSize: "13px",
                        fontWeight: "bold",
                        backgroundColor: "#1e293b",
                        color: "#ffffff",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                      value={minutes}
                      onChange={(e) => handleMinuteChange(Number(e.target.value))}
                      aria-label="دقیقه"
                    >
                      {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                        <option
                          key={m}
                          value={m}
                          style={{ backgroundColor: "#1e293b", color: "#ffffff" }}
                        >
                          {String(m).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
                      دقیقه
                    </span>
                  </div>

                  <span
                    style={{
                      color: "#94a3b8",
                      fontWeight: "bold",
                      fontSize: "16px",
                      marginBottom: "12px",
                    }}
                  >
                    :
                  </span>

                  {/* Hours Select */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <select
                      className="input sm text-center"
                      style={{
                        width: "64px",
                        padding: "5px 4px",
                        fontSize: "13px",
                        fontWeight: "bold",
                        backgroundColor: "#1e293b",
                        color: "#ffffff",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                      value={hours}
                      onChange={(e) => handleHourChange(Number(e.target.value))}
                      aria-label="ساعت"
                    >
                      {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                        <option
                          key={h}
                          value={h}
                          style={{ backgroundColor: "#1e293b", color: "#ffffff" }}
                        >
                          {String(h).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
                      ساعت
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={handleTodayClick}
                  className="btn sm"
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    fontSize: "12px",
                    justifyContent: "center",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#f8fafc",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "8px",
                  }}
                >
                  ⚡ اکنون / امروز
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn sm primary"
                  style={{
                    flex: 1.4,
                    padding: "7px 12px",
                    fontSize: "12.5px",
                    fontWeight: "bold",
                    justifyContent: "center",
                    borderRadius: "8px",
                  }}
                >
                  ✓ تأیید و بستن
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
