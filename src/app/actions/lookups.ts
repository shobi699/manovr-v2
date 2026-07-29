"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { invalidateLookupCache } from "@/lib/lookups";
import { audit } from "@/lib/audit";
import { lookupSummary } from "@/lib/audit-summaries";
import { emitSSEEvent } from "@/lib/events";
import { safeAccentColor, safeLogoImage, safeText } from "@/lib/branding";

// دریافت لیست تمام دسته‌بندی‌های لوکاپ
export async function getLookupTypes() {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "lookups.manage"))) {
    return { ok: false, error: "عدم دسترسی کافی" };
  }

  try {
    const types = await prisma.lookupType.findMany({
      include: {
        values: {
          orderBy: { sortIdx: "asc" },
        },
      },
    });
    return { ok: true, data: types };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در دریافت اطلاعات" };
  }
}

// ثبت یا ویرایش یک مقدار در جدول لوکاپ
export async function saveLookupValue(data: {
  typeId: number;
  code: number;
  label: string;
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
  sortIdx: number;
  meta?: string | null;
}) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "lookups.manage"))) {
    return { ok: false, error: "عدم دسترسی کافی" };
  }

  try {
    const type = await prisma.lookupType.findUnique({
      where: { id: data.typeId },
    });
    if (!type) return { ok: false, error: "دسته بندی یافت نشد" };

    const existingVal = await prisma.lookupValue.findUnique({
      where: {
        typeId_code: {
          typeId: data.typeId,
          code: data.code,
        },
      },
    });

    const updateData: any = {
      label: data.label,
      color: data.color ?? null,
      icon: data.icon ?? null,
      isActive: data.isActive,
      sortIdx: data.sortIdx,
    };
    if (data.meta !== undefined) {
      updateData.meta = data.meta ?? "{}";
    }

    const upserted = await prisma.lookupValue.upsert({
      where: {
        typeId_code: {
          typeId: data.typeId,
          code: data.code,
        },
      },
      update: updateData,
      create: {
        typeId: data.typeId,
        code: data.code,
        label: data.label,
        color: data.color ?? null,
        icon: data.icon ?? null,
        isActive: data.isActive,
        sortIdx: data.sortIdx,
        meta: data.meta ?? "{}",
      },
    });

    invalidateLookupCache(type.key);

    await audit(
      session,
      "lookup_value",
      upserted.code,
      existingVal ? "UPDATE" : "CREATE",
      existingVal,
      upserted,
      lookupSummary(existingVal ? "ویرایش" : "ثبت", upserted.label)
    );

    return { ok: true, data: upserted };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در ثبت تغییرات" };
  }
}

// حذف فیزیکی یک مقدار در جدول لوکاپ با بررسی وابستگی‌ها
export async function deleteLookupValue(typeId: number, code: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "lookups.manage"))) {
    return { ok: false, error: "عدم دسترسی کافی" };
  }

  try {
    const type = await prisma.lookupType.findUnique({
      where: { id: typeId },
    });
    if (!type) return { ok: false, error: "دسته بندی یافت نشد" };

    if (type.key === "terminal") {
      const lineUsing = await prisma.line.findFirst({
        where: { terminal: code },
      });
      if (lineUsing) {
        return { ok: false, error: "امکان حذف وجود ندارد؛ ریل‌هایی به این ترمینال متصل هستند." };
      }
    }

    const before = await prisma.lookupValue.findUnique({
      where: {
        typeId_code: {
          typeId,
          code,
        },
      },
    });

    await prisma.lookupValue.delete({
      where: {
        typeId_code: {
          typeId,
          code,
        },
      },
    });

    invalidateLookupCache(type.key);

    await audit(
      session,
      "lookup_value",
      code,
      "DELETE",
      before,
      null,
      lookupSummary("حذف", before?.label || String(code))
    );
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در حذف مقدار" };
  }
}

// ذخیره تنظیمات برندینگ سامانه
export async function saveBrandingSettings(settings: {
  title: string;
  footer: string;
  logoIcon: string;
  logoType: "icon" | "image";
  logoImage: string;
  accentColor: string;
  announcementText: string;
  announcementKind: "info" | "success" | "warning" | "alert";
  announcementActive: boolean;
}) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "branding.manage"))) {
    return { ok: false, error: "عدم دسترسی کافی" };
  }

  try {
    const beforeSettings = await getBrandingSettings();

    // مقادیر ورودی از سمت کلاینت می‌آیند و نوع TypeScript تضمینی ایجاد نمی‌کند
    const safeSettings = {
      title: safeText(settings.title, 120),
      footer: safeText(settings.footer, 200),
      logoIcon: safeText(settings.logoIcon, 8),
      logoType: settings.logoType === "image" ? "image" : "icon",
      logoImage: safeLogoImage(settings.logoImage),
      accentColor: safeAccentColor(settings.accentColor),
      announcementText: safeText(settings.announcementText, 500),
      announcementKind: (["info", "success", "warning", "alert"] as const).includes(
        settings.announcementKind
      )
        ? settings.announcementKind
        : "info",
      announcementActive: settings.announcementActive === true,
    };

    await prisma.appSetting.upsert({
      where: {
        scope_userId_key: {
          scope: "global",
          userId: 0,
          key: "branding",
        },
      },
      update: {
        value: JSON.stringify(safeSettings),
      },
      create: {
        scope: "global",
        userId: 0,
        key: "branding",
        value: JSON.stringify(safeSettings),
      },
    });

    // ثبت در لاگ وقایع
    await audit(
      session,
      "branding",
      0,
      "UPDATE",
      beforeSettings,
      safeSettings,
      `بروزرسانی برندینگ سامانه: عنوان: ${safeSettings.title}، رنگ تم: ${safeSettings.accentColor}`
    );

    // ارسال لایو اعلان تغییرات برندینگ از طریق SSE
    emitSSEEvent("branding_changed", safeSettings);

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || "خطا در ذخیره‌سازی تنظیمات برندینگ" };
  }
}

// خواندن تنظیمات برندینگ سامانه
export async function getBrandingSettings() {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: {
        scope_userId_key: {
          scope: "global",
          userId: 0,
          key: "branding",
        },
      },
    });
    if (setting) {
      const data = JSON.parse(setting.value);
      return {
        title: safeText(data.title, 120) || "سامانه مدیریت مانور",
        footer: safeText(data.footer, 200) || "پایانه فتح‌آباد · v3",
        logoIcon: safeText(data.logoIcon, 8) || "🚇",
        logoType: (data.logoType === "image" ? "image" : "icon") as "image" | "icon",
        logoImage: safeLogoImage(data.logoImage),
        accentColor: safeAccentColor(data.accentColor),
        announcementText: safeText(data.announcementText, 500),
        announcementKind: (["info", "success", "warning", "alert"] as const).includes(
          data.announcementKind
        )
          ? data.announcementKind
          : "info",
        announcementActive: data.announcementActive === true,
      };
    }
  } catch {}
  
  // مقادیر پیش‌فرض
  return {
    title: "سامانه مدیریت مانور",
    footer: "پایانه فتح‌آباد · v3",
    logoIcon: "🚇",
    logoType: "icon" as "image" | "icon",
    logoImage: "",
    accentColor: "#d8842a",
    announcementText: "",
    announcementKind: "info" as "info" | "success" | "warning" | "alert",
    announcementActive: false,
  };
}
