"use server";

import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { performBackup, performSourceCodeBackup, getActiveDbPath, getBackupBaseDir, resolveBackupPath } from "@/lib/backup";
import { audit } from "@/lib/audit";
import bcrypt from "bcryptjs";

/**
 * بررسی دسترسی ادمین/مدیر پشتیبان‌گیری (شامل ادمین ۱، سرپرست ۲ با دسترسی تنظیمات و سوپرادمین ۴)
 */
async function checkAuth() {
  const session = await getSession();
  if (!session) return false;
  if (session.role === 1 || session.role === 4) return true; // ادمین کل سیستم یا سوپرادمین
  return await hasPerm(session, "backup.manage");
}

/**
 * بررسی دسترسی اختصاصی سوپرادمین (نقش ۴)
 */
async function checkSuperAdmin() {
  const session = await getSession();
  return session?.role === 4;
}

/**
 * دریافت لیست نسخه‌های پشتیبان (مدیر فقط دیتابیس را می‌بیند، سوپرادمین همه را)
 */
export async function getBackupsList() {
  const session = await getSession();
  if (!session || (session.role !== 1 && session.role !== 4 && !(await hasPerm(session, "backup.manage")))) {
    throw new Error("دسترسی غیرمجاز");
  }

  const isSuper = session.role === 4;

  const list = await prisma.backup.findMany({
    where: isSuper ? {} : { backupType: { not: "source_code" } },
    orderBy: { createdAt: "desc" },
  });

  // بررسی وضعیت وجود فیزیکی فایل‌ها روی دیسک
  return list.map((b) => {
    let filePaths;
    try {
      filePaths = JSON.parse(b.filePath);
    } catch {
      filePaths = { db: "", app: "" };
    }

    const dbExists = !!resolveBackupPath(filePaths.db, "db");
    const appExists = !!resolveBackupPath(filePaths.app, "app");

    return {
      ...b,
      dbExists,
      appExists,
    };
  });
}

/**
 * شروع پشتیبان‌گیری دیتابیس (توسط ادمین یا سوپرادمین)
 */
export async function triggerManualBackup() {
  if (!(await checkAuth())) {
    return { error: "دسترسی غیرمجاز" };
  }

  try {
    const backup = await performBackup("manual");
    revalidatePath("/admin/backup");
    return { ok: true, id: backup.id };
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "خطا در ایجاد نسخه پشتیبان دیتابیس";
    return { error: message };
  }
}

/**
 * شروع پشتیبان‌گیری سورس‌کد (منحصراً توسط سوپرادمین)
 */
export async function triggerSourceCodeBackup() {
  if (!(await checkSuperAdmin())) {
    return { error: "دسترسی غیرمجاز. فقط سوپرادمین می‌تواند پشتیبان سورس‌کد تهیه کند." };
  }

  try {
    const backup = await performSourceCodeBackup();
    revalidatePath("/admin/backup");
    return { ok: true, id: backup.id };
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "خطا در ایجاد نسخه پشتیبان سورس‌کد";
    return { error: message };
  }
}

/**
 * حذف فیزیکی و دیتابیسی نسخه پشتیبان
 */
export async function deleteBackup(id: number) {
  const session = await getSession();
  const isSuper = session?.role === 4;
  const isNormalAdmin = session?.role === 1 || (session && await hasPerm(session, "backup.manage"));

  if (!session || (!isSuper && !isNormalAdmin)) {
    return { error: "دسترسی غیرمجاز" };
  }

  try {
    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup) return { error: "پشتیبان یافت نشد" };

    // ممانعت از حذف سورس‌کد توسط غیر از سوپرادمین
    if (backup.backupType === "source_code" && !isSuper) {
      return { error: "دسترسی غیرمجاز. فقط سوپرادمین مجاز به حذف فایل سورس‌کد است." };
    }

    let filePaths;
    try {
      filePaths = JSON.parse(backup.filePath);
    } catch {
      filePaths = { db: "", app: "" };
    }

    // حذف فیزیکی فایل‌ها
    const targetDb = resolveBackupPath(filePaths.db, "db") || filePaths.db;
    if (targetDb && fs.existsSync(targetDb)) fs.unlinkSync(targetDb);

    const targetApp = resolveBackupPath(filePaths.app, "app") || filePaths.app;
    if (targetApp && fs.existsSync(targetApp)) fs.unlinkSync(targetApp);

    // حذف از دیتابیس
    await prisma.backup.delete({ where: { id } });

    // ثبت در لاگ سیستم
    await audit(
      null,
      "backup",
      id,
      "DELETE",
      null,
      {},
      `نسخه پشتیبان به شماره شناسه ${id} حذف شد.`
    );

    revalidatePath("/admin/backup");
    return { ok: true };
  } catch (err: any) {
    console.error(err);
    return { error: err.message || "خطا در حذف نسخه پشتیبان" };
  }
}

