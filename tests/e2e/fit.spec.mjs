import { test, expect } from '@playwright/test';
import { openSalon, stageBox, nailRect } from './helpers.mjs';

// Everything that can be tapped must sit fully inside the viewport, on every phone size.
const SIZES = [
  { name: 'iPhone 17 Pro Max', width: 440, height: 956 },
  { name: 'iPhone 17 Pro Max in Safari with toolbars', width: 440, height: 780 },
  { name: 'iPhone 15', width: 393, height: 852 },
  { name: 'small phone with toolbars', width: 375, height: 600 },
];

for (const s of SIZES) {
  test(`fits ${s.name} (${s.width}x${s.height})`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await openSalon(page);
    const boxes = await page.locator('#screen-salon button:visible').evaluateAll(els =>
      els.map(el => { const r = el.getBoundingClientRect(); return { id: el.id || 'color-' + el.dataset.color, x: r.x, y: r.y, w: r.width, h: r.height }; }));
    expect(boxes.length).toBeGreaterThan(15);
    for (const b of boxes) {
      expect(b.x, `${b.id} left`).toBeGreaterThanOrEqual(0);
      expect(b.y, `${b.id} top`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w, `${b.id} right`).toBeLessThanOrEqual(s.width + 0.5);
      expect(b.y + b.h, `${b.id} bottom`).toBeLessThanOrEqual(s.height + 0.5);
      expect(b.w, `${b.id} width`).toBeGreaterThanOrEqual(36);
      expect(b.h, `${b.id} height`).toBeGreaterThanOrEqual(36);
    }
    // nothing scrolls
    const scroll = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
    expect(scroll.w).toBeLessThanOrEqual(s.width);
    expect(scroll.h).toBeLessThanOrEqual(s.height);
    // and the hand still gets a real amount of room
    const stage = await stageBox(page);
    expect(stage.height).toBeGreaterThan(s.height * 0.45);
    const nail = await nailRect(page, 2);
    expect(nail.w).toBeGreaterThan(24);
  });
}
