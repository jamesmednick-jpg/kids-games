// Renders a game's app icon at the sizes iOS and the manifest need.
// Usage: node tools/make-icons.mjs <game> <emoji> <colorA> <colorB>
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { GAMES } from './games.mjs';

const [game = 'nail-salon', emoji = '💅', a = '#ffafcc', b = '#ff4d6d'] = process.argv.slice(2);
if (!GAMES.includes(game)) {
  console.error(`Unknown game "${game}". Known games: ${GAMES.join(', ')}`);
  process.exit(1);
}
const OUT = decodeURIComponent(new URL(`../${game}/`, import.meta.url).pathname);
const SIZES = [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]];

const browser = await chromium.launch();
for (const [name, size] of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(160deg,${a},${b});font-size:${size * 0.62}px;line-height:1;
    font-family:'Apple Color Emoji','Segoe UI Emoji',sans-serif">${emoji}</body>`);
  await writeFile(OUT + name, await page.screenshot({ type: 'png' }));
  console.log('wrote', game + '/' + name);
}
await browser.close();
