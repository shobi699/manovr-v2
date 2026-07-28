"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { getUserPerms } from "@/lib/perms";

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const userName = String(formData.get("userName") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!userName) return { error: "نام کاربری را وارد نمایید." };
  if (!password) return { error: "رمز عبور را وارد نمایید." };

  // نام کاربری حساس به حروف بزرگ/کوچک نیست (مثل نسخه‌ی قدیمی)
  const user = await prisma.personnel.findFirst({
    where: {
      userName: { equals: userName },
      hasAccount: true,
    },
  });

  if (!user || !user.passwordHash) {
    return { error: "نام کاربری یا رمز عبور اشتباه است." };
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "نام کاربری یا رمز عبور اشتباه است." };

  const perms = await getUserPerms(user.id, user.role);
  await createSession({
    id: user.id,
    userName: user.userName!,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
    perms,
  });
  redirect("/depot");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
