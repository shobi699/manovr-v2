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
