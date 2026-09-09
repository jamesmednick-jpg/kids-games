import { test, expect } from '@playwright/test';
import { openSalon } from './helpers.mjs';

test('viewport is locked and the canvas refuses browser gestures', async ({ page }) => {
  await openSalon(page);
  const vp = await page.locator('meta[name=viewport]').getAttribute('content');
  expect(vp).toContain('user-scalable=no');
  expect(vp).toContain('maximum-scale=1');
  const ta = await page.locator('#hand').evaluate(el => getComputedStyle(el).touchAction);
  expect(ta).toBe('none');
  const ob = await page.evaluate(() => getComputedStyle(document.body).overscrollBehavior);
  expect(ob).toBe('none');
});

test('every visible salon button is at least 56px square', async ({ page }) => {
  await openSalon(page);
  const boxes = await page.locator('#screen-salon button:visible').evaluateAll(els =>
    els.map(el => { const r = el.getBoundingClientRect(); return { id: el.id || el.dataset.color, w: r.width, h: r.height }; }));
  expect(boxes.length).toBeGreaterThan(15);
  for (const b of boxes) {
    expect(b.w, `${b.id} width`).toBeGreaterThanOrEqual(56);
    expect(b.h, `${b.id} height`).toBeGreaterThanOrEqual(56);
  }
});

test('there are no links and no requests to other origins', async ({ page }) => {
  const foreign = [];
  page.on('request', r => { if (!r.url().startsWith('http://localhost:4173')) foreign.push(r.url()); });
  await openSalon(page);
  await page.click('#btn-done');
  expect(await page.locator('a[href]').count()).toBe(0);
  expect(foreign).toEqual([]);
});

test('manifest and icons are served', async ({ page, request }) => {
  const m = await request.get('/nail-salon/manifest.webmanifest');
  expect(m.ok()).toBeTruthy();
  const json = await m.json();
  expect(json.display).toBe('standalone');
  expect(json.start_url).toBe('./index.html');
  for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
    const r = await request.get(`/nail-salon/${f}`);
    expect(r.ok(), f).toBeTruthy();
    expect(r.headers()['content-type']).toBe('image/png');
  }
  const sw = await request.get('/nail-salon/sw.js');
  expect(sw.ok()).toBeTruthy();
});
