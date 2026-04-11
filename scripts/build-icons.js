import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SVG_PATH = path.join(__dirname, '../assets/icon.svg');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

const SIZES = [16, 32, 48, 128];

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const BRANDING_DIR = path.join(__dirname, '../public/branding');
if (!fs.existsSync(BRANDING_DIR)) {
  fs.mkdirSync(BRANDING_DIR, { recursive: true });
}

const BANNER_SVG_PATH = path.join(__dirname, '../assets/banner.svg');

async function generateIcons() {
  const svgBuffer = fs.readFileSync(SVG_PATH);
  
  for (const size of SIZES) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(OUTPUT_DIR, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Generate the GitHub Banner
  const bannerBuffer = fs.readFileSync(BANNER_SVG_PATH);
  await sharp(bannerBuffer)
    .resize(1280, 640)
    .png()
    .toFile(path.join(BRANDING_DIR, 'banner_v2.png'));
  console.log('Generated banner_v2.png');

  // Generate the GitHub Logo Master
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(BRANDING_DIR, 'icon_master_v2.png'));
  console.log('Generated icon_master_v2.png');
}

generateIcons().catch(console.error);
