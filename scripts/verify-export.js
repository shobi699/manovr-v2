const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const exportDir = path.join(rootDir, 'export');
const appDir = path.join(exportDir, 'ManovrSystem');

console.log('====================================================');
console.log('بررسی و اعتبارسنجی پکیج خروجی سامانه مانور (Manovr)');
console.log('====================================================\n');

let issues = [];

if (!fs.existsSync(exportDir)) {
  console.error('Error: export directory not found!');
  process.exit(1);
}

if (!fs.existsSync(appDir)) {
  console.error('Error: export/ManovrSystem directory not found!');
  process.exit(1);
}

function scanRecursive(dir, collector = { tsFiles: [], mapFiles: [], aiFiles: [], forbiddenFiles: [], srcDirs: [] }) {
  const elements = fs.readdirSync(dir);
  for (const element of elements) {
    const fullPath = path.join(dir, element);
    const stat = fs.lstatSync(fullPath);
    const lower = element.toLowerCase();

    if (stat.isDirectory()) {
      if (lower === 'src') {
        collector.srcDirs.push(fullPath);
      }
      scanRecursive(fullPath, collector);
    } else {
      const ext = path.extname(element).toLowerCase();
      if (ext === '.ts' || ext === '.tsx' || ext === '.tsbuildinfo') {
        collector.tsFiles.push(fullPath);
      }
      if (ext === '.map') {
        collector.mapFiles.push(fullPath);
      }
      if (
        lower === 'skills-lock.json' ||
        lower === 'vibe.config.json' ||
        lower === 'agent.md' ||
        lower === 'agents.md' ||
        lower === 'claude.md' ||
        lower === 'vibe.md'
      ) {
        collector.aiFiles.push(fullPath);
      }
    }
  }
  return collector;
}

const scanResults = scanRecursive(appDir);

// بررسی تمیز بودن ریشه export/ManovrSystem از اسکریپت‌ها و فایل‌های متنی زائد
const rootElements = fs.readdirSync(appDir);
rootElements.forEach(f => {
  const ext = path.extname(f).toLowerCase();
  if (['.bat', '.ps1', '.sh', '.md', '.markdown', '.txt'].includes(ext) || f === 'scripts') {
    scanResults.forbiddenFiles.push(path.join(appDir, f));
  }
});

console.log(`۱. شمارش فایل‌های سورس‌کد خام (.ts / .tsx): ${scanResults.tsFiles.length}`);
if (scanResults.tsFiles.length > 0) {
  issues.push(`یافت شدن ${scanResults.tsFiles.length} فایل سورس‌کد در پوشه ManovrSystem!`);
  console.log('نمونه فایل‌های سورس یافت‌شده:', scanResults.tsFiles.slice(0, 5));
} else {
  console.log('   [PASS] هیچ فایل سورس‌کدی در پوشه برنامه وجود ندارد.');
}

console.log(`\n۲. شمارش فایل‌های نقشه منبع (.map): ${scanResults.mapFiles.length}`);
if (scanResults.mapFiles.length > 0) {
  issues.push(`یافت شدن ${scanResults.mapFiles.length} فایل سورس‌مپ!`);
} else {
  console.log('   [PASS] هیچ سورس‌مپی وجود ندارد.');
}

console.log(`\n۳. بررسی پوشه خام src: ${scanResults.srcDirs.length}`);
if (scanResults.srcDirs.length > 0) {
  issues.push('پوشه خام src در پکیج یافت شد!');
} else {
  console.log('   [PASS] پوشه src به طور کامل حذف شده است.');
}

console.log(`\n۴. شمارش فایل‌های نشانه‌گذاری AI: ${scanResults.aiFiles.length}`);
if (scanResults.aiFiles.length > 0) {
  issues.push(`یافت شدن ${scanResults.aiFiles.length} فایل متادیتای هوش مصنوعی!`);
} else {
  console.log('   [PASS] هیچ نشانه یا متادیتایی از هوش مصنوعی در پکیج وجود ندارد.');
}

console.log(`\n۵. بررسی فایل‌های متفرقه/اسکریپت در ریشه ManovrSystem: ${scanResults.forbiddenFiles.length}`);
if (scanResults.forbiddenFiles.length > 0) {
  issues.push(`یافت شدن اسکریپت‌ها یا فایل‌های متفرقه در ریشه ManovrSystem: ${scanResults.forbiddenFiles.join(', ')}`);
} else {
  console.log('   [PASS] پوشه برنامه کاملاً تمیز و استاندارد است.');
}

// بررسی فایل‌های حیاتی اجرایی برنامه
console.log('\n۶. بررسی فایل‌های حیاتی اجرایی برنامه:');
const requiredFiles = [
  path.join(appDir, 'ManovrSystem.exe'),
  path.join(appDir, 'manovr-config.json'),
  path.join(appDir, 'resources', 'app.asar'),
  path.join(appDir, 'resources', 'dev.db')
];

let allRequiredExist = true;
requiredFiles.forEach(f => {
  const exists = fs.existsSync(f);
  console.log(`   - ${path.basename(f)}: ${exists ? '[موجود است]' : '[یافت نشد!]'}`);
  if (!exists) allRequiredExist = false;
});

if (!allRequiredExist) {
  issues.push('برخی فایل‌های کلیدی اجرایی در پوشه ManovrSystem وجود ندارند.');
}

console.log('\n====================================================');
if (issues.length === 0) {
  console.log('نتیجه ممیزی: تایید ۱۰۰٪ — پکیج خروجی کاملاً پاکسازی و امن شده است.');
  process.exit(0);
} else {
  console.error('نتیجه ممیزی: عدم تایید — موارد زیر نیازمند اصلاح است:');
  issues.forEach(iss => console.error(` - ${iss}`));
  process.exit(1);
}
