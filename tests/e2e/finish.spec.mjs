import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, drag, zoomNail, mainPixel } from './helpers.mjs';

// A band drawn round a finger has edges that bow toward the viewer, so its
// topmost pixel in the middle sits LOWER than at its ends. A band that just
// sits flat on top of the finger has a straight top edge.
test('a ring band curves round the finger instead of lying flat across it', async ({ page }) => {
  await openSalon(page);
  const profile = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 300;
    const ctx = c.getContext('2d');
    window.__salon.drawRing(ctx, 150, 150, 0, 160, 0);   // plain gold, no gem
    const d = ctx.getImageData(0, 0, 300, 300).data;
    const topAt = x => { for (let y = 0; y < 300; y++) if (d[(y * 300 + x) * 4 + 3] > 60) return y; return -1; };
    const botAt = x => { for (let y = 299; y >= 0; y--) if (d[(y * 300 + x) * 4 + 3] > 60) return y; return -1; };
    return { topL: topAt(85), topMid: topAt(150), topR: topAt(215), botL: botAt(85), botMid: botAt(150) };
  });
  expect(profile.topMid).toBeGreaterThan(profile.topL + 4);
  expect(profile.topMid).toBeGreaterThan(profile.topR + 4);
  // the lower edge bows the same way, which is what makes it read as a tube
  expect(profile.botMid).toBeGreaterThan(profile.botL + 4);
});

test('the metal is shaded: bright along the band and dark at the ends', async ({ page }) => {
  await openSalon(page);
  const lum = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 300;
    const ctx = c.getContext('2d');
    window.__salon.drawRing(ctx, 150, 150, 0, 160, 0);
    const d = ctx.getImageData(0, 0, 300, 300).data;
    const at = (x, y) => { const i = (y * 300 + x) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3; };
    let best = 0;
    for (let x = 110; x < 190; x++) for (let y = 130; y < 170; y++) best = Math.max(best, at(x, y));
    return { brightest: best, leftEnd: at(78, 152), rightEnd: at(222, 152) };
  });
  expect(lum.brightest).toBeGreaterThan(225);          // a real specular
  expect(lum.leftEnd).toBeLessThan(lum.brightest - 60); // ends turn away
  expect(lum.rightEnd).toBeLessThan(lum.brightest - 60);
});

test('painted polish is glossy: a specular highlight sits on the colour', async ({ page }) => {
  await openSalon(page);
  await page.click('#palette button[data-color="7"]');   // deep blue, so a highlight stands out
  await zoomNail(page, 2);
  const r = await page.evaluate(() => {
    const n = window.__salon.hand().nails[2].bounds;
    const a = window.__salon.toScreen(n.minX, n.minY), z = window.__salon.toScreen(n.maxX, n.maxY);
    return { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
  });
  for (let k = 0; k < 12; k++) {
    const y = r.y + (r.h * (k + 0.5)) / 12;
    await drag(page, { x: r.x + r.w * 0.5, y }, { x: r.x + r.w * 0.06, y }, 5);
    await drag(page, { x: r.x + r.w * 0.5, y }, { x: r.x + r.w * 0.94, y }, 5);
  }
  await page.waitForFunction(() => !window.__salon.state.dirty);
  const stats = await page.evaluate(() => {
    const c = document.getElementById('hand');
    const rect = c.getBoundingClientRect();
    const dpr = c.width / rect.width;
    const n = window.__salon.hand().nails[2].bounds;
    const a = window.__salon.toScreen(n.minX, n.minY), z = window.__salon.toScreen(n.maxX, n.maxY);
    const x0 = Math.round((a.x - rect.left) * dpr), y0 = Math.round((a.y - rect.top) * dpr);
    const w = Math.round((z.x - a.x) * dpr), h = Math.round((z.y - a.y) * dpr);
    const d = c.getContext('2d').getImageData(x0, y0, w, h).data;
    let bright = 0, blue = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (l > 200) bright++;
      if (d[i + 2] > 90 && d[i + 2] > d[i] + 40) blue++;
    }
    return { bright, blue, total: w * h };
  });
  // measured over the nail's bounding box, which is wider than the nail itself
  expect(stats.blue).toBeGreaterThan(stats.total * 0.08);   // the nail really is painted
  expect(stats.bright).toBeGreaterThan(stats.total * 0.008); // and it shines
});

test('the hand has no hard outline drawn around it', async ({ page }) => {
  await openSalon(page);
  // step across the middle finger's edge; no pixel should be a dark line
  const darkest = await page.evaluate(() => {
    const c = document.getElementById('hand');
    const rect = c.getBoundingClientRect();
    const dpr = c.width / rect.width;
    const ctx = c.getContext('2d');
    const f = window.__salon.hand().fingers[2];
    let worst = 255;
    for (let t = 0.3; t < 0.85; t += 0.05) {
      for (let k = -6; k <= 6; k++) {
        const p = window.__salon.fingerEdgeScreen(2, t, k);
        const d = ctx.getImageData(Math.round((p.x - rect.left) * dpr), Math.round((p.y - rect.top) * dpr), 1, 1).data;
        if (d[3] > 200) worst = Math.min(worst, (d[0] + d[1] + d[2]) / 3);
      }
    }
    return worst;
  });
  expect(darkest).toBeGreaterThan(150);   // a drawn outline would be far darker
});
