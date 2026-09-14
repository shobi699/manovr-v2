/**
 * اسکریپت مستقل (Detached Worker Process) جهت جایگزینی فایل‌ها و پچ بدون نیاز به اینستالر
 * این اسکریپت بیرون از پروسه اصلی اجرا شده، منتظر بسته شدن نرم‌افزار می‌ماند،
 * فایل‌ها را با قابلیت Rollback جایگزین می‌کند و نرم‌افزار را مجدداً بالا می‌آورد.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

// تجزیه پارامترهای خط فرمان
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    params[key] = value;
  }
  return params;
}

const params = parseArgs();
const patchZip = params.patch;
const targetDir = params.targetDir;
const backupDir = params.backupDir;
const waitPid = parseInt(params.waitPid, 10);
const relaunchExe = params.relaunch;
const targetVersion = params.version || 'unknown';

// سیستم لاگ‌گیری ایزوله پچر
const logDir = path.join(process.env.LOCALAPPDATA || process.cwd(), 'ManovrSystem', 'updates');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'patch-audit.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {
    console.error(line);
  }
}

log(`=== آغاز فرآیند به‌روزرسانی بدون اینستالر به نسخه ${targetVersion} ===`);
log(`Patch: ${patchZip} | Target: ${targetDir} | WaitPID: ${waitPid}`);

// بررسی زنده بودن پروسه والد
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// کپی بازگشتی پوشه‌ها جهت پشتیبان‌گیری و ری‌استور
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function main() {
  // ۱. منتظر ماندن برای خاتمه یافتن کامل برنامه اصلی
  log(`در انتظار خروج کامل پروسه ${waitPid}...`);
  let attempts = 0;
  while (isProcessRunning(waitPid) && attempts < 40) {
    await sleep(500);
    attempts++;
  }

  if (isProcessRunning(waitPid)) {
    log(`پروسه ${waitPid} پس از ۲۰ ثانیه هنوز فعال است. خاتمه اجباری...`);
    try {
      process.kill(waitPid, 'SIGKILL');
    } catch (e) {}
    await sleep(1000);
  }

  log('پروسه اصلی با موفقیت خاتمه یافت. قفل فایل‌ها آزاد شد.');

  // ۲. ایجاد نسخه پشتیبان از فایل‌های جاری (Safety Backup)
  try {
    log(`در حال ایجاد پشتیبان از ${targetDir} به ${backupDir}...`);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    copyRecursiveSync(targetDir, backupDir);
    log('پشتیبان‌گیری اولیه با موفقیت انجام شد.');
  } catch (err) {
    log(`خطا در ایجاد پشتیبان: ${err.message}. فرآیند متوقف شد.`);
    relaunchApp();
    process.exit(1);
  }

  // ۳. استخراج و اعمال فایل‌های پچ با AdmZip
  try {
    log(`در حال استخراج پچ از ${patchZip}...`);
    const zip = new AdmZip(patchZip);
    // استخراج و بازنویسی فایل‌ها با حفظ دسترسی‌ها
    zip.extractAllTo(targetDir, true);
    log('استخراج و جایگزینی باینری‌ها و اسکریپت‌ها با موفقیت کامل شد.');

    // ثبت متادیتای نسخه اعمال‌شده
    const installedVersionFile = path.join(targetDir, 'installed-version.json');
    fs.writeFileSync(
      installedVersionFile,
      JSON.stringify({ version: targetVersion, appliedAt: new Date().toISOString() }, null, 2)
    );

    log(`به‌روزرسانی با موفقیت به نسخه ${targetVersion} اعمال گردید.`);
  } catch (err) {
    log(`خطای بحرانی حین استخراج پچ: ${err.message}`);
    log('آغاز فرآیند بازیابی و رول‌بک (Rollback) از نسخه پشتیبان...');
    try {
      copyRecursiveSync(backupDir, targetDir);
      log('رول‌بک با موفقیت انجام شد و برنامه به حالت پایدار قبلی بازگشت.');
    } catch (rbErr) {
      log(`خطا در فرآیند رول‌بک: ${rbErr.message}`);
    }
  }

  // ۴. راه‌اندازی مجدد نرم‌افزار
  relaunchApp();
}

function relaunchApp() {
  if (relaunchExe && fs.existsSync(relaunchExe)) {
    log(`در حال اجرای مجدد نرم‌افزار: ${relaunchExe}`);
    try {
      const child = spawn(relaunchExe, [], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      log('نرم‌افزار با موفقیت راه‌اندازی مجدد شد.');
    } catch (e) {
      log(`خطا در راه‌اندازی مجدد: ${e.message}`);
    }
  } else {
    log(`مسیر فایل اجرایی یافت نشد: ${relaunchExe}`);
  }

  // حذف فایل موقت پچ
  try {
    if (fs.existsSync(patchZip)) fs.unlinkSync(patchZip);
  } catch (e) {}

  log('پایان ماموریت اسکریپت پچر.');
  process.exit(0);
}

main();
