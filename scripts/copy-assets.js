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
        // Delete symlink or junction
        if (stats.isDirectory() && !stats.isSymbolicLink()) {
          fs.rmdirSync(fullPath); // on Windows directory junctions can be removed via rmdir
        } else {
          fs.unlinkSync(fullPath);
        }
        
        // Copy the actual target files in its place
        copyFolderSync(resolvedTarget, fullPath);
      } else if (stats.isDirectory()) {
        removeAndReplaceJunctions(fullPath);
      }
    } catch (err) {
      // skip errors
    }
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

    // ۴. حذف موتورهای بلااستفاده پریزما (غیر از sqlite) برای بهینه‌سازی حجم
    console.log('Cleaning unused Prisma engines from standalone directory...');
    cleanUnusedPrismaEngines(standaloneDir);
    console.log('Prisma database engines cleaned successfully.');

    // ۵. پاکسازی فایل‌ها و پوشه‌های اضافی از standalone جهت بهینه‌سازی حداکثری حجم بیلد
    console.log('Cleaning unneeded directories and files from standalone...');
    const dirsToRemove = [
      'export', 'backups', 'data', 'seed', 'plans', '.agents', '.claude', 'graphify-out',
      'e2e', 'e2e-skills-1.16.0', 'qa-skills-1.13.3', 'workflows', 'docs', 'test-results', '.playwright'
    ];
    dirsToRemove.forEach(d => {
      const p = path.join(standaloneDir, d);
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`Cleaned unneeded directory from standalone: ${d}`);
      }
    });

    fs.readdirSync(standaloneDir).forEach(f => {
      const ext = path.extname(f).toLowerCase();
      if (['.exe', '.rar', '.zip', '.docx', '.pdf'].includes(ext) || f.startsWith('ManovrSystem')) {
        try {
          fs.unlinkSync(path.join(standaloneDir, f));
          console.log(`Cleaned file from standalone: ${f}`);
        } catch (e) {}
      }
    });

  } catch (err) {
    console.error('Error copying assets or replacing junctions:', err);
    process.exit(1);
  }
}

function cleanUnusedPrismaEngines(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(element => {
    const fullPath = path.join(dir, element);
    try {
      const stats = fs.lstatSync(fullPath);
      if (stats.isDirectory()) {
        cleanUnusedPrismaEngines(fullPath);
      } else {
        const lowerName = element.toLowerCase();
        if (
          lowerName.includes('query_engine-windows.dll.node.tmp') ||
          (lowerName.startsWith('query_engine') && lowerName.includes('.tmp')) ||
          ((lowerName.includes('cockroachdb') ||
            lowerName.includes('postgresql') ||
            lowerName.includes('mysql') ||
            lowerName.includes('sqlserver')) &&
           (lowerName.endsWith('.js') || lowerName.endsWith('.mjs') || lowerName.endsWith('.wasm')))
        ) {
          fs.unlinkSync(fullPath);
        } else if (lowerName.endsWith('.map')) {
          fs.unlinkSync(fullPath);
        }
      }
    } catch (e) {
      // skip files that can't be read or deleted
    }
  });
}

copyAssets();
