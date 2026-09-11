const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = 'D:/manovr-build-dist';
const unpackedDir = path.join(distDir, 'win-unpacked');
const tempDir = 'D:/manovr-temp';

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
process.env.TEMP = tempDir;
process.env.TMP = tempDir;

function cleanFilePattern(dir, extensions, termsToExclude = []) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);
    if (stat.isDirectory()) {
      cleanFilePattern(filePath, extensions, termsToExclude);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (extensions.includes(ext)) {
        let matchesExclude = false;
        for (const term of termsToExclude) {
          if (file.toLowerCase().includes(term.toLowerCase())) {
            matchesExclude = true;
            break;
          }
        }
        if (!matchesExclude) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {}
        }
      }
    }
  });
}

function cleanUnusedLocales(localesDir) {
  if (!fs.existsSync(localesDir)) return;
  const allowedLocales = ['fa.pak', 'en-us.pak', 'en-gb.pak'];
  fs.readdirSync(localesDir).forEach(file => {
    if (file.endsWith('.pak')) {
      if (!allowedLocales.includes(file.toLowerCase())) {
        try {
          fs.unlinkSync(path.join(localesDir, file));
        } catch (e) {}
      }
    }
  });
}

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    try {
      const stat = fs.lstatSync(fromPath);
      if (stat.isDirectory()) {
        copyFolderSync(fromPath, toPath);
      } else {
        fs.copyFileSync(fromPath, toPath);
      }
    } catch (e) {}
  });
}

function runCommand(cmd) {
  console.log(`Running: ${cmd}`);
  execSync(cmd, {
    stdio: 'inherit',
    cwd: rootDir,
    env: { ...process.env, TEMP: tempDir, TMP: tempDir }
  });
}

