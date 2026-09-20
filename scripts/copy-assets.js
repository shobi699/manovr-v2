const fs = require('fs');
const path = require('path');

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
    } catch (e) {
      // ignore copy errors for individual files if they fail
    }
  });
}

function removeAndReplaceJunctions(parentDir) {
  if (!fs.existsSync(parentDir)) return;
  fs.readdirSync(parentDir).forEach(element => {
    const fullPath = path.join(parentDir, element);
    try {
      const stats = fs.lstatSync(fullPath);
      let isJunction = stats.isSymbolicLink();
      
      if (!isJunction && stats.isDirectory()) {
        try {
          fs.readlinkSync(fullPath);
          isJunction = true;
        } catch (e) {
          // not a junction
        }
      }
      
      if (isJunction) {
        const targetPath = fs.readlinkSync(fullPath);
        const resolvedTarget = path.isAbsolute(targetPath)
          ? targetPath
          : path.resolve(path.dirname(fullPath), targetPath);
        
        console.log(`Replacing junction/symlink: ${fullPath} -> ${resolvedTarget}`);
        if (stats.isDirectory() && !stats.isSymbolicLink()) {
          fs.rmdirSync(fullPath);
        } else {
          fs.unlinkSync(fullPath);
        }
        
        copyFolderSync(resolvedTarget, fullPath);
      } else if (stats.isDirectory()) {
        removeAndReplaceJunctions(fullPath);
      }
    } catch (err) {
      // skip errors
    }
  });
}

function cleanRecursively(dir, rootStandaloneDir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(element => {
    const fullPath = path.join(dir, element);
    try {
      const stats = fs.lstatSync(fullPath);
      if (stats.isDirectory()) {
        const lower = element.toLowerCase();
        const isDirectChildOfStandalone = path.normalize(dir) === path.normalize(rootStandaloneDir);

        // ۱. پوشه‌هایی که در هیچ کجای بیلد نباید باشند
        const globallyProhibitedDirs = [
          'src', '.agents', '.claude', 'graphify-out', 'e2e', 'e2e-skills-1.16.0',
          'qa-skills-1.13.3', 'workflows', '.playwright', '.specify', 'specs',
          '.git', '.github', '.idea', '.vscode', 'tests'
        ];

        // ۲. پوشه‌هایی که صرفاً در ریشه standalone نباید وجود داشته باشند (تا به روت‌های api یا node_modules آسیب نرسد)
        const rootOnlyProhibitedDirs = [
          'export', 'backups', 'data', 'seed', 'plans', 'docs', 'test-results', 'scripts', 'fonts'
        ];

        if (globallyProhibitedDirs.includes(lower)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`Removed prohibited directory: ${fullPath}`);
        } else if (isDirectChildOfStandalone && rootOnlyProhibitedDirs.includes(lower)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`Removed root standalone directory: ${fullPath}`);
        } else {
          cleanRecursively(fullPath, rootStandaloneDir);
        }
      } else {
        const lower = element.toLowerCase();
        const ext = path.extname(element).toLowerCase();

        // ۱. حذف قطعی تمامی فایل‌های سورس‌کد و سورس‌مپ
        if (ext === '.map' || ext === '.ts' || ext === '.tsx' || ext === '.tsbuildinfo') {
          fs.unlinkSync(fullPath);
          return;
        }

        // ۲. حذف هرگونه فایل با ردپای هوش مصنوعی (AI / LLM / Agent)
        if (
          lower === 'skills-lock.json' ||
          lower === 'vibe.config.json' ||
          lower === 'agent.md' ||
          lower === 'agents.md' ||
          lower === 'claude.md' ||
          lower === 'vibe.md'
        ) {
          fs.unlinkSync(fullPath);
          console.log(`Removed AI metadata file: ${element}`);
          return;
        }

        // ۳. حذف فایل‌های پریزما انجین‌های بلااستفاده
        if (
          lower.includes('query_engine-windows.dll.node.tmp') ||
          (lower.startsWith('query_engine') && lower.includes('.tmp')) ||
          ((lower.includes('cockroachdb') ||
            lower.includes('postgresql') ||
            lower.includes('mysql') ||
            lower.includes('sqlserver')) &&
           (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.wasm')))
        ) {
          fs.unlinkSync(fullPath);
          return;
        }
      }
    } catch (e) {
      // skip files that can't be read or deleted
    }
  });
}

