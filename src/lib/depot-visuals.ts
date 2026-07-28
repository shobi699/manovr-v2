// منبع واحد سبک‌های بصری برای نمای پایانه (۲بعدی و ۳بعدی)
// - STATUS_STYLE: رنگ و آیکون وضعیت چهارگانه‌ی قطار (سازگار با DepotScene فعلی)
// - ZONE_CONFIG: مختصات و رنگ ۷ سوله؛ چیدمان آینه‌ی گرید ۵-ستونه‌ی ۲بعدی
//
// ⚠️ ZONE_CONFIG باید با ZONES در prisma/seed-v3.mjs همگام بماند.

import { StatusIcon } from "@/lib/icons";
import type { ComponentType } from "react";

export interface StatusStyle {
  // فیلدهای مورد استفاده در نمای ۲بعدی (سبک اینلاین)
  border: string;
  bg: string;
  text: string;
  badge: string;
  icon: string;   // ایموجی (سازگاری معکوس)
  label: string;

  // فیلدهای اضافه‌شده برای نمای سه‌بعدی و آیکون Phosphor
  cls: string;
  color3d: string;
  emissiveIntensity: number;
  IconComp: ComponentType<any>;
}

export const STATUS_STYLE: Record<number, StatusStyle> = {
  1: {
    border: "color-mix(in oklab, var(--good) 40%, var(--line))",
    bg: "color-mix(in oklab, var(--good-bg) 55%, var(--panel))",
    text: "var(--good)",
    badge: "var(--good)",
    icon: "🟢",
    label: "آماده به کار",
    cls: "status-ready",
    color3d: "#22c55e",
    emissiveIntensity: 1.0,
    IconComp: StatusIcon.ready,
  },
  2: {
    border: "color-mix(in oklab, var(--warn) 45%, var(--line))",
    bg: "color-mix(in oklab, var(--warn-bg) 55%, var(--panel))",
    text: "var(--warn)",
    badge: "var(--warn)",
    icon: "🛠️",
    label: "تحت تعمیر",
    cls: "status-repair",
    color3d: "#f97316",
    emissiveIntensity: 1.2,
    IconComp: StatusIcon.repair,
  },
  3: {
    border: "color-mix(in oklab, var(--crit) 45%, var(--line))",
    bg: "color-mix(in oklab, var(--crit-bg) 55%, var(--panel))",
    text: "var(--crit)",
    badge: "var(--crit)",
    icon: "⛔",
    label: "غیرفعال / خراب",
    cls: "status-inactive",
    color3d: "#111827",
    emissiveIntensity: 0,
    IconComp: StatusIcon.inactive,
  },
  4: {
    border: "color-mix(in oklab, var(--rail) 45%, var(--line))",
    bg: "color-mix(in oklab, var(--rail-soft) 65%, var(--panel))",
    text: "var(--rail)",
    badge: "var(--rail)",
    icon: "⚡",
    label: "آماده اعزام",
    cls: "status-dispatch",
    color3d: "#3b82f6",
    emissiveIntensity: 1.4,
    IconComp: StatusIcon.dispatch,
  },
};

export function statusStyleFor(status: number): StatusStyle {
  return STATUS_STYLE[status] ?? STATUS_STYLE[1];
}

export interface ZoneItem {
  x: number;
  z: number;
  label: string;
  // فیلد قدیمی که DepotScene فعلی استفاده می‌کند (رنگ لهجه‌ی زون)
  color: string;
  // مستعارهای معنایی جدید
  accent: string;
  ink: string;
  gridCol: number;
  gridRow: "top" | "bottom" | "full";
}

const zone = (
  x: number, z: number, label: string,
  accent: string, ink: string, gridCol: number, gridRow: "top" | "bottom" | "full",
): ZoneItem => ({ x, z, label, color: accent, accent, ink, gridCol, gridRow });

// نگاشت آینه‌ی گرید ۵-ستونه‌ی نمای ۲بعدی در فضای سه‌بعدی.
// RTL: ستون ۱ (راست‌ترین) → بزرگ‌ترین X ، ستون ۵ (چپ‌ترین) → کوچک‌ترین X
// ردیف بالا → Z منفی ، ردیف پایین → Z مثبت ، خط اصلی → مرکز
// فاصلهٔ ستون‌ها = 240 (بزرگ‌تر از حداکثر عرض سولهٔ پویا) تا هرگز همپوشانی نشود
export const ZONE_CONFIG: Record<number, ZoneItem> = {
  // ستون ۱: پارکینگ جنوبی (بالا) + فرعی غرب (پایین)
  5: zone( 480, -100, "پارکینگ جنوبی",     "#06b6d4", "#0e7490", 1, "top"),
  6: zone( 480,  100, "خطوط فرعی (غرب)",  "#8b5cf6", "#6d28d9", 1, "bottom"),

  // ستون ۲: پارکینگ شمالی (بالا) + فرعی شرق (پایین)
  4: zone( 240, -100, "پارکینگ شمالی",    "#3b82f6", "#1d4ed8", 2, "top"),
  7: zone( 240,  100, "خطوط فرعی (شرق)",  "#ec4899", "#be185d", 2, "bottom"),

  // ستون ۳: خط اصلی (بالا) + سایر خطوط (پایین)
  3: zone(   0, -100, "خط اصلی",           "#64748b", "#334155", 3, "top"),
  8: zone(   0,  100, "سایر خطوط",          "#475569", "#1e293b", 3, "bottom"),

  // ستون ۴: واگن‌سازی
  2: zone(-240,    0, "واگن‌سازی",         "#f59e0b", "#b45309", 4, "full"),

  // ستون ۵: دیزل‌شاپ (چپ‌ترین)
  1: zone(-480,    0, "دیزل‌شاپ",          "#ef4444", "#b91c1c", 5, "full"),
};

export const ZONE_HALF = 55;
export const SHED_HEIGHT = 26;
