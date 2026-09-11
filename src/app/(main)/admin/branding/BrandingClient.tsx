"use client";

import React, { useState, useTransition } from "react";
import { saveBrandingSettings } from "@/app/actions/lookups";
import { saveOfflinePolicyAction } from "@/app/actions/settings";
import { useToast } from "@/components/ui/Toast";

interface BrandingSettings {
  title: string;
  footer: string;
  logoIcon: string;
  logoType: "icon" | "image";
  logoImage: string;
  accentColor: string;
  announcementText: string;
  announcementKind: "info" | "success" | "warning" | "alert";
  announcementActive: boolean;
}

interface BrandingClientProps {
  initialSettings: BrandingSettings;
  initialOfflinePolicy?: "auto_sync" | "read_only";
}

// لیست رنگ‌های پیش‌فرض جهت دسترسی سریع
const ACCENT_PRESETS = [
  { name: "نارنجی (پیش‌فرض)", value: "#d8842a" },
  { name: "آبی کلاسیک", value: "#2563eb" },
  { name: "سبز متالیک", value: "#10b981" },
  { name: "قرمز شرکتی", value: "#ef4444" },
  { name: "بنفش مات", value: "#8b5cf6" },
  { name: "فیروزه‌ای خطی", value: "#06b6d4" },
  { name: "طلایی فاخر", value: "#f59e0b" },
  { name: "نوک‌مدادی لوکس", value: "#475569" },
];

const LOGO_PRESETS = ["🚇", "🚉", "⚙️", "🛠️", "📊", "🚃", "🏢", "⚡"];

