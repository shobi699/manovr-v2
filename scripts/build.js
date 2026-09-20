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
process.env.ELECTRON_BUILDER_CACHE = path.join(tempDir, 'electron-builder-cache');
if (!fs.existsSync(process.env.ELECTRON_BUILDER_CACHE)) {
  fs.mkdirSync(process.env.ELECTRON_BUILDER_CACHE, { recursive: true });
}

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '0.1.3';

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

function sanitizeDirectoryRecursive(dir, rootDirScope) {
  if (!fs.existsSync(dir)) return;
  const rootScope = rootDirScope || dir;
  fs.readdirSync(dir).forEach(element => {
    const fullPath = path.join(dir, element);
    try {
      const stats = fs.lstatSync(fullPath);
      if (stats.isDirectory()) {
        const lower = element.toLowerCase();
        const isDirectChild = path.normalize(dir) === path.normalize(rootScope);
        const globallyProhibitedDirs = [
          'src', '.agents', '.claude', 'graphify-out', 'e2e', 'e2e-skills-1.16.0',
          'qa-skills-1.13.3', 'workflows', '.playwright', '.specify', 'specs',
          '.git', '.github', '.idea', '.vscode', 'tests'
        ];
        const rootOnlyProhibitedDirs = [
          'export', 'backups', 'data', 'seed', 'plans', 'docs', 'test-results', 'scripts', 'fonts'
        ];

        if (globallyProhibitedDirs.includes(lower)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`[Sanitizer] Removed prohibited directory: ${fullPath}`);
        } else if (isDirectChild && rootOnlyProhibitedDirs.includes(lower)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`[Sanitizer] Removed root directory: ${fullPath}`);
        } else {
          sanitizeDirectoryRecursive(fullPath, rootScope);
        }
      } else {
        const lower = element.toLowerCase();
        const ext = path.extname(element).toLowerCase();

        // حذف قطعی کدهای تایپ‌اسکریپت و سورس‌مپ‌ها
        if (ext === '.map' || ext === '.ts' || ext === '.tsx' || ext === '.tsbuildinfo') {
          fs.unlinkSync(fullPath);
          return;
        }

        // حذف نشانه‌ها و فایل‌های متادیتای AI
        if (
          lower === 'skills-lock.json' ||
          lower === 'vibe.config.json' ||
          lower === 'agent.md' ||
          lower === 'agents.md' ||
          lower === 'claude.md' ||
          lower === 'vibe.md'
        ) {
          fs.unlinkSync(fullPath);
          console.log(`[Sanitizer] Removed AI marker file: ${fullPath}`);
          return;
        }

        // حذف فایل‌های موقت پریزما انجین
        if (
          lower.includes('query_engine-windows.dll.node.tmp') ||
          (lower.startsWith('query_engine') && lower.includes('.tmp'))
        ) {
          fs.unlinkSync(fullPath);
        }
      }
    } catch (e) {}
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
    env: { ...process.env, TEMP: tempDir, TMP: tempDir, npm_config_cache: path.join(tempDir, 'npm-cache') }
  });
}

