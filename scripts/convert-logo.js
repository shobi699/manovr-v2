const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const srcLogo = path.join(rootDir, 'public', 'logo.jpg');
const destPng = path.join(rootDir, 'public', 'logo.png');

async function convertLogo() {
  if (!fs.existsSync(srcLogo)) {
    console.error(`Error: Source logo not found at: ${srcLogo}`);
    process.exit(1);
  }

  try {
    console.log(`Converting ${srcLogo} to PNG...`);
    await sharp(srcLogo)
      .resize(512, 512, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(destPng);
    console.log(`Successfully generated: ${destPng}`);
  } catch (err) {
    console.error('Error during logo conversion:', err);
    process.exit(1);
  }
}

convertLogo();