/**
 * دریافت تنظیمات زمان‌بندی پشتیبان‌گیری
 */
export async function getBackupSettings() {
  if (!(await checkAuth())) {
    throw new Error("دسترسی غیرمجاز");
  }

  const setting = await prisma.appSetting.findUnique({
    where: { scope_userId_key: { scope: "global", userId: 0, key: "backup_config" } },
  });

  if (!setting) {
    return {
      isEnabled: false,
      schedule: "daily",
      time: "02:00",
    };
  }

  try {
    return JSON.parse(setting.value);
  } catch {
    return {
      isEnabled: false,
      schedule: "daily",
      time: "02:00",
    };
  }
}

/**
 * بروزرسانی تنظیمات زمان‌بندی پشتیبان‌گیری
 */
export async function updateBackupSettings(data: {
  isEnabled: boolean;
  schedule: "daily" | "weekly" | "monthly";
  time: string;
}) {
  if (!(await checkAuth())) {
    return { error: "دسترسی غیرمجاز" };
  }

  try {
    await prisma.appSetting.upsert({
      where: { scope_userId_key: { scope: "global", userId: 0, key: "backup_config" } },
      create: {
        scope: "global",
        userId: 0,
        key: "backup_config",
        value: JSON.stringify(data),
      },
      update: {
        value: JSON.stringify(data),
      },
    });

    // ثبت در لاگ سیستم
    await audit(
      null,
      "backup_config",
      0,
      "UPDATE",
      null,
      data,
      `تنظیمات زمان‌بندی پشتیبان‌گیری بروزرسانی شد: وضعیت ${data.isEnabled ? 'فعال' : 'غیرفعال'}، دوره ${data.schedule}، ساعت ${data.time}`
    );

    revalidatePath("/admin/backup");
    return { ok: true };
  } catch (err: any) {
    console.error(err);
    return { error: err.message || "خطا در ذخیره تنظیمات" };
  }
}

/**
 * بازگردانی (Restore) دیتابیس توسط سوپرادمین
 */
