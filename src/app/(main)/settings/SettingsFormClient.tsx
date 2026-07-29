"use client";

import React, { useState, useTransition } from "react";
import { saveSetting } from "@/app/actions/settings";
import { useTheme } from "@/components/ThemeProvider";
import type { Appearance, DepotPrefs } from "@/lib/settings";

const presets = [
  { name: "زعفرانی (پیش‌فرض)", value: "#d8842a" },
  { name: "سبز زمردی", value: "#2e7d5b" },
  { name: "آبی ملایم", value: "#1f3a5f" },
  { name: "قرمز یاقوتی", value: "#b23b3b" },
  { name: "بنفش سلطنتی", value: "#6d28d9" },
  { name: "سرمه‌ای مدرن", value: "#0f172a" },
];

export default function SettingsFormClient({
  initialAppearance,
  initialDepot,
}: {
  initialAppearance: Appearance;
  initialDepot: DepotPrefs;
}) {
  const { setAppearance } = useTheme();
  const [appearance, setAppearanceLocal] = useState<Appearance>(initialAppearance);
  const [depot, setDepotLocal] = useState<DepotPrefs>(initialDepot);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      // ذخیره در دیتابیس
      const res1 = await saveSetting("appearance", appearance);
      if (res1.error) {
        setMessage({ text: res1.error, type: "error" });
        return;
      }
      const res2 = await saveSetting("depot", depot);
      if (res2.error) {
        setMessage({ text: res2.error, type: "error" });
        return;
      }

      // اعمال تغییرات به تم زنده
      setAppearance(appearance);
      setMessage({ text: "تنظیمات شما با موفقیت ذخیره شد.", type: "success" });
    });
  };

  const handleReset = () => {
    const defaultAppearance: Appearance = {
      theme: "auto",
      accent: "#d8842a",
      density: "normal",
      fontSize: 14,
      digits: "fa",
      navPosition: "right",
    };
    const defaultDepot: DepotPrefs = {
      quality: "2d",
      refreshSec: 15,
      defaultTerminal: 0,
      view2DMode: "map",
    };
    setAppearanceLocal(defaultAppearance);
    setDepotLocal(defaultDepot);
    setAppearance(defaultAppearance);
    setMessage({ text: "تنظیمات به مقادیر پیش‌فرض ریست شد. لطفاً ذخیره را کلیک کنید.", type: "success" });
  };

  return (
    <form onSubmit={handleSave} className="grid2" style={{ gap: "24px" }}>
      {message && (
        <div
          className="grid-span-all px-4 py-3 rounded-lg text-sm mb-4"
          style={{
            gridColumn: "1 / -1",
            backgroundColor: message.type === "success" ? "var(--good-bg)" : "var(--crit-bg)",
            color: message.type === "success" ? "var(--good)" : "var(--crit)",
            border: `1px solid ${message.type === "success" ? "var(--good)" : "var(--crit)"}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* بخش اول: ظاهر و تم */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h3 style={{ borderBottom: "1px solid var(--line)", paddingBottom: "8px", fontWeight: "700" }}>
          تنظیمات ظاهری (تم و ابعاد)
        </h3>

        <div className="field">
          <label>تم نرم‌افزار</label>
          <select
            className="input"
            value={appearance.theme}
            onChange={(e) => setAppearanceLocal((p) => ({ ...p, theme: e.target.value as any }))}
          >
            <option value="auto">هماهنگ با سیستم (Auto)</option>
            <option value="light">تم روشن (Light)</option>
            <option value="dark">تم تاریک (Dark)</option>
          </select>
        </div>

        <div className="field">
          <label>رنگ Accent پویا (رنگ اصلی عناصر)</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "4px" }}>
            {presets.map((p) => (
              <button
                key={p.value}
                type="button"
                className="btn sm"
                style={{
                  border: appearance.accent === p.value ? `2px solid ${p.value}` : "1px solid var(--line)",
                  fontWeight: appearance.accent === p.value ? "bold" : "normal",
                  justifyContent: "flex-start",
                  gap: "10px",
                }}
                onClick={() => setAppearanceLocal((prev) => ({ ...prev, accent: p.value }))}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    backgroundColor: p.value,
                  }}
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>اندازه قلم پایه ({appearance.fontSize} پیکسل)</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="range"
              min="12"
              max="20"
              step="1"
              value={appearance.fontSize}
              onChange={(e) => setAppearanceLocal((p) => ({ ...p, fontSize: Number(e.target.value) }))}
              style={{ flex: 1, accentColor: appearance.accent }}
            />
            <span className="num" style={{ fontWeight: "bold" }}>{appearance.fontSize}px</span>
          </div>
        </div>

        <div className="field">
          <label>تراکم جدول‌ها (Density)</label>
          <div style={{ display: "flex", gap: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="radio"
                name="density"
                checked={appearance.density === "normal"}
                onChange={() => setAppearanceLocal((p) => ({ ...p, density: "normal" }))}
                style={{ accentColor: appearance.accent }}
              />
              معمولی (صادقانه)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="radio"
                name="density"
                checked={appearance.density === "compact"}
                onChange={() => setAppearanceLocal((p) => ({ ...p, density: "compact" }))}
                style={{ accentColor: appearance.accent }}
              />
              فشرده (نمایش داده‌های بیشتر)
            </label>
          </div>
        </div>

        <div className="field">
          <label>موقعیت منوی ناوبری (سایدبار)</label>
          <select
            className="input"
            value={appearance.navPosition || "right"}
            onChange={(e) => setAppearanceLocal((p) => ({ ...p, navPosition: e.target.value as any }))}
          >
            <option value="right">عمودی در سمت راست (پیش‌فرض)</option>
            <option value="left">عمودی در سمت چپ</option>
            <option value="top">افقی در بالای صفحه</option>
            <option value="bottom">افقی در پایین صفحه</option>
          </select>
        </div>
      </div>

      {/* بخش دوم: نمای پایانه و رندر */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h3 style={{ borderBottom: "1px solid var(--line)", paddingBottom: "8px", fontWeight: "700" }}>
          تنظیمات نمای پایانه و بارگذاری داده
        </h3>

        <div className="field">
          <label>کیفیت و متد رندر صحنه پایانه</label>
          <select
            className="input"
            value={depot.quality}
            onChange={(e) => setDepotLocal((p) => ({ ...p, quality: e.target.value as any }))}
          >
            <option value="high">کیفیت بالا (۳بعدی با سایه و جزئیات)</option>
            <option value="med">کیفیت متوسط (۳بعدی سبک)</option>
            <option value="2d">نمای دو بعدی تعاملی (بسیار سریع و بهینه)</option>
          </select>
          <span style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4 }}>
            اگر سرعت پردازش روی مرورگر ضعیف است، نمای ۲بعدی تعاملی پیشنهاد می‌شود.
          </span>
        </div>

        <div className="field">
          <label>حالت چیدمان دو بعدی (۲D Layout Mode)</label>
          <select
            className="input"
            value={depot.view2DMode || "map"}
            onChange={(e) => setDepotLocal((p) => ({ ...p, view2DMode: e.target.value as any }))}
          >
            <option value="map">🗺️ نقشه پایانه (پیش‌فرض)</option>
            <option value="structured">📐 نمای ساختاریافته پایانه (افقی و بنتو)</option>
            <option value="grid">🔲 نمای ۵ ستونه شبکه‌ای (کلاسیک)</option>
          </select>
          <span style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4 }}>
            نمای نقشه پایانه، چیدمان واقعی دپو را به صورت دو بعدی تعاملی با قابلیت مدیریت خطوط و قطارها نمایش می‌دهد.
          </span>
        </div>

        <div className="field">
          <label>نرخ به‌روزرسانی زنده پایانه</label>
          <select
            className="input"
            value={depot.refreshSec}
            onChange={(e) => setDepotLocal((p) => ({ ...p, refreshSec: Number(e.target.value) }))}
          >
            <option value="10">هر ۱۰ ثانیه</option>
            <option value="15">هر ۱۵ ثانیه (پیش‌فرض)</option>
            <option value="30">هر ۳۰ ثانیه</option>
            <option value="60">هر ۱ دقیقه</option>
            <option value="0">غیرفعال کردن پولینگ زنده</option>
          </select>
        </div>

        <div className="field">
          <label>ترمینال پیش‌فرض هنگام باز کردن پایانه</label>
          <select
            className="input"
            value={depot.defaultTerminal}
            onChange={(e) => setDepotLocal((p) => ({ ...p, defaultTerminal: Number(e.target.value) }))}
          >
            <option value="0">نمای کلی دپو (تمام ترمینال‌ها)</option>
            <option value="1">ترمینال ۱ (دیزل‌شاپ)</option>
            <option value="2">ترمینال ۲ (واگن‌سازی)</option>
            <option value="3">ترمینال ۳ (خط اصلی)</option>
            <option value="4">ترمینال ۴ (پارکینگ شمالی)</option>
            <option value="5">ترمینال ۵ (پارکینگ جنوبی)</option>
            <option value="6">ترمینال ۶ (فرعی ۱)</option>
            <option value="7">ترمینال ۷ (فرعی ۲)</option>
          </select>
        </div>
      </div>

      <div style={{ gridColumn: "1 / -1", display: "flex", gap: "12px", marginTop: "16px" }}>
        <button type="submit" className="btn primary" disabled={isPending}>
          {isPending ? "در حال ذخیره‌سازی..." : "ذخیره تغییرات"}
        </button>
        <button type="button" className="btn" onClick={handleReset}>
          ریست به پیش‌فرض
        </button>
      </div>
    </form>
  );
}
