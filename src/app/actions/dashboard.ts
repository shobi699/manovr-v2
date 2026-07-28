"use server";

// Trigger TS server reload
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function getDashboardLayout() {
  const session = await getSession();
  if (!session) return null;

  try {
    // ۱. بررسی چیدمان شخصی کاربر
    let layout = await prisma.dashboardLayout.findFirst({
      where: { scope: "user", userId: session.id },
    });

    // ۲. بررسی چیدمان نقش در صورت عدم وجود چیدمان شخصی
    if (!layout) {
      layout = await prisma.dashboardLayout.findFirst({
        where: { scope: "role", roleId: session.role },
      });
    }

    // ۳. بررسی چیدمان پیش‌فرض عمومی سیستم
    if (!layout) {
      layout = await prisma.dashboardLayout.findFirst({
        where: { scope: "default" },
      });
    }

    return layout ? JSON.parse(layout.layout) : null;
  } catch (error) {
    console.error("Failed to load dashboard layout:", error);
    return null;
  }
}

export async function saveDashboardLayoutAction(layoutData: any, scope: "user" | "role" | "default" = "user") {
  const session = await getSession();
  if (!session) return { error: "ابتدا وارد شوید." };

  const userId = scope === "user" ? session.id : null;
  const roleId = scope === "role" ? session.role : null;

  try {
    const layoutJson = JSON.stringify(layoutData);

    const existing = await prisma.dashboardLayout.findFirst({
      where: {
        scope,
        userId,
        roleId,
      },
    });

    if (existing) {
      await prisma.dashboardLayout.update({
        where: { id: existing.id },
        data: { layout: layoutJson },
      });
    } else {
      await prisma.dashboardLayout.create({
        data: {
          scope,
          userId,
          roleId,
          layout: layoutJson,
        },
      });
    }

    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
