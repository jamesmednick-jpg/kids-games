// Renders the app icon at the sizes iOS and the manifest need.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const OUT = decodeURIComponent(new URL('../nail-salon/', import.meta.url).pathname);
const SIZES = [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]];

const browser = await chromium.launch();
for (const [name, size] of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(160deg,#ffafcc,#ff4d6d);font-size:${size * 0.62}px;line-height:1;
    font-family:'Apple Color Emoji','Segoe UI Emoji',sans-serif">💅</body>`);
  const png = await page.screenshot({ type: 'png' });
  await writeFile(OUT + name, png);
  console.log('wrote', name);
}
await browser.close();
