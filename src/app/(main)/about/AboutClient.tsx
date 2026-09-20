"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Train,
  ShieldCheck,
  Code,
  User,
  Calendar,
  Tag,
  Cpu,
  Database,
  ChartBar,
  Ticket,
  BookOpen,
  ArrowRight,
  CheckCircle,
  Building,
  HardHat,
  ArrowsLeftRight,
  Lightning,
  ClockCounterClockwise,
  Sparkle,
  GitCommit,
  Star,
} from "@phosphor-icons/react";
import { APP_RELEASES, type AppRelease } from "@/lib/version";

interface AboutClientProps {
  currentVersion: string;
  buildDateJalali: string;
  buildDateGregorian: string;
}

export default function AboutClient({
  currentVersion,
  buildDateJalali,
  buildDateGregorian,
}: AboutClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "releases">("overview");

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", paddingBottom: "48px" }} dir="rtl">
      {/* هدر اصلی شناسنامه سامانه */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(20, 83, 45, 0.25) 0%, rgba(15, 23, 42, 0.6) 100%)",
          border: "1px solid rgba(34, 197, 94, 0.3)",
          borderRadius: "16px",
          padding: "32px 28px",
          marginBottom: "24px",
          position: "relative",
          overflow: "hidden",
          backdropFilter: "blur(12px)",
          boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-30px",
            left: "-30px",
            width: "180px",
            height: "180px",
            background: "radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "16px",
                backgroundColor: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                color: "#4ade80",
                boxShadow: "0 0 20px rgba(34, 197, 94, 0.25)",
              }}
            >
              <Train size={36} weight="duotone" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "var(--ink)" }}>
                  سامانه مدیریت پایانه و مانور ریلی فتح‌آباد
                </h1>
                <span
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.2)",
                    color: "#4ade80",
                    border: "1px solid rgba(34, 197, 94, 0.4)",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 700,
                    fontFamily: "var(--mono, monospace)",
                  }}
                >
                  نسخه {currentVersion}
                </span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.92rem", color: "var(--ink-faint)", lineHeight: 1.6 }}>
                شرکت بهره‌برداری راه‌آهن شهری تهران و حومه • خط یک مترو
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link
              href="/help"
              className="btn btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                borderRadius: "10px",
                textDecoration: "none",
              }}
            >
              <BookOpen size={16} />
              مرکز آموزش و راهنما
            </Link>
            <Link
              href="/tickets"
              className="btn btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                borderRadius: "10px",
                textDecoration: "none",
              }}
            >
              <Ticket size={16} />
              پشتیبانی و تیکت
            </Link>
          </div>
        </div>

        {/* مشخصات نوار متادیتای نسخه */}
        <div
          style={{
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            fontSize: "12.5px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ink-muted)" }}>
            <Tag size={16} color="#4ade80" />
            <span>نگارش رسمی:</span>
            <strong style={{ color: "var(--ink)", fontFamily: "var(--mono, monospace)" }}>v{currentVersion}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ink-muted)" }}>
            <Calendar size={16} color="#38bdf8" />
            <span>تاریخ انتشار:</span>
            <strong style={{ color: "var(--ink)" }}>{buildDateJalali}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ink-muted)" }}>
            <Cpu size={16} color="#fbbf24" />
            <span>معماری و کامپایل:</span>
            <strong style={{ color: "var(--ink)", fontFamily: "var(--mono, monospace)" }}>Windows x64 Native</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ink-muted)" }}>
            <ShieldCheck size={16} color="#a78bfa" />
            <span>وضعیت بهره‌برداری:</span>
            <strong style={{ color: "#4ade80" }}>عملیاتی و تاییدشده</strong>
          </div>
        </div>
      </div>

      {/* تب‌بندی ناوبری سریع بخش‌های درباره ما */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "8px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "8px 18px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s",
            backgroundColor: activeTab === "overview" ? "var(--panel-2, rgba(56, 189, 248, 0.15))" : "transparent",
            color: activeTab === "overview" ? "#38bdf8" : "var(--ink-faint)",
            boxShadow: activeTab === "overview" ? "inset 0 -2px 0 #38bdf8" : "none",
          }}
        >
          <Building size={18} weight={activeTab === "overview" ? "bold" : "regular"} />
          <span>شناسنامه و متولیان سامانه</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("releases")}
          style={{
            padding: "8px 18px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s",
            backgroundColor: activeTab === "releases" ? "var(--panel-2, rgba(34, 197, 94, 0.15))" : "transparent",
            color: activeTab === "releases" ? "#4ade80" : "var(--ink-faint)",
            boxShadow: activeTab === "releases" ? "inset 0 -2px 0 #4ade80" : "none",
          }}
        >
          <ClockCounterClockwise size={18} weight={activeTab === "releases" ? "bold" : "regular"} />
          <span>تاریخچه نگارش‌ها و تغییرات (Changelog)</span>
          <span
            style={{
              fontSize: "11px",
              padding: "1px 6px",
              borderRadius: "12px",
              backgroundColor: "rgba(34, 197, 94, 0.2)",
              color: "#4ade80",
            }}
          >
            {APP_RELEASES.length}
          </span>
        </button>
      </div>

      {activeTab === "overview" ? (
        <>
          {/* بخش متولیان سازمانی و مدیریت پروژه */}
          <div style={{ marginBottom: "28px" }}>
            <h2
              style={{
                fontSize: "1.18rem",
                fontWeight: 700,
                margin: "0 0 16px",
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Building size={22} color="#38bdf8" weight="duotone" />
              متولیان راهبردی و فرماندهی عملیات خط یک مترو
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "18px" }}>
              {/* کارت ۱: مدیریت عملیات خط یک — مهندس مصطفی قاسمی */}
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.15)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "4px",
                    height: "100%",
                    backgroundColor: "#38bdf8",
                  }}
                />

                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "14px",
                      backgroundColor: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      flexShrink: 0,
                    }}
                  >
                    <Building size={28} weight="duotone" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "6px",
                          backgroundColor: "rgba(56, 189, 248, 0.15)",
                          color: "#38bdf8",
                        }}
                      >
                        هدایت راهبردی و کلان
                      </span>
                    </div>
                    <h3 style={{ margin: "2px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--ink)" }}>
                      جناب آقای مهندس مصطفی قاسمی
                    </h3>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-muted)", marginTop: "2px" }}>
                      مدیر عملیات خط یک متروی تهران
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    backgroundColor: "var(--ground, rgba(15, 23, 42, 0.4))",
                    border: "1px solid var(--border)",
                    fontSize: "0.86rem",
                    color: "var(--ink-muted)",
                    lineHeight: 1.75,
                    textAlign: "justify",
                  }}
                >
                  سیاست‌گذاری، هدایت راهبردی فرآیندهای سیر و حرکت و پشتیبانی از طرح جامع تحول دیجیتال پایانه فتح‌آباد تحت رهبری و
                  نظارت عالی <b>جناب آقای مهندس مصطفی قاسمی</b>، مدیر محترم عملیات خط یک شرکت بهره‌برداری راه‌آهن شهری تهران و حومه،
                  به منظور ارتقای بهره‌وری، شفافیت داده‌ها و حداکثرسازی ضریب ایمنی تردد ناوگان ریلی پایه‌ریزی گردیده است.
                </div>
              </div>

              {/* کارت ۲: ریاست عملیات و مانور خط یک — مهندس وحید خلعتی */}
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.15)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "4px",
                    height: "100%",
                    backgroundColor: "#f59e0b",
                  }}
                />

                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "14px",
                      backgroundColor: "rgba(245, 158, 11, 0.15)",
                      color: "#f59e0b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      flexShrink: 0,
                    }}
                  >
                    <HardHat size={28} weight="duotone" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "6px",
                          backgroundColor: "rgba(245, 158, 11, 0.15)",
                          color: "#f59e0b",
                        }}
                      >
                        فرماندهی میدانی و فنی
                      </span>
                    </div>
                    <h3 style={{ margin: "2px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--ink)" }}>
                      جناب آقای مهندس وحید خلجی
                    </h3>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-muted)", marginTop: "2px" }}>
                      رئیس عملیات و مانور خط یک
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    backgroundColor: "var(--ground, rgba(15, 23, 42, 0.4))",
                    border: "1px solid var(--border)",
                    fontSize: "0.86rem",
                    color: "var(--ink-muted)",
                    lineHeight: 1.75,
                    textAlign: "justify",
                  }}
                >
                  راهبری فنی، تدوین گردش‌کارهای تخصصی مانور، بازرسی‌های دقیق ریل‌ها و نظارت مستقیم بر عملیات سیر، جابجایی و اعزام قطارها در پایانه فتح‌آباد با هدایت و برنامه‌ریزی میدانی <b>جناب آقای مهندس وحید خلجی</b>، رئیس محترم عملیات و مانور خط یک، جهت برقراری انضباط ترافیکی و استانداردهای سخت‌گیرانه ایمنی پیاده‌سازی و مستقر شده است.
                </div>
              </div>
            </div>
          </div>

          {/* بخش برنامه‌نویسی و مهندسی توسعه */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              borderRadius: "16px",
              padding: "24px 26px",
              marginBottom: "28px",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.2)",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "14px" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  backgroundColor: "rgba(168, 85, 247, 0.15)",
                  color: "#c084fc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                }}
              >
                <Code size={30} weight="duotone" />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#c084fc", fontWeight: 600 }}>مهندسی نرم‌افزار و معماری سیستم</span>
                </div>
                <h3 style={{ margin: "2px 0 0", fontSize: "1.2rem", fontWeight: 800, color: "var(--ink)" }}>
                  طراحی، برنامه‌نویسی و توسعه توسط: <span style={{ color: "#a855f7" }}>سید شبیر موسوی</span>
                </h3>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-muted)", lineHeight: 1.8, textAlign: "justify" }}>
              کلیه لایه‌های نرم‌افزار شامل معماری هسته پردازشی، الگوریتم‌های مدیریت خطوط و جلوگیری از تداخل ناوگان،
              طراحی سیستم پایگاه داده توزیع‌شده با مقاومت در برابر خطاهای فایل شبکه سرور، موتور رندر سه‌بعدی و دوبعدی پایانه،
              سامانه گزارش‌ساز پیشرفته پویا، زیرساخت احراز هویت و سطوح دسترسی (Tri-Sync) و تجربه کاربری بومی (RTL) توسط
              <b> سید شبیر موسوی </b> توسعه یافته و پیاده‌سازی شده است.
            </p>
          </div>

          {/* ستون قابلیت‌ها و ستون‌های مهندسی سامانه */}
          <div style={{ marginBottom: "28px" }}>
            <h2
              style={{
                fontSize: "1.18rem",
                fontWeight: 700,
                margin: "0 0 16px",
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Cpu size={20} color="#4ade80" />
              ستون‌های فنی و قابلیت‌های کلیدی سامانه
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
              <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <ArrowsLeftRight size={22} color="#38bdf8" />
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>ثبت و کنترل مانورها</h4>
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-faint)", lineHeight: 1.6 }}>
                  تأیید دونوبته، ماتریس شیفت راهبران، کنترل هوشمند ظرفیت خط و جلوگیری از تصادم ریل‌ها.
                </p>
              </div>

              <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <Database size={22} color="#4ade80" />
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>پایداری شبکه سرور</h4>
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-faint)", lineHeight: 1.6 }}>
                  ایزولاسیون تراکنش‌های شبکه، حذف کامل خطای ۲۵۷۰ دیسک و اتصال پایدار بر بستر فایل سرور.
                </p>
              </div>

              <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <ChartBar size={22} color="#f59e0b" />
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>گزارش‌ساز پویا</h4>
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-faint)", lineHeight: 1.6 }}>
                  تولید دفاتر رسمی شیفت، خروجی اکسل راست‌چین (RTL) و صدور فرم‌های رسمی استاندارد PDF.
                </p>
              </div>

              <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <ShieldCheck size={22} color="#a855f7" />
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>امنیت و ممیزی</h4>
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-faint)", lineHeight: 1.6 }}>
                  ثبت لاگ وقایع (Audit Log)، ماتریس دسترسی نقش‌ها و پروتکل یکپارچه Tri-Sync.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* تب ۲: تاریخچه و شناسنامه انتشارات و نگارش‌ها (Release History & Changelog) */
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "1.18rem",
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <ClockCounterClockwise size={22} color="#4ade80" weight="duotone" />
                تاریخچه جامع نگارش‌ها و وقایع توسعه نرم‌افزار
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--ink-faint)" }}>
                شرح تفصیلی اصلاحات، ویژگی‌های اضافه‌شده و بهبودهای عملیاتی در هر نگارش سامانه
              </p>
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#4ade80",
                backgroundColor: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                padding: "4px 12px",
                borderRadius: "20px",
                fontWeight: 600,
              }}
            >
              آخرین نسخه پایدار: v{currentVersion}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {APP_RELEASES.map((rel, index) => {
              const isCurrent = rel.version === currentVersion;
              return (
                <div
                  key={rel.version}
                  style={{
                    backgroundColor: "var(--surface)",
                    border: isCurrent ? "1px solid rgba(34, 197, 94, 0.45)" : "1px solid var(--border)",
                    borderRadius: "16px",
                    padding: "20px 24px",
                    boxShadow: isCurrent ? "0 8px 24px -6px rgba(34, 197, 94, 0.15)" : "0 4px 12px rgba(0, 0, 0, 0.08)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {isCurrent && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: "5px",
                        height: "100%",
                        backgroundColor: "#22c55e",
                      }}
                    />
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                      marginBottom: "12px",
                      borderBottom: "1px dashed var(--border)",
                      paddingBottom: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: 800,
                          fontFamily: "var(--mono, monospace)",
                          color: isCurrent ? "#4ade80" : "var(--ink)",
                          backgroundColor: isCurrent ? "rgba(34, 197, 94, 0.15)" : "var(--ground)",
                          padding: "2px 10px",
                          borderRadius: "8px",
                          border: isCurrent ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid var(--border)",
                        }}
                      >
                        v{rel.version}
                      </span>

                      {rel.badge && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            backgroundColor:
                              rel.badgeVariant === "success"
                                ? "rgba(34, 197, 94, 0.2)"
                                : rel.badgeVariant === "blue"
                                  ? "rgba(56, 189, 248, 0.2)"
                                  : rel.badgeVariant === "amber"
                                    ? "rgba(245, 158, 11, 0.2)"
                                    : "rgba(168, 85, 247, 0.2)",
                            color:
                              rel.badgeVariant === "success"
                                ? "#4ade80"
                                : rel.badgeVariant === "blue"
                                  ? "#38bdf8"
                                  : rel.badgeVariant === "amber"
                                    ? "#fbbf24"
                                    : "#c084fc",
                            border: `1px solid ${rel.badgeVariant === "success"
                              ? "rgba(34, 197, 94, 0.4)"
                              : rel.badgeVariant === "blue"
                                ? "rgba(56, 189, 248, 0.4)"
                                : rel.badgeVariant === "amber"
                                  ? "rgba(245, 158, 11, 0.4)"
                                  : "rgba(168, 85, 247, 0.4)"
                              }`,
                          }}
                        >
                          {rel.badge}
                        </span>
                      )}

                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--ink)" }}>
                        {rel.title}
                      </h3>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--ink-faint)" }}>
                      <Calendar size={14} color="#38bdf8" />
                      <span>{rel.dateJalali}</span>
                    </div>
                  </div>

                  {/* فهرست تغییرات و توضیحات هر نسخه */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {rel.highlights.map((point, pIdx) => (
                      <div
                        key={pIdx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          fontSize: "0.88rem",
                          lineHeight: 1.7,
                          color: "var(--ink-muted)",
                          textAlign: "justify",
                        }}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor: isCurrent ? "#4ade80" : "var(--ink-faint)",
                            marginTop: "8px",
                            flexShrink: 0,
                          }}
                        />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* شناسنامه پایانه فتح‌آباد و کپی‌رایت */}
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "20px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          fontSize: "12.5px",
          color: "var(--ink-faint)",
        }}
      >
        <div>
          <div>
            <b>پایانه ریلی فتح‌آباد:</b> بزرگ‌ترین پایانه تعمیرات، نگهداری و توقفگاه ناوگان ریلی شرکت بهره‌برداری راه‌آهن شهری تهران و حومه
          </div>
          <div style={{ marginTop: "4px" }}>
            حق نشر و کلیه حقوق مادی و معنوی متعلق به <b>سید شبیر موسوی</b> است © ۲۰۲۶
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href="/dashboard"
            style={{
              color: "var(--ink)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            <span>بازگشت به داشبورد</span>
            <ArrowRight size={14} style={{ transform: "rotate(180deg)" }} />
          </Link>
        </div>
      </div>
    </div>
  );
}