export default function BrandingClient({
  initialSettings,
  initialOfflinePolicy = "auto_sync",
}: BrandingClientProps) {
  const [offlinePolicy, setOfflinePolicyState] = useState<"auto_sync" | "read_only">(
    initialOfflinePolicy
  );
  const [settings, setSettings] = useState<BrandingSettings>({
    title: initialSettings.title ?? "سامانه هوشمند مانور و دپو قطارها",
    footer: initialSettings.footer ?? "تمامی حقوق متعلق به عملیات خط یک شرکت بهره‌برداری راه‌آهن شهری تهران و حومه می‌باشد.",
    logoIcon: initialSettings.logoIcon ?? "🚈",
    logoType: initialSettings.logoType ?? "icon",
    logoImage: initialSettings.logoImage ?? "",
    accentColor: initialSettings.accentColor ?? "#d8842a",
    announcementText: initialSettings.announcementText ?? "",
    announcementKind: initialSettings.announcementKind ?? "info",
    announcementActive: initialSettings.announcementActive ?? false,
  });

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.warning("حجم تصویر لوگو نباید بیشتر از ۵۰۰ کیلوبایت باشد.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSettings((prev) => ({ ...prev, logoImage: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveBrandingSettings(settings);
      const policyRes = await saveOfflinePolicyAction(offlinePolicy);
      if (res.ok && policyRes.ok) {
        toast.success("تغییرات برندینگ و سیاست‌های شبکه با موفقیت ذخیره شد و به صورت زنده اعمال گردید! 🎉");
      } else if (!res.ok) {
        toast.error(res.error || "خطا در ذخیره‌سازی برندینگ");
      } else {
        toast.error(policyRes.error || "خطا در ذخیره‌سازی سیاست شبکه");
      }
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px", alignItems: "start" }} className="branding-grid">

      {/* فرم تنظیمات */}
      <form onSubmit={handleSave} className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>⚙️ تنظیمات هویت بصری و اختصاصی‌سازی</h2>
        </div>

        {/* بخش عنوان و پانویس */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label className="label" style={{ fontWeight: 650 }}>عنوان سامانه (Header Title):</label>
            <input
              type="text"
              required
              className="input"
              value={settings.title || ""}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              placeholder="مثال: سامانه مدیریت مانور"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label className="label" style={{ fontWeight: 650 }}>متن پانویس (Footer Text):</label>
            <input
              type="text"
              required
              className="input"
              value={settings.footer || ""}
              onChange={(e) => setSettings({ ...settings, footer: e.target.value })}
              placeholder="مثال: پایانه فتح‌آباد · v3"
            />
          </div>
        </div>

        {/* بخش لوگو و آیکون سامانه */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "rgba(30,41,59,0.01)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line-soft)" }}>
          <label className="label" style={{ fontWeight: 650, fontSize: "14px" }}>🚇 لوگو و آیکون بالای سامانه</label>

          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
              <input
                type="radio"
                name="logoType"
                value="icon"
                checked={settings.logoType === "icon"}
                onChange={() => setSettings({ ...settings, logoType: "icon" })}
              />
              <span>آیکون / ایموجی پیش‌فرض</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
              <input
                type="radio"
                name="logoType"
                value="image"
                checked={settings.logoType === "image"}
                onChange={() => setSettings({ ...settings, logoType: "image" })}
              />
              <span>تصویر لوگوی اختصاصی (آپلود فایل)</span>
            </label>
          </div>

          {settings.logoType === "icon" ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                key="logo-icon-input"
                type="text"
                className="input"
                value={settings.logoIcon || ""}
                onChange={(e) => setSettings({ ...settings, logoIcon: e.target.value })}
                style={{ width: "80px", textAlign: "center", fontSize: "20px", padding: "4px" }}
                required={settings.logoType === "icon"}
              />
              <div style={{ display: "flex", gap: "6px" }}>
                {LOGO_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSettings({ ...settings, logoIcon: emoji })}
                    style={{
                      fontSize: "18px",
                      padding: "6px 10px",
                      border: settings.logoIcon === emoji ? "2px solid var(--accent)" : "1px solid var(--line-soft)",
                      borderRadius: "6px",
                      background: "var(--panel)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input
                key="logo-image-input"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="input"
                style={{ padding: "6px", flex: 1 }}
                required={settings.logoType === "image" && !settings.logoImage}
              />
              {settings.logoImage && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <img
                    src={settings.logoImage}
                    alt="Logo Preview"
                    style={{ width: "45px", height: "45px", borderRadius: "6px", objectFit: "cover", border: "1px solid var(--line)" }}
                  />
                  <span style={{ fontSize: "10px", color: "var(--ink-soft)" }}>لوگوی آپلود شده</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* بخش انتخاب رنگ اصلی برند */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className="label" style={{ fontWeight: 650 }}>رنگ تم و لهجه سامانه (Accent Color Theme):</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="color"
              value={settings.accentColor || "#d8842a"}
              onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
              style={{ width: "45px", height: "45px", border: "0", cursor: "pointer", padding: 0, borderRadius: "6px" }}
            />
            <input
              type="text"
              className="input num"
              value={settings.accentColor || "#d8842a"}
              onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
              style={{ width: "120px", direction: "ltr", textAlign: "center" }}
              required
            />
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setSettings({ ...settings, accentColor: color.value })}
                style={{
                  fontSize: "11px",
                  padding: "4px 8px",
                  border: "1px solid var(--line-soft)",
                  borderRadius: "20px",
                  background: color.value,
                  color: "#fff",
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                  cursor: "pointer",
                  fontWeight: settings.accentColor === color.value ? "bold" : "normal",
                  boxShadow: settings.accentColor === color.value ? "0 0 0 2px var(--accent)" : "none",
                }}
              >
                {color.name}
              </button>
            ))}
          </div>
        </div>

        {/* بخش اطلاعیه سراسری */}
        <div style={{ background: "rgba(30,41,59,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid var(--line-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontWeight: 650, fontSize: "13.5px" }}>📢 اطلاعیه سراسری بالای سامانه</span>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={settings.announcementActive}
                onChange={(e) => setSettings({ ...settings, announcementActive: e.target.checked })}
              />
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>فعال‌سازی بنر سراسری</span>
            </label>
          </div>

          {settings.announcementActive && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px" }}>متن پیام اطلاعیه:</label>
                  <input
                    type="text"
                    value={settings.announcementText || ""}
                    onChange={(e) => setSettings({ ...settings, announcementText: e.target.value })}
                    placeholder="مثلاً: سامانه مانور امشب راس ساعت ۲۴ به مدت ۳۰ دقیقه در دست تعمیر خواهد بود..."
                    className="input"
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px" }}>نوع وضعیت بنر:</label>
                  <select
                    value={settings.announcementKind}
                    onChange={(e) => setSettings({ ...settings, announcementKind: e.target.value as any })}
                    className="input"
                  >
                    <option value="info">اطلاع‌رسانی عمومی (آبی)</option>
                    <option value="success">موفقیت‌آمیز / فرآیند عادی (سبز)</option>
                    <option value="warning">هشدار مهم عملیاتی (زرد)</option>
                    <option value="alert">خطای بحرانی / آماده‌باش (قرمز)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* بخش سیاست قطعی شبکه و سرور دپو */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
          <div>
            <label className="label" style={{ fontWeight: 650, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🌐</span>
              <span>سیاست سامانه در زمان قطعی ارتباط با سرور دپو (Offline Policy)</span>
            </label>
            <p style={{ margin: "4px 0 0 0", fontSize: "11.5px", color: "var(--ink-soft)" }}>
              تعیین نحوه عملکرد سامانه و دسترسی کاربران هنگام قطعی شبکه یا عدم دسترسی به سرور متمرکز دپو
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "12px",
                borderRadius: "8px",
                border: `1px solid ${offlinePolicy === "auto_sync" ? "var(--accent)" : "var(--line)"}`,
                backgroundColor: offlinePolicy === "auto_sync" ? "rgba(216, 132, 42, 0.08)" : "var(--panel)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <input
                type="radio"
                name="offlinePolicy"
                value="auto_sync"
                checked={offlinePolicy === "auto_sync"}
                onChange={() => setOfflinePolicyState("auto_sync")}
                style={{ marginTop: "3px" }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--ink)" }}>
                  ⚡ همگام‌سازی هوشمند آفلاین (پیش‌فرض و توصیه‌شده)
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--ink-soft)", marginTop: "3px", lineHeight: "1.6" }}>
                  در زمان قطعی شبکه به کاربران اجازه ثبت مانورها داده شده و عملیات در پایگاه داده محلی ذخیره می‌شود. به محض اتصال مجدد به سرور دپو، کلیه تغییرات کاربران به صورت کاملاً خودکار و دقیقاً بر اساس ساعت و دقیقه ثبت (Chronological Timestamp) در سرور متمرکز دپو همگام‌سازی می‌شوند.
                </div>
              </div>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "12px",
                borderRadius: "8px",
                border: `1px solid ${offlinePolicy === "read_only" ? "var(--crit)" : "var(--line)"}`,
                backgroundColor: offlinePolicy === "read_only" ? "rgba(239, 68, 68, 0.08)" : "var(--panel)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <input
                type="radio"
                name="offlinePolicy"
                value="read_only"
                checked={offlinePolicy === "read_only"}
                onChange={() => setOfflinePolicyState("read_only")}
                style={{ marginTop: "3px" }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--ink)" }}>
                  🔒 حالت فقط خواندنی (مشاهده)
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--ink-soft)", marginTop: "3px", lineHeight: "1.6" }}>
                  در زمان قطعی شبکه، پیام هشدار به کاربران نمایش داده شده و از ثبت هرگونه مانور یا تغییرات جدید در سیستم تا زمان برقراری مجدد ارتباط با سرور دپو جلوگیری می‌شود.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" disabled={isPending} className="btn primary">
            {isPending ? "در حال ثبت تغییرات..." : "💾 ذخیره و اعمال تغییرات سراسری"}
          </button>
        </div>
      </form>

      {/* بخش پیش‌نمایش درجا */}
      <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", position: "sticky", top: "20px" }}>
        <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "bold", margin: 0 }}>👀 پیش‌نمایش زنده هویت بصری</h2>
        </div>

        {/* پیش‌نمایش لوگو و برندینگ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>پیش‌نمایش هدر منو:</span>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--panel)" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "6px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
              {settings.logoType === "image" && settings.logoImage ? (
                <img src={settings.logoImage} alt="Logo Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span>{settings.logoIcon || "🚇"}</span>
              )}
            </div>
            <div>
              <b style={{ fontSize: "13px" }}>{settings.title}</b>
              <div style={{ fontSize: "10.5px", color: "var(--ink-soft)" }}>{settings.footer}</div>
            </div>
          </div>
        </div>

        {/* پیش‌نمایش دکمه و تم لهجه */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>پیش‌نمایش دکمه و رنگ تم:</span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button type="button" className="btn" style={{ background: settings.accentColor, color: "#fff", border: "none", cursor: "default" }}>
              دکمه تم رنگی فعال
            </button>
            <button type="button" className="btn" style={{ border: `1px solid ${settings.accentColor}`, color: settings.accentColor, background: "transparent", cursor: "default" }}>
              دکمه توخالی
            </button>
          </div>
        </div>

        {/* پیش‌نمایش بنر سراسری */}
        {settings.announcementActive && settings.announcementText && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>پیش‌نمایش بنر بالای صفحات:</span>
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: settings.announcementKind === "alert" ? "var(--crit-soft)" : settings.announcementKind === "warning" ? "var(--warn-soft)" : settings.announcementKind === "success" ? "var(--good-soft)" : "var(--accent-soft)",
                borderRight: `4px solid ${settings.announcementKind === "alert" ? "var(--crit)" : settings.announcementKind === "warning" ? "var(--warn)" : settings.announcementKind === "success" ? "var(--good)" : "var(--accent)"}`,
                color: "var(--ink)",
                fontSize: "12px",
                fontWeight: "bold",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>
                {settings.announcementKind === "alert" ? "🚨" : settings.announcementKind === "warning" ? "⚠️" : settings.announcementKind === "success" ? "🟢" : "📢"}
              </span>
              <span style={{ flex: 1 }}>{settings.announcementText}</span>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
