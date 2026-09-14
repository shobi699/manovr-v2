/**
 * ابزار تولید پچ به‌روزرسانی برای مدیران سیستم و مهندسان ریلی
 * این اسکریپت فایل‌های تغییریافته را فشرده کرده، هش SHA-256 آن را محاسبه کرده
 * و فایل version.json را به همراه پچ در پوشه اشتراکی شبکه منتشر می‌کند.
 *
 * نحوه استفاده:
 * node scripts/updater/build-patch.js --version 3.2.0 --outDir "\\srvdfs01\Line1\Depo\updates"
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

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
const version = params.version;
const outDir = params.outDir || path.join(process.cwd(), 'dist-patches');
const packageType = params.type || 'patch';

if (!version) {
  console.error('خطا: لطفا نسخه پچ را مشخص کنید. مثال: --version 3.2.0');
  process.exit(1);
}

console.log(`\n========================================`);
console.log(`ساخت بسته پچ بدون اینستالر برای سامانه مانور`);
console.log(`نسخه هدف: ${version}`);
console.log(`دایرکتوری خروجی: ${outDir}`);
console.log(`نوع بسته: ${packageType}`);
console.log(`========================================\n`);

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const patchesSubdir = path.join(outDir, 'patches');
if (!fs.existsSync(patchesSubdir)) {
  fs.mkdirSync(patchesSubdir, { recursive: true });
}

// ایجاد فایل Zip
const zipFileName = `patch-${version}.zip`;
const zipFilePath = path.join(patchesSubdir, zipFileName);
const zip = new AdmZip();

console.log('۱. جمع‌آوری فایل‌های کلیدی نرم‌افزار...');

// افزودن فایل‌های کلیدی که در پچ باید بروز شوند
const filesToInclude = [
  'main.js',
  'preload.js',
  'splash.html',
  'manovr-config.json',
];

filesToInclude.forEach((file) => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    zip.addLocalFile(fullPath);
    console.log(`  + فایل افزوده شد: ${file}`);
  }
});

// افزودن پوشه .next/standalone در صورت وجود
const standalonePath = path.join(process.cwd(), '.next', 'standalone');
if (fs.existsSync(standalonePath)) {
  console.log('  + افزودن خروجی .next/standalone به بسته...');
  zip.addLocalFolder(standalonePath, '.next/standalone');
}

// ذخیره فایل فشرده
console.log('۲. ایجاد و فشرده‌سازی پچ در دیسک...');
zip.writeZip(zipFilePath);
const stat = fs.statSync(zipFilePath);
console.log(`  -> فایل زیپ ساخته شد: ${zipFilePath} (${(stat.size / 1024).toFixed(1)} KB)`);

// محاسبه هش SHA-256
console.log('۳. محاسبه هش امنیتی SHA-256...');
const fileBuffer = fs.readFileSync(zipFilePath);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex').toLowerCase();
console.log(`  -> هش امنیتی: ${sha256}`);

// محاسبه تاریخ شمسی تقریبی
const now = new Date();
const jalaliDateStr = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  calendar: 'persian',
}).format(now);

// ساخت متادیتای version.json
const manifest = {
  version,
  releaseDate: now.toISOString(),
  releaseDateJalali: jalaliDateStr,
  minSupportedVersion: '0.1.0',
  packageType,
  packageFile: `patches/${zipFileName}`,
  sha256,
  fileSizeBytes: stat.size,
  mandatory: false,
  targetPlatform: 'win-x64',
  changelog: {
    highlights: [
      `به‌روزرسانی خودکار به نسخه ${version}`,
      'بهبود کارایی و پایداری موتور مانور',
    ],
    features: [
      'ارتقای امنیت ارتباطات با پایگاه داده شبکه',
    ],
    fixes: [
      'اصلاح گزارش‌ها و راندمان کاربری',
    ],
    breaking: [],
  },
};

const manifestPath = path.join(outDir, 'version.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`۴. مانیفست version.json در مسیر خروجی ثبت گردید: ${manifestPath}`);

console.log(`\nعملیات با موفقیت پایان یافت! پچ آماده استقرار در پوشه اشتراکی شبکه است.\n`);