function cleanStandaloneRootFiles(standaloneDir) {
  if (!fs.existsSync(standaloneDir)) return;
  fs.readdirSync(standaloneDir).forEach(file => {
    const filePath = path.join(standaloneDir, file);
    try {
      const stats = fs.lstatSync(filePath);
      if (!stats.isDirectory()) {
        const lower = file.toLowerCase();
        const ext = path.extname(file).toLowerCase();
        if (
          ['.exe', '.rar', '.zip', '.docx', '.pdf', '.md', '.log', '.tmp', '.markdown', '.bat', '.ps1', '.sh', '.ts', '.tsx', '.map', '.yml', '.yaml'].includes(ext) ||
          lower.startsWith('manovrsystem') ||
          lower.startsWith('agent') ||
          lower.startsWith('claude') ||
          lower.startsWith('vibe') ||
          lower.startsWith('readme') ||
          lower.startsWith('user_guide') ||
          lower.startsWith('.env') ||
          lower === 'tsconfig.json' ||
          lower === 'next.config.ts' ||
          lower === 'vitest.config.ts' ||
          lower === 'eslint.config.mjs' ||
          lower === 'postcss.config.mjs' ||
          lower === 'electron-builder.yml' ||
          lower === 'package-lock.json' ||
          lower === 'main.js' ||
          lower === 'preload.js' ||
          lower === 'splash.html' ||
          lower === 'skills-lock.json' ||
          lower === 'vibe.config.json'
        ) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned root standalone file: ${file}`);
        }
      }
    } catch (e) {}
  });
}

function copyAssets() {
  const rootDir = path.join(__dirname, '..');
  const standaloneDir = path.join(rootDir, '.next', 'standalone');

  if (!fs.existsSync(standaloneDir)) {
    console.error('Error: Standalone directory not found. Run npm run build first.');
    process.exit(1);
  }

  try {
    // ۱. کپی پوشه public به داخل standalone
    const srcPublic = path.join(rootDir, 'public');
    const destPublic = path.join(standaloneDir, 'public');
    if (fs.existsSync(srcPublic)) {
      copyFolderSync(srcPublic, destPublic);
      console.log('Successfully copied public directory to standalone.');
    }

    // ۲. کپی پوشه static به داخل standalone/.next/static
    const srcStatic = path.join(rootDir, '.next', 'static');
    const destStatic = path.join(standaloneDir, '.next', 'static');
    if (fs.existsSync(srcStatic)) {
      copyFolderSync(srcStatic, destStatic);
      console.log('Successfully copied static directory to standalone.');
    }

    // ۳. حذف و جایگزینی تمام Junctionها و Symlinkها در کل فولدر standalone
    console.log('Dereferencing junctions and symlinks inside standalone directory...');
    removeAndReplaceJunctions(standaloneDir);
    console.log('Junction dereferencing completed successfully.');

    // ۴. پاکسازی بازگشتی و عمیق سورس‌کدها، سورس‌مپ‌ها، متادیتای هوش مصنوعی و دایرکتوری‌های غیرمجاز
    console.log('Executing deep sanitization of standalone directory (purging src, .ts, .map, AI markers)...');
    cleanRecursively(standaloneDir, standaloneDir);

    // ۵. پاکسازی فایل‌های پیکربندی و زاید از ریشه standalone
    cleanStandaloneRootFiles(standaloneDir);
    console.log('Standalone directory sanitization completed successfully.');

  } catch (err) {
    console.error('Error copying assets or cleaning standalone:', err);
    process.exit(1);
  }
}

copyAssets();
