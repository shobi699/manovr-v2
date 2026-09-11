"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { setUserSetting, getOfflinePolicy, setOfflinePolicy, OfflinePolicy } from "@/lib/settings";
import { hasPerm } from "@/lib/perms";
import { audit } from "@/lib/audit";

// ذخیره‌ی هر کلید تنظیمات شخصی (appearance / depot / table.*)
export async function saveSetting(key: string, value: unknown) {
  const session = await getSession();
  if (!session) return { error: "ابتدا وارد شوید." };
  if (!/^[a-z][a-zA-Z0-9._-]{0,60}$/.test(key)) return { error: "کلید نامعتبر." };
  await setUserSetting(session.id, key, value);
  revalidatePath("/", "layout");
  return {};
}

// ذخیره سیاست رفتار سامانه در زمان قطعی ارتباط با سرور دپو
export async function saveOfflinePolicyAction(policy: OfflinePolicy): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "ابتدا وارد شوید." };
  if (!(await hasPerm(session, "branding.manage")) && session.role !== 1 && session.role !== 4) {
    return { error: "دسترسی ندارید. فقط مدیران سیستم مجاز به تغییر سیاست شبکه هستند." };
  }

  if (policy !== "auto_sync" && policy !== "read_only") {
    return { error: "سیاست انتخاب‌شده معتبر نیست." };
  }

  const prevPolicy = await getOfflinePolicy();
  await setOfflinePolicy(policy, session.fullName || session.userName);

  await audit(
    session,
    "settings",
    0,
    "UPDATE",
    { offlinePolicy: prevPolicy },
    { offlinePolicy: policy },
    `تغییر سیاست قطعی شبکه به «${policy === "auto_sync" ? "همگام‌سازی هوشمند آفلاین" : "حالت فقط مشاهده"}»`
  );

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function getOfflinePolicyAction(): Promise<OfflinePolicy> {
  return await getOfflinePolicy();
}
