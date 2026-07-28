"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";

/**
 * بروزرسانی اطلاعات عمومی پروفایل کاربر
 */
export async function updateUserProfile(data: {
  phone1: string;
  phone2: string;
  internalTel: string;
  address: string;
  avatarColor: string;
}) {
  const session = await getSession();
  if (!session) return { error: "کاربر احراز هویت نشده است" };

  try {
    const before = await prisma.personnel.findUnique({ where: { id: session.id } });
    const updated = await prisma.personnel.update({
      where: { id: session.id },
      data: {
        phone1: data.phone1 || null,
        phone2: data.phone2 || null,
        internalTel: data.internalTel || null,
        address: data.address || null,
        avatarColor: data.avatarColor || "#4b5563",
      }
    });

    await audit(
      session,
      "personnel",
      session.id,
      "UPDATE",
      before,
      updated,
      "مشخصات تماس و پروفایل کاربری خود را بروزرسانی کرد."
    );

    revalidatePath("/profile");
    revalidatePath("/phonebook");
    return { ok: true };
  } catch (err: any) {
    console.error(err);
    return { error: err.message || "خطا در بروزرسانی اطلاعات کاربری" };
  }
}

/**
 * بروزرسانی رمز عبور و نام کاربری کاربر
 */
export async function updateUserSecurity(data: {
  userName: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  const session = await getSession();
  if (!session) return { error: "کاربر احراز هویت نشده است" };

  try {
    const user = await prisma.personnel.findUnique({ where: { id: session.id } });
    if (!user) return { error: "کاربر یافت نشد" };

    const updateData: any = {};

    // ۱. بررسی نام کاربری جدید
    if (data.userName && data.userName.trim() !== user.userName) {
      const newUsername = data.userName.trim();
      const exists = await prisma.personnel.findUnique({ where: { userName: newUsername } });
      if (exists) {
        return { error: "این نام کاربری قبلاً توسط شخص دیگری انتخاب شده است" };
      }
      updateData.userName = newUsername;
    }

    // ۲. بررسی تغییر رمز عبور
    if (data.newPassword) {
      if (!data.currentPassword) {
        return { error: "وارد کردن رمز عبور فعلی الزامی است" };
      }
      if (!user.passwordHash) {
        return { error: "حساب کاربری شما فاقد رمز عبور است. لطفاً با ادمین تماس بگیرید." };
      }
      const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isMatch) {
        return { error: "رمز عبور فعلی وارد شده صحیح نیست." };
      }
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return { error: "هیچ تغییری جهت اعمال وارد نشده است." };
    }

    const updated = await prisma.personnel.update({
      where: { id: session.id },
      data: updateData
    });

    await audit(
      session,
      "personnel",
      session.id,
      "UPDATE",
      user,
      updated,
      "اطلاعات امنیتی و رمز عبور خود را تغییر داد."
    );

    revalidatePath("/profile");
    return { ok: true };
  } catch (err: any) {
    console.error(err);
    return { error: err.message || "خطا در بروزرسانی اطلاعات امنیتی" };
  }
}