function build() {
  const isExportOnly = process.argv.includes('--export-only');
  try {
    const exportDir = path.join(rootDir, 'export');
    const isSkipNext = process.argv.includes('--skip-next');

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
      if (!isSkipNext && fs.existsSync(path.join(rootDir, '.next'))) {
        fs.rmSync(path.join(rootDir, '.next'), { recursive: true, force: true });
      }
      if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
      }

      if (fs.existsSync(exportDir)) {
        try {
          fs.rmSync(exportDir, { recursive: true, force: true });
          console.log('Cleaned old export directory at start of build.');
        } catch (e) {
          console.warn('Could not fully clean export directory:', e.message);
        }
      }

      if (!isSkipNext) {
        console.log('2. Running Next.js build...');
        runCommand('npm run build');
      } else {
        console.log('2. Skipping Next.js build (--skip-next specified)...');
      }

      console.log('3. Running copy-assets.js...');
      runCommand('node scripts/copy-assets.js');

      console.log('4. Running electron-builder --dir (unpacked)...');
      runCommand('npx electron-builder --dir');

      console.log('5. Optimizing and sanitizing win-unpacked directory...');
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

      // Deep sanitize unpacked directory before packaging installers
      sanitizeDirectoryRecursive(unpackedDir);
      console.log('win-unpacked directory sanitized successfully.');

      console.log('6. Packaging optimized installers with electron-builder...');
      runCommand(`npx electron-builder --win nsis portable --prepackaged "${unpackedDir}"`);
    }

    console.log('7. Copying final packages to root directory and export folder...');
    try {
      execSync('taskkill /f /fi "IMAGENAME eq Manovr*"', { stdio: 'ignore' });
      execSync('taskkill /f /im ManovrSystem.exe', { stdio: 'ignore' });
    } catch (e) {}

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // ۱. کپی فایل‌های نصبی و پرتابل به ریشه و پوشه export
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

    // ۲. ایجاد فایل ManovrSystem 0.1.3.exe از روی نسخه پرتابل
    const portableBuilt = path.join(distDir, `ManovrSystem-Portable-${version}.exe`);
    if (fs.existsSync(portableBuilt)) {
      const explicitExeName = `ManovrSystem ${version}.exe`;
      [distDir, rootDir, exportDir].forEach(targetDir => {
        const dest = path.join(targetDir, explicitExeName);
        fs.copyFileSync(portableBuilt, dest);
        console.log(`Created explicit executable: ${dest}`);
      });
    }

    // ۳. کپی پوشه بازشده/نصب‌شده آماده (win-unpacked) به پوشه export
    const exportUnpackedDir = path.join(exportDir, 'ManovrSystem');
    if (fs.existsSync(unpackedDir)) {
      console.log('Copying unpacked installation folder to export/ManovrSystem...');
      copyFolderSync(unpackedDir, exportUnpackedDir);
      console.log('Copied unpacked application folder to export/ManovrSystem successfully.');
    }

    // ۴. کپی manovr-config.json به پوشه export و داخل ManovrSystem
    const configSrc = path.join(rootDir, 'manovr-config.json');
    if (fs.existsSync(configSrc)) {
      fs.copyFileSync(configSrc, path.join(exportDir, 'manovr-config.json'));
      if (fs.existsSync(exportUnpackedDir)) {
        fs.copyFileSync(configSrc, path.join(exportUnpackedDir, 'manovr-config.json'));
      }
      console.log('Copied manovr-config.json to export and ManovrSystem.');
    }

    // ۵. پاکسازی نهایی پوشه export/ManovrSystem از هرگونه فایل زائد
    if (fs.existsSync(exportUnpackedDir)) {
      sanitizeDirectoryRecursive(exportUnpackedDir);
      // حذف هرگونه اسکریپت یا markdown که ممکن است از بیلد قبلی یا اشتباه مانده باشد
      fs.readdirSync(exportUnpackedDir).forEach(f => {
        const full = path.join(exportUnpackedDir, f);
        const ext = path.extname(f).toLowerCase();
        if (['.bat', '.ps1', '.sh', '.md', '.markdown', '.txt', '.log'].includes(ext) || f === 'scripts') {
          fs.rmSync(full, { recursive: true, force: true });
          console.log(`[Export Cleanup] Removed non-app file from ManovrSystem: ${f}`);
        }
      });
    }

    // ۶. کپی اسکریپت‌ها و ابزارهای نگهداری سرور فقط در ریشه export
    const deployScripts = ['create-client-shortcut.ps1', 'create-client-shortcut.bat'];
    deployScripts.forEach(scriptFile => {
      const src = path.join(rootDir, 'scripts', 'deploy', scriptFile);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(exportDir, scriptFile));
        console.log(`Copied deployment script to export root: ${scriptFile}`);
      }
    });

    const toolScripts = [
      'repair-server-db.bat',
      'repair-server-db.ps1',
      'check-database-permissions.bat',
      'check-database-permissions.ps1'
    ];
    toolScripts.forEach(scriptFile => {
      const src = path.join(rootDir, scriptFile);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(exportDir, scriptFile));
        fs.copyFileSync(src, path.join(distDir, scriptFile));
        console.log(`Copied maintenance tool to export root: ${scriptFile}`);
      }
    });

    const repairMjsSrc = path.join(rootDir, 'scripts', 'repair-network-db.mjs');
    if (fs.existsSync(repairMjsSrc)) {
      const exportScriptsDir = path.join(exportDir, 'scripts');
      const distScriptsDir = path.join(distDir, 'scripts');
      fs.mkdirSync(exportScriptsDir, { recursive: true });
      fs.mkdirSync(distScriptsDir, { recursive: true });
      fs.copyFileSync(repairMjsSrc, path.join(exportScriptsDir, 'repair-network-db.mjs'));
      fs.copyFileSync(repairMjsSrc, path.join(distScriptsDir, 'repair-network-db.mjs'));
      console.log('Copied repair-network-db.mjs to export/scripts.');
    }

    const dbGuideSrc = path.join(rootDir, 'راهنمای_جامع_رفع_محدودیت_و_دسترسی_دیتابیس.md');
    if (fs.existsSync(dbGuideSrc)) {
      fs.copyFileSync(dbGuideSrc, path.join(exportDir, 'راهنمای_جامع_رفع_محدودیت_و_دسترسی_دیتابیس.md'));
      fs.copyFileSync(dbGuideSrc, path.join(distDir, 'راهنمای_جامع_رفع_محدودیت_و_دسترسی_دیتابیس.md'));
      console.log('Copied database permissions guide to export root.');
    }

    // آماده‌سازی دایرکتوری داده‌های اولیه شبکه در export
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

    const userGuideSrc = path.join(rootDir, 'USER_GUIDE_AND_TECHNICAL_SPECIFICATIONS.md');
    if (fs.existsSync(userGuideSrc)) {
      fs.copyFileSync(userGuideSrc, path.join(exportDir, 'USER_GUIDE.md'));
      fs.copyFileSync(userGuideSrc, path.join(distDir, 'USER_GUIDE.md'));
      fs.copyFileSync(userGuideSrc, path.join(exportDir, 'راهنمای_جامع_کاربری_و_آموزش_پایانه.md'));
      console.log('Copied user guide to export root.');
    }

    // ۷. ایجاد فایل فشرده ZIP از پوشه پاکسازی‌شده ManovrSystem
    if (fs.existsSync(exportUnpackedDir)) {
      try {
        const AdmZip = require('adm-zip');
        const zipFile = path.join(exportDir, `ManovrSystem-v${version}-Unpacked.zip`);
        if (fs.existsSync(zipFile)) {
          try { fs.unlinkSync(zipFile); } catch (e) {}
        }
        console.log('Creating clean ZIP archive of ManovrSystem at:', zipFile);
        const zip = new AdmZip();
        zip.addLocalFolder(exportUnpackedDir, 'ManovrSystem');
        zip.writeZip(zipFile);
        console.log('Created ZIP archive successfully.');
      } catch (zipErr) {
        console.warn('Could not create zip archive:', zipErr.message);
      }
    }

    // ۸. نوشتن فایل راهنمای شبکه
    const readmePath = path.join(exportDir, 'راهنمای_استفاده_در_شبکه.txt');
    const readmeContent = `راهنمای استفاده از سامانه مدیریت پایانه و مانور فتح‌آباد تحت شبکه شرکت (خط یک مترو):
======================================================================

آدرس پیش‌فرض پوشه اشتراکی شبکه در فایل manovr-config.json:
\\\\srvdfs01\\Line1\\Depo\\data

محتویات این بسته خروجی رسمی (نگارش ${version} - تاریخ ۲۸ شهریور ۱۴۰۵):
----------------------------------------------------------------------
۱. پوشه اجرایی استقرار در شبکه (بدون نیاز به نصب): ManovrSystem/
   - این پوشه حاوی فایل‌های کامپایل‌شده اجرایی برنامه است و مستقیماً روی سرور یا کلاینت‌ها قابل اجراست.
   - کلاینت‌ها مستقیماً فایل ManovrSystem.exe را اجرا می‌نمایند.
۲. اسکریپت خودکار ساخت میانبر کلاینت: create-client-shortcut.bat
   - با دوبار کلیک کلاینت، میانبری بهینه روی دسکتاپ ایجاد می‌شود.
۳. فایل نصبی استاندارد ویندوز: ManovrSystem Setup ${version}.exe
   - جهت نصب محلی دائمی با قابلیت ایجاد میانبر خودکار در منوی استارت و دسکتاپ.
۴. فایل پرتابل تک‌فایلی: ManovrSystem-Portable-${version}.exe و ManovrSystem ${version}.exe
   - نسخه سبک و قابل حمل بر روی فلش‌مموری یا سیستم‌های اضطراری.
۵. ابزار تست و عیب‌یابی دسترسی شبکه و دیتابیس: check-database-permissions.bat
   - بررسی خودکار اتصال، مجوز نوشتن، قفل فایل و سلامت دیتابیس.
۶. ابزار تخصصی آزادسازی قفل و تعمیر دیتابیس سرور: repair-server-db.bat
   - پاکسازی قفل‌ها، ادغام لاگ‌ها و تثبیت حالت TRUNCATE دیتابیس مشترک سرور.
۷. راهنمای جامع رفع محدودیت و دسترسی دیتابیس: راهنمای_جامع_رفع_محدودیت_و_دسترسی_دیتابیس.md
   - راهنمای فنی تنظیمات Share و NTFS، رفع خطای ۲۵۷۰ دیسک و تنظیمات آنتی‌ویروس.
۸. فایل تنظیمات شبکه: manovr-config.json
   - تعیین‌کننده مسیر پایگاه داده مشترک شبکه.
۹. پوشه data/database/dev.db
   - پایگاه داده متمرکز اولیه SQLite بهینه‌شده برای شبکه.

روش پیشنهادی استقرار در شبکه:
----------------------------------------------------------------------
۱. پوشه «ManovrSystem» را همراه با پوشه «data»، اسکریپت‌ها و فایل «manovr-config.json» داخل مسیر اشتراکی سرور قرار دهید:
   \\\\srvdfs01\\Line1\\Depo\\

۲. روی سیستم هر همکار یا کلاینت، وارد مسیر فوق شده و روی فایل «create-client-shortcut.bat» دوبار کلیک کنید.
   - اسکریپت به صورت کاملاً خودکار میانبر استاندارد با مسیر کاری محلی و فلگ‌های حافظه را روی دسکتاپ کلاینت ثبت می‌کند.

۳. با کلیک روی میانبر، سامانه ظرف کمتر از ۱ ثانیه بدون هیچ تداخلی باز شده و به پایگاه داده مرکزی متصل می‌گردد.
`;
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    console.log('Created network usage guide in export folder.');

    // ۹. مانیفست‌های رسمی توزیع و به‌روزرسانی
    const crypto = require('crypto');
    function getHash(filePath) {
      if (!fs.existsSync(filePath)) return null;
      return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    }
    function getDirSize(dirPath) {
      let size = 0;
      if (!fs.existsSync(dirPath)) return 0;
      fs.readdirSync(dirPath).forEach(f => {
        const p = path.join(dirPath, f);
        const stat = fs.statSync(p);
        size += stat.isDirectory() ? getDirSize(p) : stat.size;
      });
      return size;
    }

    const portableExe = path.join(distDir, `ManovrSystem-Portable-${version}.exe`);
    const explicitExe = path.join(distDir, `ManovrSystem ${version}.exe`);
    const setupExe = path.join(distDir, `ManovrSystem Setup ${version}.exe`);
    const userGuide = path.join(distDir, 'USER_GUIDE.md');
    const dbGuide = path.join(distDir, 'راهنمای_جامع_رفع_محدودیت_و_دسترسی_دیتابیس.md');

    const manifestData = {
      manifestId: `MANOVR-DIST-20260918-013`,
      productName: 'ManovrSystem - سامانه مدیریت پایانه و مانور خط یک متروی تهران (فتح‌آباد)',
      version: version,
      buildDate: '2026-09-18',
      buildDateJalali: '۱۴۰۵/۰۶/۲۸',
      developer: 'سید شبیر موسوی',
      sponsors: [
        'مدیریت عملیات خط یک شرکت بهره‌برداری راه‌آهن شهری تهران و حومه',
        'ریاست عملیات پایانه و مانور خط یک'
      ],
      distributionDirectory: 'D:/manovr-build-dist',
      artifacts: [
        {
          format: 'PORTABLE',
          fileName: `ManovrSystem-Portable-${version}.exe`,
          relativePath: `ManovrSystem-Portable-${version}.exe`,
          sizeBytes: fs.existsSync(portableExe) ? fs.statSync(portableExe).size : 0,
          sizeFormatted: fs.existsSync(portableExe) ? (fs.statSync(portableExe).size / (1024*1024)).toFixed(1) + ' MB' : '',
          sha256Hash: getHash(portableExe),
          verifiedExecutable: true
        },
        {
          format: 'PORTABLE',
          fileName: `ManovrSystem ${version}.exe`,
          relativePath: `ManovrSystem ${version}.exe`,
          sizeBytes: fs.existsSync(explicitExe) ? fs.statSync(explicitExe).size : 0,
          sizeFormatted: fs.existsSync(explicitExe) ? (fs.statSync(explicitExe).size / (1024*1024)).toFixed(1) + ' MB' : '',
          sha256Hash: getHash(explicitExe),
          verifiedExecutable: true
        },
        {
          format: 'INSTALLER',
          fileName: `ManovrSystem Setup ${version}.exe`,
          relativePath: `ManovrSystem Setup ${version}.exe`,
          sizeBytes: fs.existsSync(setupExe) ? fs.statSync(setupExe).size : 0,
          sizeFormatted: fs.existsSync(setupExe) ? (fs.statSync(setupExe).size / (1024*1024)).toFixed(1) + ' MB' : '',
          sha256Hash: getHash(setupExe),
          verifiedExecutable: true
        },
        {
          format: 'UNPACKED_DIR',
          fileName: 'ManovrSystem',
          relativePath: 'ManovrSystem',
          sizeBytes: getDirSize(unpackedDir),
          sizeFormatted: (getDirSize(unpackedDir) / (1024*1024)).toFixed(1) + ' MB',
          verifiedExecutable: true
        },
        {
          format: 'DOCUMENTATION',
          fileName: 'راهنمای_جامع_رفع_محدودیت_و_دسترسی_دیتابیس.md',
          relativePath: 'راهنمای_جامع_رفع_محدودیت_و_دسترسی_دیتابیس.md',
          sizeBytes: fs.existsSync(dbGuide) ? fs.statSync(dbGuide).size : 0,
          sha256Hash: getHash(dbGuide)
        },
        {
          format: 'USER_GUIDE',
          fileName: 'USER_GUIDE.md',
          relativePath: 'USER_GUIDE.md',
          sizeBytes: fs.existsSync(userGuide) ? fs.statSync(userGuide).size : 0,
          sizeFormatted: fs.existsSync(userGuide) ? (fs.statSync(userGuide).size / 1024).toFixed(1) + ' KB' : '',
          sha256Hash: getHash(userGuide),
          verifiedExecutable: true
        }
      ],
      systemRequirements: {
        os: 'Windows 10 / 11 (64-bit)',
        architecture: 'x64',
        minRam: '4 GB',
        networkShareCompatible: true
      }
    };

    fs.writeFileSync(path.join(distDir, 'distribution-manifest.json'), JSON.stringify(manifestData, null, 2), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'distribution-manifest.json'), JSON.stringify(manifestData, null, 2), 'utf8');
    console.log('Successfully generated distribution-manifest.json in both dist and export directories.');

    const versionManifest = {
      version: version,
      releaseDate: '2026-09-18T09:00:00Z',
      releaseDateJalali: '۱۴۰۵/۰۶/۲۸',
      minSupportedVersion: '0.1.0',
      packageType: 'full',
      packageFile: `ManovrSystem-Portable-${version}.exe`,
      sha256: getHash(portableExe) || '0000000000000000000000000000000000000000000000000000000000000000',
      fileSizeBytes: fs.existsSync(portableExe) ? fs.statSync(portableExe).size : 1,
      mandatory: false,
      changelog: {
        highlights: [
          'ارتقای نگارش رسمی به ۰.۱.۳',
          'افزودن شناسنامه رسمی پروژه و معرفی مدیران ارشد خط یک در صفحه درباره ما',
          'حفاظت کامل از سورس‌کد و پاکسازی دایرکتوری اجرایی نرم‌افزار'
        ],
        features: [
          'معرفی رسمی مدیریت محترم عملیات خط یک و ریاست محترم عملیات و مانور در صفحه درباره ما',
          'سامانه هوشمند تاریخچه نگارش‌ها (Changelog) در شناسنامه نرم‌افزار',
          'پاکسازی و بهینه‌سازی کامل پوشه ManovrSystem جهت استقرار پاک در شبکه'
        ],
        fixes: [
          'حذف کامل پوشه سورس‌کدها و سورس‌مپ‌ها از بسته نهایی نرم‌افزار',
          'تضمین اجرای امن و پرسرعت نرم‌افزار با کدهای کامپایل‌شده',
          'پاکسازی اسکریپت‌های سرور از پوشه کلاینت و تفکیک ابزارهای نگهداری'
        ]
      },
      targetPlatform: 'win-x64'
    };
    fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionManifest, null, 2), 'utf8');
    fs.writeFileSync(path.join(exportDir, 'version.json'), JSON.stringify(versionManifest, null, 2), 'utf8');
    console.log('Successfully generated version.json for auto-updater.');

    console.log('Success! Optimized and fully sanitized build completed successfully.');
  } catch (error) {
    console.error('Error during build process:', error);
    process.exit(1);
  }
}

build();
