"use client";

import React from "react";
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
} from "@phosphor-icons/react";

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
  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", paddingBottom: "48px" }}>
      {/* هدر اصلی شناسنامه سامانه */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(20, 83, 45, 0.25) 0%, rgba(15, 23, 42, 0.6) 100%)",
          border: "1px solid rgba(34, 197, 94, 0.3)",
          borderRadius: "16px",
          padding: "32px 28px",
          marginBottom: "28px",
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

      {/* بخش متولیان سازمانی و مدیریت پروژه */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.18rem", fontWeight: 700, margin: "0 0 16px", color: "var(--ink)", display: "flex", alignItems: "center", gap: "8px" }}>
          <Building size={20} color="#38bdf8" />
          متولیان راهبردی و سازمانی پروژه
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
          {/* کارت ۱: مدیریت عملیات خط یک */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "22px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(56, 189, 248, 0.15)",
                  color: "#38bdf8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building size={24} weight="duotone" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>
                  مدیریت عملیات خط یک
                </h3>
                <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                  راهبری راهبردی و سیاست‌گذاری سیر و حرکت
                </span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink-muted)", lineHeight: 1.7, textAlign: "justify" }}>
              این نرم‌افزار به ابتکار و هدایت <b>مدیریت عملیات خط یک شرکت بهره‌برداری راه‌آهن شهری تهران و حومه</b> جهت
              تحول دیجیتال، استانداردسازی فرآیندهای ترافیکی و ارتقای حداکثری ضریب ایمنی تردد ناوگان ریلی سفارش‌گذاری و هدایت شده است.
            </p>
          </div>

          {/* کارت ۲: ریاست عملیات پایانه و مانور خط یک */}
          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "22px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  color: "#f59e0b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <HardHat size={24} weight="duotone" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>
                  ریاست عملیات پایانه و مانور خط یک
                </h3>
                <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                  راهبری تخصصی میدانی و نظارت بر مانورهای پایانه فتح‌آباد
                </span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink-muted)", lineHeight: 1.7, textAlign: "justify" }}>
              طراحی جزئیات گردش‌کارها، الزامات ایمنی ریل‌ها، بازرسی‌های فنی ناوگان و کنترل ظرفیت خطوط تحت نظارت مستقیم
              <b>ریاست عملیات پایانه و مانور خط یک</b> تعریف و با مقتضیات میدانی بزرگ‌ترین پایانه قطار شهری تطبیق یافته است.
            </p>
          </div>
        </div>
      </div>

      {/* بخش برنامه‌نویسی و مهندسی توسعه */}
      <div
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid rgba(168, 85, 247, 0.3)",
          borderRadius: "14px",
          padding: "24px 26px",
          marginBottom: "28px",
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.2)",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "14px" }}>
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "14px",
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              color: "#c084fc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Code size={28} weight="duotone" />
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
          <b>سید شبیر موسوی</b> توسعه یافته و پیاده‌سازی شده است.
        </p>
      </div>

      {/* ستون قابلیت‌ها و ستون‌های مهندسی سامانه */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.18rem", fontWeight: 700, margin: "0 0 16px", color: "var(--ink)", display: "flex", alignItems: "center", gap: "8px" }}>
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
            حق نشر و کلیه حقوق مادی و معنوی متعلق به <b>شرکت بهره‌برداری راه‌آهن شهری تهران و حومه (خط یک)</b> است © ۲۰۲۶
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
