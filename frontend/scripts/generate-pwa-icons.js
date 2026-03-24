/**
 * Copies and resizes the LactaMap icon for PWA use.
 * Requires: sharp (npm i -D sharp)
 * Output: public/icon-192.png, public/icon-512.png, public/icon-180.png
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SOURCE_ICON = path.join(__dirname, '..', '..', 'resources', 'images', 'lactamap-icon.png');

async function generate() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('sharp not installed — copying pre-generated icons from public/ (no-op).');
    console.log('To regenerate, install sharp: npm i -D sharp');
    return;
  }

  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`Source icon not found: ${SOURCE_ICON}`);
    process.exit(1);
  }

  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const sizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-180.png', size: 180 },
  ];

  for (const { name, size } of sizes) {
    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png()
      .toFile(path.join(PUBLIC_DIR, name));
    console.log(`Created public/${name} (${size}x${size})`);
  }

  console.log('PWA icons generated successfully.');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