function build() {
  const isExportOnly = process.argv.includes('--export-only');
  try {
    const exportDir = path.join(rootDir, 'export');

    if (!isExportOnly) {
      console.log('1. Cleaning old build directories and packages...');
      // Kill any running Manovr processes first to avoid file lock errors
      try {
        execSync('taskkill /f /fi "IMAGENAME eq Manovr*"', { stdio: 'ignore' });
        execSync('taskkill /f /im ManovrSystem.exe', { stdio: 'ignore' });
      } catch (e) {}

    // Delete exe, zip, rar from root
    fs.readdirSync(rootDir).forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (['.exe', '.zip', '.rar'].includes(ext) || file.startsWith('query_engine-windows.dll.node.tmp')) {
        try {
          fs.unlinkSync(path.join(rootDir, file));
          console.log(`Deleted root file: ${file}`);
        } catch (e) {}
      }
    });

    // Delete standalone exe and build folder
    if (fs.existsSync(path.join(rootDir, '.next'))) {
      fs.rmSync(path.join(rootDir, '.next'), { recursive: true, force: true });
    }
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }

    const exportDir = path.join(rootDir, 'export');
    if (fs.existsSync(exportDir)) {
      try {
        fs.rmSync(exportDir, { recursive: true, force: true });
        console.log('Cleaned old export directory at start of build.');
      } catch (e) {
        console.warn('Could not fully clean export directory:', e.message);
      }
    }

    console.log('2. Running Next.js build...');
    runCommand('npm run build');

    console.log('3. Running copy-assets.js...');
    runCommand('node scripts/copy-assets.js');

    console.log('4. Running electron-builder --dir (unpacked)...');
    runCommand('npx electron-builder --dir');

    console.log('5. Optimizing win-unpacked directory...');
    // Delete LICENSES.chromium.html
    const licenseFile = path.join(unpackedDir, 'LICENSES.chromium.html');
    if (fs.existsSync(licenseFile)) {
      fs.unlinkSync(licenseFile);
      console.log('Deleted LICENSES.chromium.html');
    }

    // Clean locales
    const localesDir = path.join(unpackedDir, 'locales');
    cleanUnusedLocales(localesDir);
    console.log('Cleaned unused Chromium locales.');

    console.log('6. Packaging optimized installers with electron-builder...');
    runCommand(`npx electron-builder --prepackaged "${unpackedDir}"`);
  }

  console.log('7. Copying final packages to root directory and export folder...');
    // Stop any running processes to prevent file locks
    try {
      execSync('taskkill /f /fi "IMAGENAME eq Manovr*"', { stdio: 'ignore' });
      execSync('taskkill /f /im ManovrSystem.exe', { stdio: 'ignore' });
    } catch (e) {}

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // کپی فایل‌های نصبی و پرتابل به ریشه و پوشه export
    fs.readdirSync(distDir).forEach(file => {
      if (file.endsWith('.exe')) {
        const src = path.join(distDir, file);
        const dest = path.join(rootDir, file);
        if (fs.existsSync(dest)) {
          try {
            fs.unlinkSync(dest);
          } catch (e) {}
        }
        fs.copyFileSync(src, dest);
        console.log(`Copied package to root: ${file}`);

        const exportDest = path.join(exportDir, file);
        if (fs.existsSync(exportDest)) {
          try {
            fs.unlinkSync(exportDest);
          } catch (e) {}
        }
        fs.copyFileSync(src, exportDest);
        console.log(`Copied package to export folder: ${file}`);
      }
    });

    // کپی پوشه بازشده/نصب‌شده آماده (win-unpacked) به پوشه export برای کپی مستقیم در شبکه
    const exportUnpackedDir = path.join(exportDir, 'ManovrSystem');
    if (fs.existsSync(unpackedDir)) {
      console.log('Copying unpacked installation folder to export/ManovrSystem...');
      copyFolderSync(unpackedDir, exportUnpackedDir);
      console.log('Copied unpacked application folder to export/ManovrSystem successfully.');
    }

    // کپی manovr-config.json به پوشه export و داخل پوشه ManovrSystem
    const configSrc = path.join(rootDir, 'manovr-config.json');
    if (fs.existsSync(configSrc)) {
      fs.copyFileSync(configSrc, path.join(exportDir, 'manovr-config.json'));
      if (fs.existsSync(exportUnpackedDir)) {
        fs.copyFileSync(configSrc, path.join(exportUnpackedDir, 'manovr-config.json'));
      }
      console.log('Copied manovr-config.json to export package.');
    }

    // آماده‌سازی اولیه پوشه data در export برای استفاده در شبکه
    const exportDataDir = path.join(exportDir, 'data', 'database');
    if (!fs.existsSync(exportDataDir)) {
      fs.mkdirSync(exportDataDir, { recursive: true });
    }
    const templateDb = path.join(rootDir, 'prisma', 'dev.db');
    const exportDb = path.join(exportDataDir, 'dev.db');
    if (!fs.existsSync(exportDb) && fs.existsSync(templateDb)) {
      fs.copyFileSync(templateDb, exportDb);
      console.log('Initialized export/data/database/dev.db');
    }

    // ایجاد فایل فشرده ZIP از پوشه کامل بازشده برای جابجایی آسان
    if (fs.existsSync(exportUnpackedDir)) {
      try {
        const AdmZip = require('adm-zip');
        const zipFile = path.join(exportDir, 'ManovrSystem-v0.1.0-Unpacked.zip');
        if (fs.existsSync(zipFile)) {
          try { fs.unlinkSync(zipFile); } catch (e) {}
        }
        console.log('Creating ZIP archive of ManovrSystem at:', zipFile);
        const zip = new AdmZip();
        zip.addLocalFolder(exportUnpackedDir, 'ManovrSystem');
        zip.writeZip(zipFile);
        console.log('Created ZIP archive successfully.');
      } catch (zipErr) {
        console.warn('Could not create zip archive:', zipErr.message);
      }
    }

    // نوشتن فایل راهنمای شبکه در پوشه export
    const readmePath = path.join(exportDir, 'راهنمای_استفاده_در_شبکه.txt');
    const readmeContent = `راهنمای استفاده از سامانه مانور دپو تحت شبکه شرکت (پایانه فتح‌آباد):
======================================================================

آدرس پیش‌فرض پوشه اشتراکی شبکه در فایل manovr-config.json:
\\\\srvdfs01\\Line1\\Depo\\data

محتویات این بسته خروجی:
-----------------------
۱. فایل نصبی ویندوز: ManovrSystem Setup 0.1.0.exe
   - جهت نصب استاندارد روی سیستم‌ها.
۲. فایل پرتابل تک‌فایلی: ManovrSystem 0.1.0.exe
   - نسخه بدون نیاز به نصب (Portable).
۳. پوشه نصب‌شده آماده: ManovrSystem/
   - این پوشه دقیقاً همان نسخه استخراج‌شده و نهایی نرم‌افزار است. بدون نیاز به نصب روی سیستم خودتان، می‌توانید مستقیماً همین پوشه را به شبکه کپی کنید.
۴. فایل تنظیمات شبکه: manovr-config.json
   - تعیین‌کننده مسیر پایگاه داده مشترک.
۵. پوشه data/database/dev.db
   - پایگاه داده اولیه جهت استقرار در سرور/پوشه اشتراکی.

روش پیشنهادی راه‌اندازی سریع در شبکه (بدون نیاز به فایل پرتابل):
----------------------------------------------------------------------
۱. پوشه «ManovrSystem» را همراه با پوشه «data» و فایل «manovr-config.json» کپی کرده و داخل مسیر زیر قرار دهید:
   \\\\srvdfs01\\Line1\\Depo\\

۲. روی سیستم‌های سایر همکاران، وارد مسیر فوق شده و روی ManovrSystem.exe کلیک‌راست کنید:
   Send to -> Desktop (create shortcut)

۳. با کلیک روی میانبر، نرم‌افزار ظرف ۱ ثانیه بسیار سریع و روان باز شده و مستقیماً به پایگاه داده مرکزی شبکه وصل می‌شود.

۴. حتماً بررسی فرمایید که مجوز (Permissions) پوشه اشتراکی در ویندوز برای کاربران روی Modify یا Full Control تنظیم باشد تا خطای عدم دسترسی ندهد.
`;
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    console.log('Created network usage guide in export folder.');

    console.log('Success! Optimized build completed successfully.');
  } catch (error) {
    console.error('Error during build process:', error);
    process.exit(1);
  }
}

build();
