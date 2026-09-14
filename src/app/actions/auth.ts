"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { getUserPerms } from "@/lib/perms";
import { toEnglishDigits } from "@/lib/digits";

interface AttemptRecord {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, AttemptRecord>();

/**
 * محافظت در برابر حملات جستجوی فراگیر (Brute-Force Rate Limiter)
 * حداکثر ۵ تلاش ناموفق در هر ۳ دقیقه به ازای هر نام کاربری
 */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now > record.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + 3 * 60 * 1000 });
    return true;
  }
  if (record.count >= 5) {
    return false;
  }
  record.count++;
  return true;
}

function resetRateLimit(key: string) {
  loginAttempts.delete(key);
}

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const rawUserName = String(formData.get("userName") ?? "").trim();
  const rawPassword = String(formData.get("password") ?? "");

  if (!rawUserName) return { error: "نام کاربری یا کد پرسنلی را وارد نمایید." };
  if (!rawPassword) return { error: "رمز عبور را وارد نمایید." };

  const normUserName = toEnglishDigits(rawUserName);
  const normPassword = toEnglishDigits(rawPassword);
  const rateLimitKey = normUserName.toLowerCase();

  if (!checkRateLimit(rateLimitKey)) {
    return {
      error: "تعداد تلاش‌های ناموفق بیش از حد مجاز است. به منظور حفظ امنیت، لطفاً ۳ دقیقه دیگر مجدداً تلاش نمایید.",
    };
  }

  try {
    // ۱. جستجوی مستقیم بر اساس نام کاربری یا کد پرسنلی (با ارقام فارسی و انگلیسی)
    let user = await prisma.personnel.findFirst({
      where: {
        hasAccount: true,
        OR: [
          { userName: { equals: rawUserName } },
          { userName: { equals: normUserName } },
          { personnelCode: { equals: rawUserName } },
          { personnelCode: { equals: normUserName } },
        ],
      },
    });

    // ۲. جستجوی بدون حساسیت به حروف بزرگ/کوچک (Case-Insensitive) در صورت عدم تطابق دقیق
    if (!user) {
      const candidates = await prisma.personnel.findMany({
        where: { hasAccount: true },
      });
      user =
        candidates.find((c) => {
          const u = (c.userName || "").toLowerCase().trim();
          const p = (c.personnelCode || "").toLowerCase().trim();
          const target = rawUserName.toLowerCase().trim();
          const targetNorm = normUserName.toLowerCase().trim();
          return u === target || u === targetNorm || p === target || p === targetNorm;
        }) || null;
    }

    // ۳. در صورت عدم تطابق یا غیرفعال بودن حساب، پیام خطای یکنواخت امنیتی بازمی‌گردد
    if (!user) {
      return { error: "نام کاربری یا رمز عبور اشتباه است." };
    }

    // ۴. بررسی رمز عبور (پشتیبانی از ارقام فارسی و انگلیسی و رمز پیش‌فرض ۱۲۳۴۵۶)
    let ok = false;
    if (user.passwordHash) {
      ok = await bcrypt.compare(rawPassword, user.passwordHash);
      if (!ok && rawPassword !== normPassword) {
        ok = await bcrypt.compare(normPassword, user.passwordHash);
      }
    } else {
      // در صورتی که کاربر حساب فعال دارد اما پسورد هش هنوز ثبت نشده باشد،
      // با رمز پیش‌فرض ۱۲۳۴۵۶ اجازه ورود داده و هش را در پایگاه داده ذخیره می‌کنیم
      if (rawPassword === "123456" || normPassword === "123456") {
        ok = true;
        const newHash = await bcrypt.hash("123456", 10);
        await prisma.personnel.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        });
      }
    }

    if (!ok) {
      return { error: "نام کاربری یا رمز عبور اشتباه است." };
    }

    // بازنشانی شمارنده تلاش‌های ناموفق پس از لاگین موفقیت‌آمیز
    resetRateLimit(rateLimitKey);

    const perms = await getUserPerms(user.id, user.role);
    await createSession({
      id: user.id,
      userName: user.userName || user.personnelCode || `user_${user.id}`,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      perms,
    });

    redirect("/depot");
  } catch (err: any) {
    if (err?.digest?.startsWith("NEXT_REDIRECT") || err?.message?.includes("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("[loginAction] Database/network error:", err);
    return {
      error: "خطا در برقراری ارتباط با پایگاه داده. لطفاً وضعیت شبکه و اتصال به سرور دپو را بررسی فرمایید.",
    };
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
