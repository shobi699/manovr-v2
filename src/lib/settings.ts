// خواندن/نوشتن تنظیمات key-value (سراسری و شخصی)
import { prisma } from "@/lib/prisma";

export type Appearance = {
  theme: "auto" | "light" | "dark";
  accent: string;        // hex
  density: "normal" | "compact";
  fontSize: number;      // px پایه
  digits: "fa" | "latin";
  navPosition: "right" | "left" | "top" | "bottom";
};

export type DepotPrefs = {
  quality: "high" | "med" | "2d";
  refreshSec: number;
  defaultTerminal: number; // 0 = نمای کلی
  view2DMode?: "grid" | "structured"; // "grid" = ۵ ستونی کلاسیک, "structured" = دیاگرام افقی ساختاریافته پایانه
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "auto", accent: "#d8842a", density: "normal", fontSize: 14, digits: "fa", navPosition: "right",
};
export const DEFAULT_DEPOT: DepotPrefs = { quality: "2d", refreshSec: 15, defaultTerminal: 0, view2DMode: "structured" };

export async function getUserSetting<T>(userId: number, key: string, fallback: T): Promise<T> {
  const row = await prisma.appSetting.findUnique({
    where: { scope_userId_key: { scope: "user", userId, key } },
  });
  if (!row) return fallback;
  try { return { ...fallback, ...JSON.parse(row.value) }; } catch { return fallback; }
}

export async function setUserSetting(userId: number, key: string, value: unknown) {
  await prisma.appSetting.upsert({
    where: { scope_userId_key: { scope: "user", userId, key } },
    update: { value: JSON.stringify(value) },
    create: { scope: "user", userId, key, value: JSON.stringify(value) },
  });
}