export async function restoreDatabaseAction(formData: FormData) {
  // ۱. بررسی دسترسی سوپرادمین
  const session = await getSession();
  if (!session || session.role !== 4) {
    return { error: "دسترسی غیرمجاز. فقط سوپرادمین مجاز به بازگردانی دیتابیس است." };
  }

  // ۲. احراز هویت با رمز عبور
  const password = String(formData.get("password") ?? "");
  const confirmText = String(formData.get("confirmText") ?? "").trim();
  const mathNum1 = Number(formData.get("mathNum1"));
  const mathNum2 = Number(formData.get("mathNum2"));
  const mathAns = Number(formData.get("mathAns"));
  const backupId = formData.get("backupId") ? Number(formData.get("backupId")) : null;
  const dbFile = formData.get("dbFile") as File | null;

  if (!password) {
    return { error: "رمز عبور سوپرادمین الزامی است." };
  }

  const superAdmin = await prisma.personnel.findUnique({ where: { id: session.id } });
  if (!superAdmin || !superAdmin.passwordHash) {
    return { error: "اطلاعات کاربری سوپرادمین یافت نشد." };
  }

  const isPasswordValid = await bcrypt.compare(password, superAdmin.passwordHash);
  if (!isPasswordValid) {
    return { error: "رمز عبور وارد شده نادرست است." };
  }

  // ۳. بررسی سوال امنیتی ریاضی
  if (isNaN(mathNum1) || isNaN(mathNum2) || isNaN(mathAns) || mathNum1 + mathNum2 !== mathAns) {
    return { error: "پاسخ سوال ریاضی اشتباه است." };
  }

  // ۴. بررسی متن تاییدیه
  if (confirmText !== "تایید بازگردانی") {
    return { error: 'عبارت تاییدیه باید دقیقاً "تایید بازگردانی" باشد.' };
  }

  // ۵. پیدا کردن مسیر فایل بکاپ برای بازگردانی
  let sourceBackupPath = "";

  if (backupId) {
    const backup = await prisma.backup.findUnique({ where: { id: backupId } });
    if (!backup) {
      return { error: "نسخه پشتیبان مورد نظر یافت نشد." };
    }
    if (backup.backupType === "source_code") {
      return { error: "امکان بازگردانی دیتابیس از فایل بکاپ سورس‌کد وجود ندارد." };
    }
    let filePaths;
    try {
      filePaths = JSON.parse(backup.filePath);
    } catch {
      filePaths = {};
    }
    const resolvedDbPath = resolveBackupPath(filePaths.db, "db");
    if (!resolvedDbPath) {
      return { error: "فایل فیزیکی دیتابیس روی سرور یافت نشد." };
    }
    sourceBackupPath = resolvedDbPath;
  } else if (dbFile && dbFile.size > 0) {
    // اگر فایل آپلود شده است، ابتدا آن را موقتاً ذخیره می‌کنیم
    if (!dbFile.name.endsWith(".db")) {
      return { error: "فرمت فایل نامعتبر است. فقط فایل‌های با پسوند db. مجاز هستند." };
    }
    const tempUploadDir = path.join(getBackupBaseDir(), "temp");
    if (!fs.existsSync(tempUploadDir)) {
      fs.mkdirSync(tempUploadDir, { recursive: true });
    }
    const tempFilePath = path.join(tempUploadDir, `restore_upload_${Date.now()}.db`);
    
    // تبدیل File به Buffer و نوشتن روی دیسک
    const buffer = Buffer.from(await dbFile.arrayBuffer());
    fs.writeFileSync(tempFilePath, buffer);
    sourceBackupPath = tempFilePath;
  } else {
    return { error: "لطفاً یک نسخه پشتیبان انتخاب کنید یا فایل بکاپ را آپلود نمایید." };
  }

  // ۶. اجرای عملیات بازگردانی
  try {
    const dbPath = getActiveDbPath();
    const tempBakPath = `${dbPath}.bak`;
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    const tempWalPath = `${walPath}.bak`;

    // بستن اتصالات پریزما برای آزادسازی قفل فایل SQLite
    await prisma.$disconnect();

    // پشتیبان‌گیری موقت از دیتابیس فعلی و فایل‌های WAL
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, tempBakPath);
    }
    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, tempWalPath);
    }

    try {
      // پاکسازی فایل‌های WAL و SHM فعلی قبل از جایگزینی دیتابیس
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

      fs.copyFileSync(sourceBackupPath, dbPath);
      
      // پاک کردن فایل موقت پشتیبان در صورت موفقیت
      if (fs.existsSync(tempBakPath)) {
        fs.unlinkSync(tempBakPath);
      }
      if (fs.existsSync(tempWalPath)) {
        fs.unlinkSync(tempWalPath);
      }
      
      // اگر فایل موقت از آپلود ساخته شده بود، آن را هم پاک می‌کنیم
      if (!backupId && fs.existsSync(sourceBackupPath)) {
        fs.unlinkSync(sourceBackupPath);
      }
    } catch (restoreErr) {
      // بازگردانی فایل پشتیبان موقت در صورت خطا
      if (fs.existsSync(tempBakPath)) {
        fs.copyFileSync(tempBakPath, dbPath);
        fs.unlinkSync(tempBakPath);
      }
      if (fs.existsSync(tempWalPath)) {
        fs.copyFileSync(tempWalPath, walPath);
        fs.unlinkSync(tempWalPath);
      }
      throw restoreErr;
    }

    // متصل کردن مجدد
    await prisma.$connect();

    // ثبت در لاگ سیستم
    await audit(
      null,
      "database",
      0,
      "CONFIRM",
      null,
      { restoredFrom: backupId ? `backup_id_${backupId}` : "uploaded_file" },
      `بازگردانی (Restore) دیتابیس با موفقیت توسط سوپرادمین انجام شد.`
    );

    revalidatePath("/admin/backup");
    return { ok: true };
  } catch (err: any) {
    console.error("[Restore Database Error]:", err);
    // بازگردانی مجدد در صورت قطع ارتباط احتمالی
    await prisma.$connect().catch(() => {});
    return { error: err.message || "خطا در عملیات بازگردانی دیتابیس" };
  }
}
