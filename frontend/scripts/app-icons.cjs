/**
 * Render the app icon sources (frontend/icons/app-icon*.svg) to the PNG and
 * ICO files served from frontend/public. Run by frontend/icons/build.sh inside
 * the Playwright Docker image; Chromium draws the SVG at each target size, so
 * nothing is downscaled from a bitmap.
 *
 * Per variant (prod "", dev "-dev"):
 *   icons/pwa{v}-192x192.png, icons/pwa{v}-512x512.png   rounded corners, manifest purpose "any"
 *   icons/pwa{v}-maskable-192x192.png, -512x512.png       full bleed, manifest purpose "maskable"
 *   apple-touch-icon{v}.png (180)                         full bleed, iOS applies its own mask
 *   favicon{v}.ico (16, 32, 48)                           rounded corners
 */
const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('playwright-core'));
}

const FRONTEND = path.resolve(__dirname, '..');
const SRC = path.join(FRONTEND, 'icons');
const OUT = path.join(FRONTEND, 'public');
// Corner radius of the "any" icons, as a share of the side (iOS-like)
const RADIUS = 0.225;

const VARIANTS = { '': 'app-icon.svg', '-dev': 'app-icon-dev.svg' };

/** Render `svg` at `size` px, optionally with rounded transparent corners, as PNG bytes. */
async function render(page, svg, size, rounded) {
  const sized = svg.replace(/width="512" height="512"/, `width="${size}" height="${size}"`);
  const radius = rounded ? `${Math.round(size * RADIUS)}px` : '0';
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
       <div id="icon" style="width:${size}px;height:${size}px;border-radius:${radius};overflow:hidden">${sized}</div>
     </body></html>`,
  );
  return page.locator('#icon').screenshot({ omitBackground: true });
}

/** ICO file holding the given PNG images (Vista+ PNG-in-ICO). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

(async () => {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const page = await browser.newPage();
  const write = (rel, data) => {
    fs.writeFileSync(path.join(OUT, rel), data);
    console.log(`  ${rel}`);
  };

  for (const [v, file] of Object.entries(VARIANTS)) {
    const svg = fs.readFileSync(path.join(SRC, file), 'utf8');
    console.log(file);
    for (const size of [192, 512]) {
      write(`icons/pwa${v}-${size}x${size}.png`, await render(page, svg, size, true));
      write(`icons/pwa${v}-maskable-${size}x${size}.png`, await render(page, svg, size, false));
    }
    write(`apple-touch-icon${v}.png`, await render(page, svg, 180, false));
    const favicons = [];
    for (const size of [16, 32, 48]) favicons.push({ size, png: await render(page, svg, size, true) });
    write(`favicon${v}.ico`, ico(favicons));
  }
  await browser.close();
})();
