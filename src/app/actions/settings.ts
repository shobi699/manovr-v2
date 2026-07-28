"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { setUserSetting } from "@/lib/settings";

// ذخیره‌ی هر کلید تنظیمات شخصی (appearance / depot / table.*)
export async function saveSetting(key: string, value: unknown) {
  const session = await getSession();
  if (!session) return { error: "ابتدا وارد شوید." };
  if (!/^[a-z][a-zA-Z0-9._-]{0,60}$/.test(key)) return { error: "کلید نامعتبر." };
  await setUserSetting(session.id, key, value);
  revalidatePath("/", "layout");
  return {};
}
