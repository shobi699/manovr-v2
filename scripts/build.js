const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = 'D:/manovr-build-dist';
const unpackedDir = path.join(distDir, 'win-unpacked');

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

function runCommand(cmd) {
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: rootDir });
}

function build() {
  try {
    console.log('1. Cleaning old build directories and packages...');
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

    console.log('7. Copying final packages to root directory...');
    // Stop any running processes to prevent file locks
    try {
      execSync('taskkill /f /fi "IMAGENAME eq Manovr*"', { stdio: 'ignore' });
      execSync('taskkill /f /im ManovrSystem.exe', { stdio: 'ignore' });
    } catch (e) {}

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
      }
    });

    console.log('Success! Optimized build completed successfully.');
  } catch (error) {
    console.error('Error during build process:', error);
    process.exit(1);
  }
}

build();
