import { prisma } from "@/lib/prisma";
import { unstable_cache, revalidateTag, revalidatePath } from "next/cache";

export interface LookupData {
  id: number;
  key: string;
  label: string;
  isSystem: boolean;
  values: {
    id: number;
    code: number;
    label: string;
    color: string | null;
    icon: string | null;
    isActive: boolean;
    sortIdx: number;
    meta: string;
  }[];
}

const DEFAULT_PERMANENT_LOOKUPS = [
  { code: 20, label: "تعویض کفشک", color: "#64748b", meta: JSON.stringify({}) },
  { code: 21, label: "انتقال دائم به سایر خطوط", color: "#dc2626", meta: JSON.stringify({ isPermanent: true }) },
  { code: 22, label: "انتقال دائم به واگن‌سازی", color: "#ea580c", meta: JSON.stringify({ isPermanent: true }) },
  { code: 23, label: "سایر انتقال‌های دائم", color: "#b91c1c", meta: JSON.stringify({ isPermanent: true }) },
  { code: 24, label: "انتقال دائم", color: "#991b1b", meta: JSON.stringify({ isPermanent: true }) },
];

async function ensurePermanentManovrLookups(typeId: number, values: { id: number; code: number; label: string }[]) {
  const valueMap = new Map(values.map((v) => [v.code, v]));
  const usedCodes = new Set(values.map((v) => v.code));

  for (const item of DEFAULT_PERMANENT_LOOKUPS) {
    const existing = valueMap.get(item.code);
    if (!existing) {
      try {
        await prisma.lookupValue.create({
          data: {
            typeId,
            code: item.code,
            label: item.label,
            color: item.color,
            meta: item.meta,
            isActive: true,
            sortIdx: item.code,
          },
        });
      } catch {
        // نادیده گرفتن همزمانی
      }
    } else if (existing.label !== item.label && item.code >= 20 && item.code <= 24) {
      try {
        let nextCode = 30;
        while (usedCodes.has(nextCode)) nextCode++;
        usedCodes.add(nextCode);

        await prisma.lookupValue.update({
          where: { id: existing.id },
          data: { code: nextCode, sortIdx: nextCode },
        });

        await prisma.lookupValue.create({
          data: {
            typeId,
            code: item.code,
            label: item.label,
            color: item.color,
            meta: item.meta,
            isActive: true,
            sortIdx: item.code,
          },
        });
      } catch {}
    }
  }
}

// واکشی دسته‌بندی لوکاپ با کش سراسری Next.js با تفکیک کلیدها
export const getCachedLookup = (key: string): Promise<LookupData | null> => {
  return unstable_cache(
    async (lookupKey: string): Promise<LookupData | null> => {
      const type = await prisma.lookupType.findUnique({
        where: { key: lookupKey },
        include: {
          values: {
            orderBy: { sortIdx: "asc" },
          },
        },
      });
      if (!type) return null;

      if (lookupKey === "manovr_type") {
        const requiredCodes = [20, 21, 22, 23, 24];
        const valMap = new Map(type.values.map((v) => [v.code, v.label]));
        const isMissingOrOverwritten = requiredCodes.some(
          (c) => !valMap.has(c) || valMap.get(c) !== DEFAULT_PERMANENT_LOOKUPS.find((i) => i.code === c)?.label
        );

        if (isMissingOrOverwritten) {
          await ensurePermanentManovrLookups(type.id, type.values);
          const reFetched = await prisma.lookupType.findUnique({
            where: { key: lookupKey },
            include: { values: { orderBy: { sortIdx: "asc" } } },
          });
          if (reFetched) return reFetched as LookupData;
        }
      }

      return type as LookupData;
    },
    ["lookups-by-key", key],
    { tags: ["lookups", `lookup-${key}`] }
  )(key);
};

// ابطال کش لوکاپ‌ها پس از تغییر در پنل ادمین
export function invalidateLookupCache(key?: string) {
  try {
    revalidateTag("lookups", "max");
    if (key) {
      revalidateTag(`lookup-${key}`, "max");
    }
    revalidatePath("/", "layout");
  } catch (error) {
    console.error("Error invalidating lookup cache:", error);
  }
}

// گرفتن برچسب فارسی برای یک کد مشخص
export async function getLookupLabel(key: string, code: number, fallback = ""): Promise<string> {
  const lookup = await getCachedLookup(key);
  if (!lookup) return fallback;
  const val = lookup.values.find((v) => v.code === code);
  return val ? val.label : fallback;
}

// گرفتن رنگ برای یک کد مشخص
export async function getLookupColor(key: string, code: number, fallback = ""): Promise<string> {
  const lookup = await getCachedLookup(key);
  if (!lookup) return fallback;
  const val = lookup.values.find((v) => v.code === code);
  return val && val.color ? val.color : fallback;
}

// گرفتن لیست مقادیر فعال برای فرم‌ها و فیلترها
export async function getActiveLookupValues(key: string) {
  const lookup = await getCachedLookup(key);
  if (!lookup) return [];
  return lookup.values.filter((v) => v.isActive);
}
