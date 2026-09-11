import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/**
 * مسیر فایل فعال دیتابیس (SQLite)
 */
export function getActiveDbPath(): string {
  if (process.env.DATABASE_URL) {
    const raw = process.env.DATABASE_URL.replace(/^file:/, "");
    if (path.isAbsolute(raw) || raw.startsWith("\\\\") || raw.startsWith("//")) return raw;
    return path.resolve(process.cwd(), raw);
  }
  return path.join(process.cwd(), "prisma", "dev.db");
}

/**
 * مسیر پوشه ذخیره‌سازی نسخه‌های پشتیبان
 */
export function getBackupBaseDir(): string {
  const dbPath = getActiveDbPath();
  const dbDir = path.dirname(dbPath);
  if (path.basename(dbDir).toLowerCase() === "database") {
    return path.join(path.dirname(dbDir), "backups");
  }
  return path.join(process.cwd(), "backups");
}

/**
 * بازیابی مسیر فیزیکی فایل پشتیبان با قابلیت Fallback به پوشه جاری در حالت پرتابل
 */
export function resolveBackupPath(storedPath: string | null | undefined, fileType: "db" | "app"): string | null {
  if (!storedPath) return null;
  if (fs.existsSync(storedPath)) return storedPath;
  const fallback = path.join(getBackupBaseDir(), fileType, path.basename(storedPath));
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

/**
 * ایجاد فایل پشتیبان فقط از دیتابیس (SQLite)
 */
export async function performBackup(backupType: "manual" | "scheduled", schedule?: string) {
  const baseDir = getBackupBaseDir();
  const dbBackupDir = path.join(baseDir, "db");

  // ایجاد دایرکتوری‌ها
  if (!fs.existsSync(dbBackupDir)) fs.mkdirSync(dbBackupDir, { recursive: true });

  const timestamp = new Date().toLocaleString("fa-IR", { hour12: false })
    .replace(/[\/\s:]/g, "-");
  
  // ۱. پشتیبان‌گیری از دیتابیس
  const dbSource = getActiveDbPath();
  const dbFilename = `db_backup_${timestamp}.db`;
  const dbDestPath = path.join(dbBackupDir, dbFilename);
  
  if (fs.existsSync(dbSource)) {
    fs.copyFileSync(dbSource, dbDestPath);
  } else {
    throw new Error(`فایل دیتابیس در مسیر ${dbSource} یافت نشد.`);
  }

  const dbSize = fs.statSync(dbDestPath).size;

  // ثبت در دیتابیس
  const backupRecord = await prisma.backup.create({
    data: {
      filename: `db: ${dbFilename}`,
      filePath: JSON.stringify({ db: dbDestPath }),
      fileSize: dbSize,
      backupType,
      schedule: schedule || null,
    }
  });

  // ثبت در لاگ سیستم
  await audit(
    null,
    "backup",
    backupRecord.id,
    "CONFIRM",
    null,
    { db: dbFilename, size: dbSize },
    `پشتیبان‌گیری دیتابیس (${backupType === "manual" ? "دستی" : "خودکار " + schedule}) با موفقیت اجرا و ذخیره شد.`
  );

  return backupRecord;
}

/**
 * ایجاد پشتیبان اختصاصی از سورس‌کد پروژه (مخصوص سوپرادمین)
 */
export async function performSourceCodeBackup() {
  const baseDir = getBackupBaseDir();
  const appBackupDir = path.join(baseDir, "app");

  if (!fs.existsSync(appBackupDir)) fs.mkdirSync(appBackupDir, { recursive: true });

  const timestamp = new Date().toLocaleString("fa-IR", { hour12: false })
    .replace(/[\/\s:]/g, "-");

  const appFilename = `app_backup_${timestamp}.zip`;
  const appDestPath = path.join(appBackupDir, appFilename);

  const zip = new AdmZip();
  const cwd = process.cwd();
  const srcDir = path.join(/*turbopackIgnore: true*/ cwd, "src");
  const publicDir = path.join(/*turbopackIgnore: true*/ cwd, "public");
  const prismaSchema = path.join(/*turbopackIgnore: true*/ cwd, "prisma", "schema.prisma");

  if (fs.existsSync(srcDir)) zip.addLocalFolder(srcDir, "src");
  if (fs.existsSync(publicDir)) zip.addLocalFolder(publicDir, "public");
  if (fs.existsSync(prismaSchema)) zip.addLocalFile(prismaSchema, "prisma");

  // فایل‌های پیکربندی کلیدی پروژه (بدون .env — کلید امضای نشست نباید در پشتیبان قرار گیرد)
  const configFiles = ["package.json", "package-lock.json", "tsconfig.json", "next.config.ts"];
  configFiles.forEach(file => {
    const filePath = path.join(/*turbopackIgnore: true*/ cwd, file);
    if (fs.existsSync(filePath)) {
      zip.addLocalFile(filePath);
    }
  });

  zip.writeZip(appDestPath);

  const appSize = fs.statSync(appDestPath).size;

  // ثبت در دیتابیس با نوع ویژه source_code
  const backupRecord = await prisma.backup.create({
    data: {
      filename: `app: ${appFilename}`,
      filePath: JSON.stringify({ app: appDestPath }),
      fileSize: appSize,
      backupType: "source_code",
      schedule: null,
    }
  });

  // ثبت در لاگ سیستم
  await audit(
    null,
    "backup",
    backupRecord.id,
    "CONFIRM",
    null,
    { app: appFilename, size: appSize },
    `پشتیبان‌گیری از سورس‌کد برنامه با موفقیت ایجاد و ذخیره شد.`
  );

  return backupRecord;
}

/**
 * بررسی و اجرای زمان‌بندی پشتیبان‌گیری خودکار دیتابیس
 */
export async function checkAndRunScheduledBackup() {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { scope_userId_key: { scope: "global", userId: 0, key: "backup_config" } }
    });
    if (!setting) return;
    
    const config = JSON.parse(setting.value);
    if (!config.isEnabled) return;

    const now = new Date();
    const tehranTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tehran" }));
    const currentHour = tehranTime.getHours();
    const currentMinute = tehranTime.getMinutes();

    // زمان اجرای پیش‌فرض ساعت ۰۲:۰۰ صبح
    const [targetHour, targetMinute] = (config.time || "02:00").split(":").map(Number);
    
    // فقط در محدوده ساعت و دقیقه زمان‌بندی‌شده بررسی را انجام بده (تا ۵ دقیقه تلورانس)
    if (currentHour !== targetHour || Math.abs(currentMinute - (targetMinute || 0)) > 5) return;

    // دریافت آخرین بکاپ خودکار از همان زمان‌بندی
    const lastBackup = await prisma.backup.findFirst({
      where: { backupType: "scheduled", schedule: config.schedule },
      orderBy: { createdAt: "desc" }
    });

    let shouldBackup = false;
    if (!lastBackup) {
      shouldBackup = true;
    } else {
      const diffMs = now.getTime() - lastBackup.createdAt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // با توجه به فرکانس زمان‌بندی، فاصه آخرین زمان اجرا بررسی می‌شود
      if (config.schedule === "daily" && diffHours >= 20) {
        shouldBackup = true;
      } else if (config.schedule === "weekly" && diffHours >= 24 * 6) {
        shouldBackup = true;
      } else if (config.schedule === "monthly" && diffHours >= 24 * 27) {
        shouldBackup = true;
      }
    }

    if (shouldBackup) {
      // قفل توزیع‌شده در دیتابیس مشترک تا سایر کلاینت‌ها هم‌زمان اقدام به تهیه بکاپ نکنند
      const lockKey = `scheduled_backup_lock_${config.schedule}`;
      const lockSetting = await prisma.appSetting.findUnique({
        where: { scope_userId_key: { scope: "global", userId: 0, key: lockKey } }
      });
      if (lockSetting) {
        const lockTime = Number(lockSetting.value);
        if (Date.now() - lockTime < 1000 * 60 * 15) {
          // کلاینت دیگری در شبکه اخیراً بکاپ را آغاز کرده است
          return;
        }
      }
      await prisma.appSetting.upsert({
        where: { scope_userId_key: { scope: "global", userId: 0, key: lockKey } },
        create: { scope: "global", userId: 0, key: lockKey, value: String(Date.now()) },
        update: { value: String(Date.now()) },
      });

      console.log(`[Scheduler] Automatic scheduled backup started (${config.schedule})...`);
      await performBackup("scheduled", config.schedule);
    }
  } catch (err) {
    console.error("[Scheduler] Failed automatic backup task:", err);
  }
}
