# Nail Salon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A parent-controlled, ad-free nail painting web game for a 5-year-old, installable to an iPhone home screen and playable offline.

**Architecture:** Plain static web app, no framework, no build step. Pure geometry (nail outlines, hit testing, stroke interpolation) lives in an ES module with no DOM so Node can test it. Each nail owns an offscreen canvas clipped to its outline; the main canvas composites hand, nail bases, nail layers, and shine each frame something changed. A service worker caches the game folder for offline use. A root launcher page lists games, one folder per game.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, Canvas 2D, Web Audio, Web Share API, Service Worker. Dev only: Node 24 (`node --test`), `@playwright/test` with Chromium in an iPhone-sized viewport.

**Spec:** `docs/superpowers/specs/2026-09-08-nail-salon-design.md`

## Global Constraints

- No runtime dependencies; no bundler. The game must run by opening `nail-salon/index.html` from any static host.
- All URLs inside the game are relative (`./file`) so it works under a subpath like `/kids-games/nail-salon/`.
- Every visible button in the salon is at least 56 by 56 CSS px.
- No external links anywhere in the game or launcher.
- No network calls after load. Nothing is collected or sent.
- Parent-editable constants at the top of `nail-salon/game.js`: `CAPTION` (default `'Nail Salon'`), `PALETTE` (12 six-digit hex colors), `STICKERS` (8 entries), `SKIN_TONES` (4 colors).
- Logical drawing space is 600 by 800 units; the hand is bottom-aligned inside whatever stage size the phone gives.
- Nothing throws to the user; caught errors go to `console.warn` only.
- Commit after every task with the attribution lines:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TYAJsvSW5EivoCWbafk3jW
  ```
- Working directory for every command: `/Users/jamesmednick/Documents/KIDS GAMES` (note the space; quote the path).

---

## File structure

| File | Responsibility |
|---|---|
| `package.json` | dev scripts and the single dev dependency (`@playwright/test`) |
| `tools/serve.mjs` | 40-line static file server for tests and local phone testing |
| `tools/make-icons.mjs` | renders the app icon PNGs with Playwright's Chromium |
| `playwright.config.mjs` | iPhone-sized Chromium, starts `tools/serve.mjs` |
| `nail-salon/geometry.js` | **pure**: nail polygons per shape, hand layout, point-in-polygon, hit test, stroke interpolation |
| `nail-salon/render.js` | browser: `Path2D` from a nail, drawing the hand, nail base, shine, outline, whole scene |
| `nail-salon/paint.js` | browser: `NailLayer` offscreen clipped canvas with brush, glitter, sticker, dot, clear, pixel probes |
| `nail-salon/audio.js` | browser: Web Audio pop, tinkle, chime, mute |
| `nail-salon/game.js` | browser: config constants, state, screens, input, celebration, photo export, test hooks |
| `nail-salon/index.html`, `style.css` | shell and layout |
| `nail-salon/manifest.webmanifest`, `sw.js`, icons | installability and offline |
| `index.html` | launcher with one tile per game |
| `tests/unit/geometry.test.mjs` | Node tests for geometry |
| `tests/e2e/helpers.mjs` | shared Playwright helpers |
| `tests/e2e/*.spec.mjs` | Playwright tests, one file per screen/feature |

---

### Task 1: Geometry module (pure, Node-tested)

**Files:**
- Create: `package.json`
- Create: `nail-salon/geometry.js`
- Test: `tests/unit/geometry.test.mjs`

**Interfaces:**
- Produces:
  - `SHAPES: string[]` = `['round','square','oval','almond','pointed']`
  - `LOGICAL_W = 600`, `LOGICAL_H = 800`
  - `nailPolygon(shape, rect:{x,y,w,h}, samples=24): [x,y][]` closed polygon (first point not repeated)
  - `polygonBounds(points): {minX,minY,maxX,maxY}`
  - `pointInPolygon(x, y, points): boolean`
  - `interpolate(a:{x,y}, b:{x,y}, spacing): {x,y}[]` points after `a` up to and including `b`
  - `buildHand(shape): { shape, fingers, palm, nails: [{index, finger, rect, points, bounds}] }` with 5 nails ordered thumb, index, middle, ring, pinky
  - `hitNail(hand, x, y): number` index or -1

- [ ] **Step 1: Create package.json**

```json
{
  "name": "kids-games",
  "private": true,
  "type": "module",
  "scripts": {
    "test:unit": "node --test tests/unit/",
    "test:e2e": "playwright test",
    "test": "npm run test:unit && npm run test:e2e",
    "serve": "node tools/serve.mjs",
    "icons": "node tools/make-icons.mjs"
  }
}
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/geometry.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAPES, LOGICAL_W, LOGICAL_H, nailPolygon, polygonBounds, pointInPolygon,
  interpolate, buildHand, hitNail,
} from '../../nail-salon/geometry.js';

const RECT = { x: 100, y: 100, w: 60, h: 80 };

test('SHAPES lists the five spec shapes', () => {
  assert.deepEqual(SHAPES, ['round', 'square', 'oval', 'almond', 'pointed']);
});

test('logical space is 600 by 800', () => {
  assert.equal(LOGICAL_W, 600);
  assert.equal(LOGICAL_H, 800);
});

for (const shape of SHAPES) {
  test(`nailPolygon(${shape}) stays inside its rect and has many points`, () => {
    const pts = nailPolygon(shape, RECT);
    assert.ok(pts.length >= 40);
    for (const [x, y] of pts) {
      assert.ok(x >= RECT.x - 1e-9 && x <= RECT.x + RECT.w + 1e-9, `x ${x}`);
      assert.ok(y >= RECT.y - 1e-9 && y <= RECT.y + RECT.h + 1e-9, `y ${y}`);
    }
  });

  test(`nailPolygon(${shape}) contains the rect center`, () => {
    const pts = nailPolygon(shape, RECT);
    assert.ok(pointInPolygon(RECT.x + RECT.w / 2, RECT.y + RECT.h / 2, pts));
  });
}

test('square tip is nearly flat, pointed tip is a point', () => {
  const sq = nailPolygon('square', RECT);
  const topSq = sq.slice(0, 25).map(p => p[1]);
  assert.ok(Math.max(...topSq) - Math.min(...topSq) < RECT.w * 0.1);

  const pt = nailPolygon('pointed', RECT);
  // the middle top sample is the highest point and corners are much lower
  assert.ok(pt[12][1] < pt[0][1] - RECT.w * 0.5);
});

test('round nail excludes its top corners', () => {
  const pts = nailPolygon('round', RECT);
  assert.equal(pointInPolygon(RECT.x + 1, RECT.y + 1, pts), false);
  assert.equal(pointInPolygon(RECT.x + RECT.w - 1, RECT.y + 1, pts), false);
});

test('polygonBounds', () => {
  assert.deepEqual(polygonBounds([[1, 5], [4, 2], [3, 9]]), { minX: 1, minY: 2, maxX: 4, maxY: 9 });
});

test('pointInPolygon on a square', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(pointInPolygon(5, 5, sq), true);
  assert.equal(pointInPolygon(15, 5, sq), false);
  assert.equal(pointInPolygon(-1, -1, sq), false);
});

test('interpolate returns evenly spaced points ending at b', () => {
  const pts = interpolate({ x: 0, y: 0 }, { x: 10, y: 0 }, 2.5);
  assert.deepEqual(pts, [{ x: 2.5, y: 0 }, { x: 5, y: 0 }, { x: 7.5, y: 0 }, { x: 10, y: 0 }]);
});

test('interpolate for a short hop returns just b', () => {
  assert.deepEqual(interpolate({ x: 0, y: 0 }, { x: 1, y: 1 }, 5), [{ x: 1, y: 1 }]);
});

test('buildHand has five nails inside the logical space and no overlaps', () => {
  for (const shape of SHAPES) {
    const hand = buildHand(shape);
    assert.equal(hand.nails.length, 5);
    assert.deepEqual(hand.nails.map(n => n.finger), ['thumb', 'index', 'middle', 'ring', 'pinky']);
    for (const n of hand.nails) {
      assert.ok(n.bounds.minX >= 0 && n.bounds.maxX <= LOGICAL_W);
      assert.ok(n.bounds.minY >= 0 && n.bounds.maxY <= LOGICAL_H);
    }
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const a = hand.nails[i].bounds, b = hand.nails[j].bounds;
      const overlap = a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
      assert.equal(overlap, false, `${shape}: nails ${i} and ${j} overlap`);
    }
  }
});

test('longer shapes extend the nail upward, not downward', () => {
  const round = buildHand('round').nails[1].rect;
  const pointed = buildHand('pointed').nails[1].rect;
  assert.equal(round.y + round.h, pointed.y + pointed.h);
  assert.ok(pointed.y < round.y);
});

test('hitNail finds the nail under a point and -1 elsewhere', () => {
  const hand = buildHand('round');
  hand.nails.forEach((n, i) => {
    const cx = n.rect.x + n.rect.w / 2, cy = n.rect.y + n.rect.h / 2;
    assert.equal(hitNail(hand, cx, cy), i);
  });
  assert.equal(hitNail(hand, 350, 700), -1); // palm
  assert.equal(hitNail(hand, -5, -5), -1);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd "/Users/jamesmednick/Documents/KIDS GAMES" && npm run test:unit`
Expected: FAIL with "Cannot find module .../nail-salon/geometry.js"

- [ ] **Step 4: Write geometry.js**

`nail-salon/geometry.js`:

```js
// Pure geometry for the nail salon. No DOM, no canvas. Tested in Node.

export const SHAPES = ['round', 'square', 'oval', 'almond', 'pointed'];
export const LOGICAL_W = 600;
export const LOGICAL_H = 800;

// Tip profile per shape. f(t) maps t in [-1,1] (left edge to right edge)
// to [0,1] where 0 is the very tip and 1 is where the tip meets the side.
// tipH is how tall the tip region is. hScale lengthens the whole nail.
const TIP = {
  square:  { f: t => Math.abs(t) ** 12,            tipH: w => w * 0.08, hScale: 1.0 },
  round:   { f: t => 1 - Math.sqrt(1 - t * t),     tipH: w => w * 0.5,  hScale: 1.0 },
  oval:    { f: t => 1 - Math.sqrt(1 - t * t),     tipH: w => w * 0.7,  hScale: 1.15 },
  almond:  { f: t => Math.abs(t) ** 1.4,           tipH: w => w * 0.9,  hScale: 1.25 },
  pointed: { f: t => Math.abs(t),                  tipH: w => w * 1.0,  hScale: 1.4 },
};

export function nailPolygon(shape, rect, samples = 24) {
  const { x, y, w, h } = rect;
  const s = TIP[shape];
  const tipH = s.tipH(w);
  const cutH = w * 0.25; // cuticle arc height
  const pts = [];
  for (let i = 0; i <= samples; i++) {          // tip edge, left to right
    const t = -1 + (2 * i) / samples;
    pts.push([x + ((t + 1) / 2) * w, y + tipH * s.f(t)]);
  }
  for (let i = samples; i >= 0; i--) {          // cuticle edge, right to left
    const t = -1 + (2 * i) / samples;
    pts.push([x + ((t + 1) / 2) * w, y + h - cutH * t * t]);
  }
  return pts;
}

export function polygonBounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function interpolate(a, b, spacing) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= spacing) return [{ x: b.x, y: b.y }];
  const n = Math.floor(dist / spacing);
  const out = [];
  for (let i = 1; i <= n; i++) out.push({ x: a.x + (dx * i * spacing) / dist, y: a.y + (dy * i * spacing) / dist });
  const last = out[out.length - 1];
  if (last.x !== b.x || last.y !== b.y) out.push({ x: b.x, y: b.y });
  return out;
}

// Back of a left hand, fingers pointing up, thumb on the left.
const FINGERS = [
  { name: 'thumb',  cx: 70,  tipY: 430, baseY: 700, w: 88 },
  { name: 'index',  cx: 185, tipY: 170, baseY: 540, w: 96 },
  { name: 'middle', cx: 295, tipY: 120, baseY: 540, w: 100 },
  { name: 'ring',   cx: 405, tipY: 160, baseY: 540, w: 94 },
  { name: 'pinky',  cx: 505, tipY: 260, baseY: 540, w: 80 },
];
const PALM = { x: 130, y: 480, w: 430, h: 420, r: 100 };

export function buildHand(shape) {
  const nails = FINGERS.map((f, index) => {
    const w = Math.round(f.w * 0.72);
    const baseH = Math.round(w * 1.15);
    const h = Math.round(baseH * TIP[shape].hScale);
    const bottom = f.tipY + 14 + baseH;         // cuticle stays put; long nails grow upward
    const rect = { x: f.cx - w / 2, y: bottom - h, w, h };
    const points = nailPolygon(shape, rect);
    return { index, finger: f.name, rect, points, bounds: polygonBounds(points) };
  });
  return { shape, fingers: FINGERS, palm: PALM, nails };
}

export function hitNail(hand, x, y) {
  for (const n of hand.nails) {
    const b = n.bounds;
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
    if (pointInPolygon(x, y, n.points)) return n.index;
  }
  return -1;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: all tests pass. If `longer shapes extend upward` fails, check that `bottom` in `buildHand` does not depend on `hScale`.

- [ ] **Step 6: Commit**

```bash
git add package.json nail-salon/geometry.js tests/unit/geometry.test.mjs
git commit -m "Add pure nail geometry module with Node tests"
```

---

### Task 2: Static shell, render module, and Playwright setup

**Files:**
- Create: `tools/serve.mjs`, `playwright.config.mjs`
- Create: `nail-salon/index.html`, `nail-salon/style.css`, `nail-salon/render.js`, `nail-salon/game.js` (first version: shape picker plus salon that draws the hand)
- Test: `tests/e2e/helpers.mjs`, `tests/e2e/shell.spec.mjs`

**Interfaces:**
- Consumes: everything from `geometry.js`.
- Produces:
  - `render.js`: `nailPath(nail): Path2D` (cached on `nail._path`), `drawHand(ctx, hand, skin)`, `drawNailBase(ctx, nail, color)`, `drawShine(ctx, nail)`, `drawOutline(ctx, nail)`, `drawScene(ctx, hand, skin, layers|null)` where `layers[i]` has `{canvas, ox, oy, w, h}`.
  - `game.js` test hooks on `window.__salon`: `state`, `hand()`, `toScreen(x,y)` logical to client coords, `nailCenterScreen(i)`.
  - DOM ids used by later tasks: `#screen-shape`, `#tiles button[data-shape]`, `#skins button[data-skin]`, `#screen-salon`, `#stage`, `#hand`, `#palette`, `#tools`, `#tray`, `#party`, `#confetti`, `#fallback`, buttons `#btn-home #btn-mute #tool-brush #tool-glitter #tool-sticker #tool-clear #btn-done #btn-photo #btn-new #btn-fallback-close`.

- [ ] **Step 1: Install Playwright**

```bash
cd "/Users/jamesmednick/Documents/KIDS GAMES"
npm install --save-dev @playwright/test
npx playwright install chromium
```
Expected: `node_modules/@playwright/test` exists; chromium downloads without error.

- [ ] **Step 2: Write the static server**

`tools/serve.mjs`:

```js
// Tiny static server. Usage: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) throw new Error('outside root');
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(301, { Location: path + '/' }); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
```

- [ ] **Step 3: Write the Playwright config**

`playwright.config.mjs`:

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['iPhone 15'],
    browserName: 'chromium',
  },
  webServer: {
    command: 'node tools/serve.mjs 4173',
    port: 4173,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 4: Write the failing e2e tests**

`tests/e2e/helpers.mjs`:

```js
export async function openSalon(page, shape = 'round') {
  await page.goto('/nail-salon/index.html');
  await page.click(`[data-shape="${shape}"]`);
  await page.waitForSelector('#screen-salon:not([hidden])');
  await page.waitForFunction(() => window.__salon && window.__salon.hand());
}

export function nailCenter(page, i) {
  return page.evaluate(i => window.__salon.nailCenterScreen(i), i);
}

export async function drag(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

// Reads one main-canvas pixel at client coords, returns [r,g,b,a].
export function mainPixel(page, x, y) {
  return page.evaluate(([x, y]) => {
    const c = document.getElementById('hand');
    const r = c.getBoundingClientRect();
    const dpr = c.width / r.width;
    const d = c.getContext('2d').getImageData(Math.round((x - r.left) * dpr), Math.round((y - r.top) * dpr), 1, 1).data;
    return Array.from(d);
  }, [x, y]);
}
```

`tests/e2e/shell.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, mainPixel } from './helpers.mjs';

test('shape picker shows five shape tiles and four skin tones', async ({ page }) => {
  await page.goto('/nail-salon/index.html');
  await expect(page.locator('#tiles button[data-shape]')).toHaveCount(5);
  await expect(page.locator('#skins button[data-skin]')).toHaveCount(4);
});

test('picking a shape opens the salon with that shape', async ({ page }) => {
  await openSalon(page, 'almond');
  const shape = await page.evaluate(() => window.__salon.hand().shape);
  expect(shape).toBe('almond');
});

test('the hand is drawn: palm pixel is skin colored, nail center is pale', async ({ page }) => {
  await openSalon(page);
  const palm = await page.evaluate(() => window.__salon.toScreen(350, 700));
  const [r, g, b, a] = await mainPixel(page, palm.x, palm.y);
  expect(a).toBe(255);
  expect(r).toBeGreaterThan(g); // skin tones are warm
  const c = await nailCenter(page, 2);
  const [nr, ng, nb] = await mainPixel(page, c.x, c.y);
  expect(nr).toBeGreaterThan(200); expect(ng).toBeGreaterThan(180); expect(nb).toBeGreaterThan(180);
});

test('home button returns to the shape picker', async ({ page }) => {
  await openSalon(page);
  await page.click('#btn-home');
  await expect(page.locator('#screen-shape')).toBeVisible();
  await expect(page.locator('#screen-salon')).toBeHidden();
});

test('changing skin tone changes the salon hand', async ({ page }) => {
  await page.goto('/nail-salon/index.html');
  await page.click('[data-skin="3"]');
  await page.click('[data-shape="round"]');
  await page.waitForFunction(() => window.__salon && window.__salon.hand());
  const palm = await page.evaluate(() => window.__salon.toScreen(350, 700));
  const [r] = await mainPixel(page, palm.x, palm.y);
  expect(r).toBeLessThan(140); // darkest tone
});
```

- [ ] **Step 5: Run e2e to verify it fails**

Run: `npx playwright test tests/e2e/shell.spec.mjs`
Expected: FAIL (404 or missing elements).

- [ ] **Step 6: Write render.js**

`nail-salon/render.js`:

```js
// Canvas drawing helpers. Browser only.

export function nailPath(nail) {
  if (!nail._path) {
    const p = new Path2D();
    nail.points.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    nail._path = p;
  }
  return nail._path;
}

export function drawHand(ctx, hand, skin) {
  const { palm, fingers } = hand;
  ctx.fillStyle = skin;
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 3;
  // thumb web
  ctx.beginPath();
  ctx.ellipse(palm.x + 20, palm.y + 150, 80, 120, -0.35, 0, Math.PI * 2);
  ctx.fill();
  for (const f of fingers) {
    ctx.beginPath();
    ctx.roundRect(f.cx - f.w / 2, f.tipY, f.w, f.baseY - f.tipY + 80, f.w / 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(palm.x, palm.y, palm.w, palm.h, palm.r);
  ctx.fill();
}

export function drawNailBase(ctx, nail, color) {
  ctx.fillStyle = color;
  ctx.fill(nailPath(nail));
}

export function drawShine(ctx, nail) {
  const { x, y, w, h } = nail.rect;
  ctx.save();
  ctx.clip(nailPath(nail));
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.3, y + h * 0.32, w * 0.14, h * 0.2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawOutline(ctx, nail) {
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 2;
  ctx.stroke(nailPath(nail));
}

export const NAIL_BASE = '#f7dede';

// Draws hand + nails in logical coordinates. ctx must already be transformed.
export function drawScene(ctx, hand, skin, layers) {
  drawHand(ctx, hand, skin);
  hand.nails.forEach((nail, i) => {
    drawNailBase(ctx, nail, NAIL_BASE);
    const L = layers && layers[i];
    if (L) ctx.drawImage(L.canvas, L.ox, L.oy, L.w, L.h);
    drawShine(ctx, nail);
    drawOutline(ctx, nail);
  });
}
```

- [ ] **Step 7: Write index.html**

`nail-salon/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Nail Salon">
<meta name="theme-color" content="#ffb3c6">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<link rel="stylesheet" href="./style.css">
<title>Nail Salon</title>
</head>
<body>

<section id="screen-shape" class="screen">
  <div class="title">💅</div>
  <div id="skins" class="row"></div>
  <div id="tiles"></div>
</section>

<section id="screen-salon" class="screen" hidden>
  <div id="palette"></div>
  <div id="stage">
    <canvas id="hand"></canvas>
    <canvas id="confetti" hidden></canvas>
    <button id="btn-home" class="corner left" aria-label="Home">🏠</button>
    <button id="btn-mute" class="corner right" aria-label="Sound">🔊</button>
  </div>
  <div id="tray" hidden></div>
  <div id="tools">
    <button id="tool-brush" class="tool selected" data-tool="brush" aria-label="Brush">🖌️</button>
    <button id="tool-glitter" class="tool" data-tool="glitter" aria-label="Glitter">✨</button>
    <button id="tool-sticker" class="tool" data-tool="sticker" aria-label="Stickers">❤️</button>
    <button id="tool-clear" class="tool" aria-label="Clear nail">🧽</button>
    <button id="btn-done" class="tool done" aria-label="Done">✔️</button>
  </div>
  <div id="party" hidden>
    <div class="tada">🎉</div>
    <div class="row">
      <button id="btn-photo" class="big" aria-label="Photo">📸</button>
      <button id="btn-new" class="big" aria-label="New hand">🆕</button>
    </div>
  </div>
  <div id="fallback" hidden>
    <img id="fallback-img" alt="Your nails">
    <div class="hint">👆 hold to save</div>
    <button id="btn-fallback-close" class="big" aria-label="Close">✔️</button>
  </div>
</section>

<script type="module" src="./game.js"></script>
</body>
</html>
```

- [ ] **Step 8: Write style.css**

`nail-salon/style.css`:

```css
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body {
  margin: 0; height: 100%; overflow: hidden; overscroll-behavior: none;
  background: #ffe5ec; font-family: -apple-system, system-ui, sans-serif;
  touch-action: none; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;
}
body { position: fixed; inset: 0; }
.screen { position: absolute; inset: 0; display: flex; flex-direction: column; }
.screen[hidden] { display: none; }
button {
  border: 0; border-radius: 18px; background: #fff; font-size: 30px; line-height: 1;
  min-width: 56px; min-height: 56px; box-shadow: 0 3px 0 #e8a2b8; cursor: pointer; padding: 0;
}
button:active { transform: translateY(2px); box-shadow: 0 1px 0 #e8a2b8; }
.row { display: flex; gap: 12px; justify-content: center; align-items: center; }

/* shape picker */
#screen-shape { padding: max(12px, env(safe-area-inset-top)) 12px 12px; gap: 12px; align-items: center; }
.title { font-size: 56px; }
#skins button { width: 60px; height: 60px; border-radius: 50%; border: 4px solid #fff; }
#skins button.selected { border-color: #b5179e; }
#tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; max-width: 420px; flex: 1; min-height: 0; }
#tiles button { border-radius: 24px; overflow: hidden; min-height: 0; }
#tiles button:last-child { grid-column: 1 / -1; justify-self: center; width: calc(50% - 6px); }
#tiles canvas { width: 100%; height: 100%; display: block; }

/* salon */
#screen-salon { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
#palette { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; padding: 6px 4px 4px; }
#palette button { aspect-ratio: 1; min-width: 0; width: 100%; border-radius: 50%; border: 4px solid rgba(255,255,255,0.7); }
#palette button.selected { border-color: #fff; box-shadow: 0 0 0 3px #b5179e, 0 3px 0 #e8a2b8; transform: scale(1.08); }
#stage { position: relative; flex: 1; min-height: 0; }
#hand, #confetti { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
#confetti { pointer-events: none; }
.corner { position: absolute; top: 8px; width: 56px; height: 56px; font-size: 26px; opacity: 0.9; }
.corner.left { left: 8px; } .corner.right { right: 8px; }
#tray { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px; background: #fff0f5; }
#tray[hidden] { display: none; }
#tray button { font-size: 34px; }
#tools { display: flex; gap: 6px; padding: 8px 6px; background: #ffc2d1; }
#tools button { flex: 1; min-width: 0; height: 68px; font-size: 32px; }
#tools button.selected { background: #fff3b0; box-shadow: 0 0 0 3px #b5179e, 0 3px 0 #e8a2b8; }
#tools button.done { background: #b9fbc0; }
#tools button.armed { background: #ffd6a5; animation: pulse 0.7s infinite alternate; }
@keyframes pulse { from { transform: scale(1); } to { transform: scale(1.08); } }

/* celebration + fallback overlays */
#party, #fallback {
  position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end;
  align-items: center; gap: 16px; padding-bottom: max(24px, env(safe-area-inset-bottom));
  pointer-events: none;
}
#party[hidden], #fallback[hidden] { display: none; }
#party .tada { font-size: 96px; animation: pop 0.6s ease-out; }
@keyframes pop { from { transform: scale(0.2); } 60% { transform: scale(1.2); } to { transform: scale(1); } }
#party .row, #fallback button { pointer-events: auto; }
button.big { width: 120px; height: 120px; font-size: 56px; border-radius: 32px; }
#fallback { background: #fff0f5; pointer-events: auto; justify-content: center; }
#fallback img { max-width: 90%; max-height: 60%; border-radius: 16px; box-shadow: 0 6px 20px rgba(0,0,0,0.2); -webkit-touch-callout: default; }
#fallback .hint { font-size: 22px; color: #b5179e; }
```

- [ ] **Step 9: Write the first game.js (screens, hand drawing, test hooks)**

`nail-salon/game.js`:

```js
import { SHAPES, LOGICAL_W, LOGICAL_H, buildHand } from './geometry.js';
import { drawScene } from './render.js';

// ===== Parent config: edit these freely =====
export const CAPTION = 'Nail Salon';
export const PALETTE = [
  '#ff4d6d', '#ff85a1', '#ff9f1c', '#ffd60a', '#80ed99', '#38b000',
  '#48cae4', '#0077b6', '#9d4edd', '#ffafcc', '#ffffff', '#1d1d1d',
];
export const STICKERS = ['❤️', '⭐', '🌸', '💎', '🦋', '🌈', '☀️', '●'];
export const SKIN_TONES = ['#f8d9c4', '#e8b894', '#b87a4b', '#6b4226'];
// ============================================

const $ = id => document.getElementById(id);
const els = {
  shape: $('screen-shape'), salon: $('screen-salon'), skins: $('skins'), tiles: $('tiles'),
  stage: $('stage'), hand: $('hand'),
};

export const state = {
  screen: 'shape', shape: 'round', skin: 1, hand: null, layers: [],
  tool: 'brush', color: 0, sticker: 0, activeNail: -1, last: null, clearArmed: false,
  muted: false, dirty: true,
};
const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

// ---------- screens ----------
function showScreen(name) {
  state.screen = name;
  els.shape.hidden = name !== 'shape';
  els.salon.hidden = name !== 'salon';
}

function buildSkins() {
  els.skins.innerHTML = '';
  SKIN_TONES.forEach((color, i) => {
    const b = document.createElement('button');
    b.dataset.skin = i;
    b.style.background = color;
    b.setAttribute('aria-label', `Skin tone ${i + 1}`);
    b.classList.toggle('selected', i === state.skin);
    b.addEventListener('click', () => { state.skin = i; buildSkins(); buildTiles(); });
    els.skins.append(b);
  });
}

function buildTiles() {
  els.tiles.innerHTML = '';
  SHAPES.forEach(shape => {
    const b = document.createElement('button');
    b.dataset.shape = shape;
    b.setAttribute('aria-label', shape);
    const c = document.createElement('canvas');
    b.append(c);
    b.addEventListener('click', () => startSalon(shape));
    els.tiles.append(b);
    requestAnimationFrame(() => drawTile(c, shape));
  });
}

function drawTile(canvas, shape) {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, r.width * dpr); canvas.height = Math.max(1, r.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, r.height);
  // show the finger region, logical y 40..600
  const region = { x: 0, y: 40, w: LOGICAL_W, h: 560 };
  const s = Math.min(r.width / region.w, r.height / region.h);
  ctx.translate((r.width - region.w * s) / 2, (r.height - region.h * s) / 2);
  ctx.scale(s, s);
  ctx.translate(-region.x, -region.y);
  drawScene(ctx, buildHand(shape), SKIN_TONES[state.skin], null);
}

function startSalon(shape) {
  state.shape = shape;
  state.hand = buildHand(shape);
  state.layers = [];
  showScreen('salon');
  fitCanvas();
  state.dirty = true;
}

// ---------- main canvas ----------
function fitCanvas() {
  const r = els.stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  view.dpr = window.devicePixelRatio || 1;
  els.hand.width = Math.round(r.width * view.dpr);
  els.hand.height = Math.round(r.height * view.dpr);
  view.scale = Math.min(r.width / LOGICAL_W, r.height / LOGICAL_H);
  view.ox = (r.width - LOGICAL_W * view.scale) / 2;
  view.oy = r.height - LOGICAL_H * view.scale; // bottom-align the hand
  state.dirty = true;
}

function toLogical(e) {
  const r = els.hand.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.ox) / view.scale, y: (e.clientY - r.top - view.oy) / view.scale };
}

function toScreen(x, y) {
  const r = els.hand.getBoundingClientRect();
  return { x: r.left + view.ox + x * view.scale, y: r.top + view.oy + y * view.scale };
}

function render() {
  if (state.dirty && state.screen === 'salon' && state.hand) {
    state.dirty = false;
    const ctx = els.hand.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.hand.width, els.hand.height);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    drawScene(ctx, state.hand, SKIN_TONES[state.skin], state.layers);
  }
  requestAnimationFrame(render);
}

// ---------- wiring ----------
$('btn-home').addEventListener('click', () => showScreen('shape'));
new ResizeObserver(() => { if (state.screen === 'salon') fitCanvas(); }).observe(els.stage);

buildSkins();
buildTiles();
showScreen('shape');
requestAnimationFrame(render);

// ---------- test hooks ----------
window.__salon = {
  state, PALETTE, STICKERS, SKIN_TONES,
  hand: () => state.hand,
  toScreen,
  nailCenterScreen(i) {
    const { x, y, w, h } = state.hand.nails[i].rect;
    return toScreen(x + w / 2, y + h / 2);
  },
};
```

- [ ] **Step 10: Run e2e to verify it passes**

Run: `npx playwright test tests/e2e/shell.spec.mjs`
Expected: 5 passed. If the palm pixel test fails, check that `view.oy` bottom-aligns and that `toScreen` adds `r.left`/`r.top`.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tools/serve.mjs playwright.config.mjs nail-salon tests/e2e
git commit -m "Add game shell, hand rendering, shape picker, and Playwright setup"
```

---

### Task 3: Nail layers and the clipped brush

**Files:**
- Create: `nail-salon/paint.js`
- Modify: `nail-salon/game.js` (create layers in `startSalon`, pointer handling, palette, brush tool, more test hooks)
- Test: `tests/e2e/brush.spec.mjs`

**Interfaces:**
- Consumes: `hitNail`, `interpolate`, `pointInPolygon` from geometry; `nailPath` from render.
- Produces `paint.js`:
  - `class NailLayer { constructor(nail, dpr); canvas; ox; oy; w; h; paint(x,y,color,radius); glitter(x,y,color,radius); sticker(x,y,emoji,size); dot(x,y,color,radius); clear(); alphaAt(x,y):number; hasPaint():boolean; leakCount():number }` where x,y are logical coords.
- Produces test hooks: `window.__salon.layers()`, `layerAlphaAt(i,x,y)`, `layerHasPaint(i)`, `layerLeak(i)`, `outsidePoint(i)` (a logical point inside the bounds but outside the polygon), `toolButton` clicks work via DOM.

- [ ] **Step 1: Write the failing tests**

`tests/e2e/brush.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, drag } from './helpers.mjs';

const hasPaint = (page, i) => page.evaluate(i => window.__salon.layerHasPaint(i), i);
const leak = (page, i) => page.evaluate(i => window.__salon.layerLeak(i), i);

test('dragging inside a nail paints inside and not outside it', async ({ page }) => {
  await openSalon(page);
  const c = await nailCenter(page, 2);
  await drag(page, { x: c.x, y: c.y - 15 }, { x: c.x, y: c.y + 15 });
  const inside = await page.evaluate(() => {
    const n = window.__salon.hand().nails[2].rect;
    return window.__salon.layerAlphaAt(2, n.x + n.w / 2, n.y + n.h / 2);
  });
  expect(inside).toBeGreaterThan(0);
  const outside = await page.evaluate(() => {
    const p = window.__salon.outsidePoint(2);
    return window.__salon.layerAlphaAt(2, p.x, p.y);
  });
  expect(outside).toBe(0);
  expect(await leak(page, 2)).toBe(0);
});

test('a drag that starts outside every nail paints nothing', async ({ page }) => {
  await openSalon(page);
  const palm = await page.evaluate(() => window.__salon.toScreen(350, 700));
  const c = await nailCenter(page, 1);
  await drag(page, palm, c);
  for (let i = 0; i < 5; i++) expect(await hasPaint(page, i)).toBe(false);
});

test('a drag from nail 1 into nail 2 paints only nail 1', async ({ page }) => {
  await openSalon(page);
  const a = await nailCenter(page, 1);
  const b = await nailCenter(page, 2);
  await drag(page, a, b, 20);
  expect(await hasPaint(page, 1)).toBe(true);
  expect(await hasPaint(page, 2)).toBe(false);
  expect(await leak(page, 1)).toBe(0);
});

test('the selected palette color is what gets painted', async ({ page }) => {
  await openSalon(page);
  await page.click('#palette button[data-color="3"]'); // #ffd60a yellow
  const c = await nailCenter(page, 0);
  await drag(page, { x: c.x - 5, y: c.y }, { x: c.x + 5, y: c.y });
  const rgba = await page.evaluate(() => {
    const n = window.__salon.hand().nails[0].rect;
    return window.__salon.layerPixelAt(0, n.x + n.w / 2, n.y + n.h / 2);
  });
  expect(rgba[0]).toBeGreaterThan(240);
  expect(rgba[1]).toBeGreaterThan(190);
  expect(rgba[2]).toBeLessThan(60);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/brush.spec.mjs`
Expected: FAIL, `layerHasPaint is not a function` or similar.

- [ ] **Step 3: Write paint.js**

`nail-salon/paint.js`:

```js
import { nailPath } from './render.js';
import { pointInPolygon } from './geometry.js';

// One offscreen canvas per nail. All drawing is clipped to the nail outline.
// Public x,y are logical (hand) coordinates.
export class NailLayer {
  constructor(nail, dpr = 1) {
    this.nail = nail;
    this.dpr = dpr;
    const b = nail.bounds;
    this.ox = Math.floor(b.minX) - 1;
    this.oy = Math.floor(b.minY) - 1;
    this.w = Math.ceil(b.maxX) - this.ox + 2;
    this.h = Math.ceil(b.maxY) - this.oy + 2;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.scale(dpr, dpr);
    this.ctx.translate(-this.ox, -this.oy);
    this.path = nailPath(nail);
  }

  _clipped(fn) {
    const c = this.ctx;
    c.save();
    c.clip(this.path);
    fn(c);
    c.restore();
  }

  paint(x, y, color, radius) {
    this._clipped(c => {
      const g = c.createRadialGradient(x, y, radius * 0.55, x, y, radius);
      g.addColorStop(0, color);
      g.addColorStop(1, color + '00');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
    });
  }

  glitter(x, y, color, radius) {
    const colors = [color, '#ffffff', '#ffd700'];
    this._clipped(c => {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * radius;
        c.fillStyle = colors[i % 3];
        c.beginPath();
        c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + Math.random() * 1.5, 0, Math.PI * 2);
        c.fill();
      }
    });
  }

  sticker(x, y, emoji, size) {
    this._clipped(c => {
      c.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#000';
      c.fillText(emoji, x, y);
    });
  }

  dot(x, y, color, radius) {
    this._clipped(c => {
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
    });
  }

  clear() {
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.restore();
  }

  // ---- probes (used by tests and by hasPaint) ----
  pixelAt(x, y) {
    const px = Math.round((x - this.ox) * this.dpr), py = Math.round((y - this.oy) * this.dpr);
    if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height) return [0, 0, 0, 0];
    return Array.from(this.ctx.getImageData(px, py, 1, 1).data);
  }
  alphaAt(x, y) { return this.pixelAt(x, y)[3]; }

  hasPaint() {
    const d = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  }

  // Number of painted device pixels that sit clearly (2 logical px) outside the outline.
  leakCount() {
    const d = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    const pts = this.nail.points;
    let leaks = 0;
    for (let py = 0; py < this.canvas.height; py++) for (let px = 0; px < this.canvas.width; px++) {
      if (d[(py * this.canvas.width + px) * 4 + 3] === 0) continue;
      const x = px / this.dpr + this.ox, y = py / this.dpr + this.oy;
      const nearInside = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => pointInPolygon(x + dx, y + dy, pts));
      if (!nearInside) leaks++;
    }
    return leaks;
  }
}
```

- [ ] **Step 4: Add layers, palette, and brush input to game.js**

Modify `nail-salon/game.js`:

Change the imports at the top to:

```js
import { SHAPES, LOGICAL_W, LOGICAL_H, buildHand, hitNail, interpolate, pointInPolygon } from './geometry.js';
import { drawScene } from './render.js';
import { NailLayer } from './paint.js';
```

Add `palette: $('palette')` to `els`.

Replace `startSalon` with:

```js
function startSalon(shape) {
  state.shape = shape;
  state.hand = buildHand(shape);
  showScreen('salon');
  fitCanvas();
  const layerDpr = Math.min(4, Math.max(1, Math.ceil(view.scale * view.dpr)));
  state.layers = state.hand.nails.map(n => new NailLayer(n, layerDpr));
  state.activeNail = -1;
  state.dirty = true;
}
```

Add after `buildTiles`:

```js
function buildPalette() {
  els.palette.innerHTML = '';
  PALETTE.forEach((color, i) => {
    const b = document.createElement('button');
    b.dataset.color = i;
    b.style.background = color;
    b.setAttribute('aria-label', `Color ${i + 1}`);
    b.classList.toggle('selected', i === state.color);
    b.addEventListener('click', () => { state.color = i; buildPalette(); });
    els.palette.append(b);
  });
}
```

Add a painting section before `// ---------- wiring ----------`:

```js
// ---------- painting ----------
function brushRadius(nail) { return nail.rect.w / 6; }

function applyTool(i, p, isStart) {
  const L = state.layers[i];
  const nail = state.hand.nails[i];
  const color = PALETTE[state.color];
  const r = brushRadius(nail);
  if (state.tool === 'brush') L.paint(p.x, p.y, color, r);
  state.dirty = true;
}

els.hand.addEventListener('pointerdown', e => {
  e.preventDefault();
  const p = toLogical(e);
  const i = hitNail(state.hand, p.x, p.y);
  if (i < 0) return;
  els.hand.setPointerCapture(e.pointerId);
  state.activeNail = i;
  state.last = p;
  applyTool(i, p, true);
});

els.hand.addEventListener('pointermove', e => {
  if (state.activeNail < 0) return;
  const p = toLogical(e);
  const nail = state.hand.nails[state.activeNail];
  for (const q of interpolate(state.last, p, brushRadius(nail) / 3)) applyTool(state.activeNail, q, false);
  state.last = p;
});

const endStroke = () => { state.activeNail = -1; state.last = null; };
els.hand.addEventListener('pointerup', endStroke);
els.hand.addEventListener('pointercancel', endStroke);
```

In the wiring section add `buildPalette();` after `buildTiles();`.

Extend the test hooks object with:

```js
  layers: () => state.layers,
  layerAlphaAt: (i, x, y) => state.layers[i].alphaAt(x, y),
  layerPixelAt: (i, x, y) => state.layers[i].pixelAt(x, y),
  layerHasPaint: i => state.layers[i].hasPaint(),
  layerLeak: i => state.layers[i].leakCount(),
  outsidePoint(i) {
    const n = state.hand.nails[i];
    const b = n.bounds;
    const candidates = [[b.minX + 2, b.minY + 2], [b.maxX - 2, b.minY + 2], [b.minX + 2, b.maxY - 2], [b.maxX - 2, b.maxY - 2]];
    const c = candidates.find(([x, y]) => !pointInPolygon(x, y, n.points));
    return { x: c[0], y: c[1] };
  },
```

- [ ] **Step 5: Run brush tests and shell tests**

Run: `npx playwright test`
Expected: all pass. If `outsidePoint` returns undefined for square nails, that is expected to be impossible: the cuticle arc leaves the bottom corners outside for every shape.

- [ ] **Step 6: Commit**

```bash
git add nail-salon/paint.js nail-salon/game.js tests/e2e/brush.spec.mjs
git commit -m "Add clipped nail layers, palette, and brush painting"
```

---

### Task 4: Glitter, stickers, and clear nail

**Files:**
- Modify: `nail-salon/game.js` (tool selection, sticker tray, glitter, clear-arm flow)
- Test: `tests/e2e/tools.spec.mjs`

**Interfaces:**
- Consumes: `NailLayer.glitter/sticker/dot/clear`.
- Produces: tool buttons toggle `.selected`; `#tool-clear` gets `.armed` while waiting for a nail tap; `#tray` holds `button[data-sticker]`; `#tool-sticker` text shows the selected sticker.

- [ ] **Step 1: Write the failing tests**

`tests/e2e/tools.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, drag } from './helpers.mjs';

const hasPaint = (page, i) => page.evaluate(i => window.__salon.layerHasPaint(i), i);
const leak = (page, i) => page.evaluate(i => window.__salon.layerLeak(i), i);

test('glitter paints inside the nail only', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-glitter');
  await expect(page.locator('#tool-glitter')).toHaveClass(/selected/);
  const c = await nailCenter(page, 3);
  await drag(page, { x: c.x, y: c.y - 10 }, { x: c.x, y: c.y + 10 });
  expect(await hasPaint(page, 3)).toBe(true);
  expect(await leak(page, 3)).toBe(0);
});

test('sticker tray opens, picks a sticker, and a tap near the edge does not leak', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-sticker');
  await expect(page.locator('#tray')).toBeVisible();
  await expect(page.locator('#tray button[data-sticker]')).toHaveCount(8);
  await page.click('#tray button[data-sticker="1"]'); // star
  await expect(page.locator('#tray')).toBeHidden();
  await expect(page.locator('#tool-sticker')).toHaveText('⭐');
  const edge = await page.evaluate(() => {
    const n = window.__salon.hand().nails[2].rect;
    return window.__salon.toScreen(n.x + n.w * 0.12, n.y + n.h * 0.5);
  });
  await page.mouse.click(edge.x, edge.y);
  expect(await hasPaint(page, 2)).toBe(true);
  expect(await leak(page, 2)).toBe(0);
});

test('dragging with the sticker tool places only one sticker', async ({ page }) => {
  await openSalon(page, 'square');
  await page.click('#tool-sticker');
  await page.click('#tray button[data-sticker="7"]'); // solid dot in the selected color
  const c = await nailCenter(page, 2);
  await drag(page, { x: c.x - 8, y: c.y }, { x: c.x + 8, y: c.y }, 8);
  // the dot is placed at the start point; the end point must still be empty
  const endAlpha = await page.evaluate(() => {
    const n = window.__salon.hand().nails[2].rect;
    return window.__salon.layerAlphaAt(2, n.x + n.w * 0.9, n.y + n.h * 0.5);
  });
  expect(endAlpha).toBe(0);
});

test('clear nail wipes only the tapped nail', async ({ page }) => {
  await openSalon(page);
  for (const i of [0, 1]) {
    const c = await nailCenter(page, i);
    await drag(page, { x: c.x, y: c.y - 8 }, { x: c.x, y: c.y + 8 });
  }
  await page.click('#tool-clear');
  await expect(page.locator('#tool-clear')).toHaveClass(/armed/);
  const c0 = await nailCenter(page, 0);
  await page.mouse.click(c0.x, c0.y);
  await expect(page.locator('#tool-clear')).not.toHaveClass(/armed/);
  expect(await hasPaint(page, 0)).toBe(false);
  expect(await hasPaint(page, 1)).toBe(true);
  // the previous tool is back in use
  await expect(page.locator('#tool-brush')).toHaveClass(/selected/);
});

test('tapping the palm while clear is armed cancels it', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-clear');
  const palm = await page.evaluate(() => window.__salon.toScreen(350, 700));
  await page.mouse.click(palm.x, palm.y);
  await expect(page.locator('#tool-clear')).not.toHaveClass(/armed/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/tools.spec.mjs`
Expected: FAIL (tool buttons do nothing yet).

- [ ] **Step 3: Implement tools in game.js**

Add to `els`: `tray: $('tray'), toolButtons: [...document.querySelectorAll('#tools .tool[data-tool]')], stickerBtn: $('tool-sticker'), clearBtn: $('tool-clear')`.

Replace `applyTool` with:

```js
function applyTool(i, p, isStart) {
  const L = state.layers[i];
  const nail = state.hand.nails[i];
  const color = PALETTE[state.color];
  const r = brushRadius(nail);
  if (state.tool === 'brush') {
    L.paint(p.x, p.y, color, r);
  } else if (state.tool === 'glitter') {
    L.glitter(p.x, p.y, color, r);
  } else if (state.tool === 'sticker' && isStart) {
    const s = STICKERS[state.sticker];
    if (s === '●') L.dot(p.x, p.y, color, nail.rect.w * 0.22);
    else L.sticker(p.x, p.y, s, nail.rect.w * 0.45);
  }
  state.dirty = true;
}
```

Add after `buildPalette`:

```js
function selectTool(tool) {
  state.tool = tool;
  els.toolButtons.forEach(b => b.classList.toggle('selected', b.dataset.tool === tool));
}

function buildTray() {
  els.tray.innerHTML = '';
  STICKERS.forEach((s, i) => {
    const b = document.createElement('button');
    b.dataset.sticker = i;
    b.textContent = s;
    b.setAttribute('aria-label', `Sticker ${i + 1}`);
    b.addEventListener('click', () => {
      state.sticker = i;
      els.stickerBtn.textContent = s;
      els.tray.hidden = true;
      selectTool('sticker');
    });
    els.tray.append(b);
  });
}

function armClear(on) {
  state.clearArmed = on;
  els.clearBtn.classList.toggle('armed', on);
}
```

Change the `pointerdown` handler to:

```js
els.hand.addEventListener('pointerdown', e => {
  e.preventDefault();
  const p = toLogical(e);
  const i = hitNail(state.hand, p.x, p.y);
  if (state.clearArmed) {
    if (i >= 0) { state.layers[i].clear(); state.dirty = true; }
    armClear(false);
    return;
  }
  if (i < 0) return;
  els.hand.setPointerCapture(e.pointerId);
  state.activeNail = i;
  state.last = p;
  applyTool(i, p, true);
});
```

In the wiring section add:

```js
els.toolButtons.forEach(b => b.addEventListener('click', () => {
  armClear(false);
  if (b.dataset.tool === 'sticker') els.tray.hidden = !els.tray.hidden;
  else els.tray.hidden = true;
  selectTool(b.dataset.tool);
}));
els.clearBtn.addEventListener('click', () => { els.tray.hidden = true; armClear(!state.clearArmed); });
buildTray();
```

Also make `showScreen` hide the tray and disarm clear whenever the screen changes: add `els.tray.hidden = true; armClear(false);` at the start of `showScreen` (define `armClear` above it or move `showScreen` below; ES modules hoist function declarations so order does not matter).

- [ ] **Step 4: Run all e2e tests**

Run: `npx playwright test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add nail-salon/game.js tests/e2e/tools.spec.mjs
git commit -m "Add glitter, sticker tray, and clear-nail tools"
```

---

### Task 5: Celebration and photo export

**Files:**
- Modify: `nail-salon/game.js` (Done, confetti, photo export, fallback, New hand)
- Test: `tests/e2e/party.spec.mjs`

**Interfaces:**
- Produces: `window.__salon.exportPhoto(): Promise<Blob>`; `#party` visible after Done; `#confetti` canvas animates for 3 s; `#fallback img` shown when share is unavailable.

- [ ] **Step 1: Write the failing tests**

`tests/e2e/party.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, drag } from './helpers.mjs';

test('Done shows the celebration and confetti, New hand goes back to shapes', async ({ page }) => {
  await openSalon(page);
  await page.click('#btn-done');
  await expect(page.locator('#party')).toBeVisible();
  await expect(page.locator('#confetti')).toBeVisible();
  await page.click('#btn-new');
  await expect(page.locator('#screen-shape')).toBeVisible();
  await expect(page.locator('#party')).toBeHidden();
});

test('exportPhoto returns a PNG of 1200x1600 with the painted nails', async ({ page }) => {
  await openSalon(page);
  const c = await nailCenter(page, 1);
  await drag(page, { x: c.x, y: c.y - 10 }, { x: c.x, y: c.y + 10 });
  await page.click('#btn-done');
  const info = await page.evaluate(async () => {
    const blob = await window.__salon.exportPhoto();
    const bmp = await createImageBitmap(blob);
    return { type: blob.type, size: blob.size, w: bmp.width, h: bmp.height };
  });
  expect(info.type).toBe('image/png');
  expect(info.size).toBeGreaterThan(10_000);
  expect(info.w).toBe(1200);
  expect(info.h).toBe(1600);
});

test('Photo falls back to an on-screen image when sharing is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await openSalon(page);
  await page.click('#btn-done');
  await page.click('#btn-photo');
  await expect(page.locator('#fallback')).toBeVisible();
  const w = await page.locator('#fallback-img').evaluate(img => img.naturalWidth);
  expect(w).toBe(1200);
  await page.click('#btn-fallback-close');
  await expect(page.locator('#fallback')).toBeHidden();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/party.spec.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement celebration and photo in game.js**

Add to `els`: `party: $('party'), confetti: $('confetti'), fallback: $('fallback'), fallbackImg: $('fallback-img')`.

Add a section before `// ---------- wiring ----------`:

```js
// ---------- celebration ----------
function startConfetti(seconds = 3) {
  const c = els.confetti;
  const r = els.stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  c.hidden = false;
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 140 }, () => ({
    x: Math.random() * r.width, y: -20 - Math.random() * r.height * 0.8,
    vx: (Math.random() - 0.5) * 80, vy: 140 + Math.random() * 200,
    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
    size: 7 + Math.random() * 9, color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    star: Math.random() < 0.2,
  }));
  const t0 = performance.now();
  let last = t0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, r.width, r.height);
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.star) { ctx.font = `${p.size * 2}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✨', 0, 0); }
      else { ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
      ctx.restore();
    }
    if (now - t0 < seconds * 1000 && !c.hidden) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, r.width, r.height); c.hidden = true; }
  }
  requestAnimationFrame(frame);
}

function showParty() {
  els.tray.hidden = true;
  armClear(false);
  state.activeNail = -1;
  els.party.hidden = false;
  startConfetti(3);
}

function hideParty() {
  els.party.hidden = true;
  els.confetti.hidden = true;
}

// ---------- photo ----------
async function exportPhoto() {
  const S = 2;
  const out = document.createElement('canvas');
  out.width = LOGICAL_W * S; out.height = LOGICAL_H * S;
  const ctx = out.getContext('2d');
  ctx.scale(S, S);
  ctx.fillStyle = '#fff0f5';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  drawScene(ctx, state.hand, SKIN_TONES[state.skin], state.layers);
  ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#b5179e';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`✨ ${CAPTION} ✨`, LOGICAL_W - 20, LOGICAL_H - 20);
  return new Promise(res => out.toBlob(res, 'image/png'));
}

async function sharePhoto() {
  let blob;
  try {
    blob = await exportPhoto();
    const file = new File([blob], 'nails.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: CAPTION });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // she closed the sheet
        console.warn('share failed, showing fallback', err);
      }
    }
  } catch (err) {
    console.warn('photo export failed', err);
    if (!blob) return;
  }
  if (els.fallbackImg.src) URL.revokeObjectURL(els.fallbackImg.src);
  els.fallbackImg.src = URL.createObjectURL(blob);
  els.fallback.hidden = false;
}
```

In wiring add:

```js
$('btn-done').addEventListener('click', showParty);
$('btn-new').addEventListener('click', () => { hideParty(); showScreen('shape'); });
$('btn-photo').addEventListener('click', sharePhoto);
$('btn-fallback-close').addEventListener('click', () => { els.fallback.hidden = true; });
```

Make `showScreen` also call `hideParty()` and hide `els.fallback`. Add `exportPhoto` to the `window.__salon` hooks.

- [ ] **Step 4: Run all e2e tests**

Run: `npx playwright test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add nail-salon/game.js tests/e2e/party.spec.mjs
git commit -m "Add celebration, confetti, and photo export with share-sheet fallback"
```

---

### Task 6: Sound and mute

**Files:**
- Create: `nail-salon/audio.js`
- Modify: `nail-salon/game.js`
- Test: `tests/e2e/audio.spec.mjs`

**Interfaces:**
- Produces `audio.js`: `initAudio()`, `setMuted(bool)`, `isMuted()`, `pop()`, `tinkle()`, `chime()`. All are safe to call before init and when muted (no-ops).
- localStorage key `nail-salon-muted` = `'1'` or `'0'`.

- [ ] **Step 1: Write the failing test**

`tests/e2e/audio.spec.mjs`:

```js
import { test, expect } from '@playwright/test';
import { openSalon } from './helpers.mjs';

test('mute toggles, persists across reload, and never throws', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openSalon(page);
  await expect(page.locator('#btn-mute')).toHaveText('🔊');
  await page.click('#btn-mute');
  await expect(page.locator('#btn-mute')).toHaveText('🔇');
  expect(await page.evaluate(() => localStorage.getItem('nail-salon-muted'))).toBe('1');
  await openSalon(page);
  await expect(page.locator('#btn-mute')).toHaveText('🔇');
  await page.click('#btn-done'); // plays the chime (muted)
  await page.click('#btn-mute');
  await page.click('#btn-new');
  await openSalon(page);
  await page.click('#btn-done'); // plays the chime for real
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/audio.spec.mjs`
Expected: FAIL on the 🔇 text.

- [ ] **Step 3: Write audio.js**

`nail-salon/audio.js`:

```js
// Tiny synthesized sounds. No audio files.
let ctx = null;
let muted = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = AC ? new AC() : null;
  } catch (err) {
    console.warn('audio unavailable', err);
    ctx = null;
  }
}

export function setMuted(m) { muted = !!m; }
export function isMuted() { return muted; }

function tone(freq, dur, type = 'sine', gain = 0.2, when = 0) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (err) {
    console.warn('tone failed', err);
  }
}

export function pop() { tone(620, 0.08, 'triangle', 0.15); }
export function tinkle() { tone(1400 + Math.random() * 1600, 0.12, 'sine', 0.05); }
export function chime() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.6, 'sine', 0.18, i * 0.14)); }
```

- [ ] **Step 4: Wire audio into game.js**

Add import: `import { initAudio, setMuted, pop, tinkle, chime } from './audio.js';`

Add to `els`: `muteBtn: $('btn-mute')`.

Add near the wiring section:

```js
function applyMute(m) {
  state.muted = m;
  setMuted(m);
  els.muteBtn.textContent = m ? '🔇' : '🔊';
  try { localStorage.setItem('nail-salon-muted', m ? '1' : '0'); } catch { /* private mode */ }
}
try { applyMute(localStorage.getItem('nail-salon-muted') === '1'); } catch { applyMute(false); }
els.muteBtn.addEventListener('click', () => applyMute(!state.muted));

// every button pops; the first touch anywhere unlocks audio on iOS
document.addEventListener('pointerdown', initAudio, { capture: true });
document.addEventListener('click', e => { if (e.target.closest('button')) pop(); }, { capture: true });
```

In `applyTool`, inside the glitter branch add `if (Math.random() < 0.15) tinkle();`. In `showParty` add `chime();` as the first line.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: unit and e2e all pass.

- [ ] **Step 6: Commit**

```bash
git add nail-salon/audio.js nail-salon/game.js tests/e2e/audio.spec.mjs
git commit -m "Add synthesized sounds and a persistent mute toggle"
```

---

### Task 7: Kid-proofing, PWA manifest, icons, and offline service worker

**Files:**
- Create: `nail-salon/manifest.webmanifest`, `nail-salon/sw.js`, `tools/make-icons.mjs`, `nail-salon/icon-192.png`, `nail-salon/icon-512.png`, `nail-salon/apple-touch-icon.png`
- Modify: `nail-salon/game.js` (gesture guards, SW registration)
- Test: `tests/e2e/kidproof.spec.mjs`

**Interfaces:**
- Produces: service worker registered only when `location.hostname` is not `localhost`/`127.0.0.1`; cache name `nail-salon-v1` (bump the number when shipping changes).

- [ ] **Step 1: Write the failing tests**

`tests/e2e/kidproof.spec.mjs`:

```js
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/kidproof.spec.mjs`
Expected: the manifest test FAILS (404); others may already pass.

- [ ] **Step 3: Write the manifest**

`nail-salon/manifest.webmanifest`:

```json
{
  "name": "Nail Salon",
  "short_name": "Nails",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffe5ec",
  "theme_color": "#ffb3c6",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 4: Write the icon generator and run it**

`tools/make-icons.mjs`:

```js
// Renders the app icon at the sizes iOS and the manifest need.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../nail-salon/', import.meta.url).pathname;
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
```

Run: `npm run icons`
Expected: three PNGs in `nail-salon/`. Open one to confirm it shows a pink square with the nail polish emoji.

- [ ] **Step 5: Write the service worker**

`nail-salon/sw.js`:

```js
// Offline cache for the nail salon. Bump CACHE when you change any file.
const CACHE = 'nail-salon-v1';
const FILES = [
  './', './index.html', './style.css', './game.js', './geometry.js', './render.js',
  './paint.js', './audio.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cached copy first for instant offline start; refresh the cache in the background.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
```

- [ ] **Step 6: Add gesture guards and SW registration to game.js**

Append to the wiring section:

```js
// ---------- kid-proofing ----------
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => { if (!e.target.closest('#fallback')) e.preventDefault(); });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd < 300 && !e.target.closest('button')) e.preventDefault(); // no double-tap zoom
  lastTouchEnd = now;
}, { passive: false });

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('sw failed', err));
}
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: all pass. If the 56px test fails on palette swatches, reduce `#palette` gap/padding rather than swatch count: at 393 px width, `(393 - 8 - 5*4) / 6 = 62.5` so it should pass.

- [ ] **Step 8: Commit**

```bash
git add nail-salon tools/make-icons.mjs tests/e2e/kidproof.spec.mjs
git commit -m "Add PWA manifest, icons, offline service worker, and gesture guards"
```

---

### Task 8: Launcher page and README

**Files:**
- Create: `index.html`, `README.md`
- Test: `tests/e2e/launcher.spec.mjs`

- [ ] **Step 1: Write the failing test**

`tests/e2e/launcher.spec.mjs`:

```js
import { test, expect } from '@playwright/test';

test('launcher lists the nail salon and opens it', async ({ page }) => {
  await page.goto('/');
  const tile = page.locator('a.tile[href="./nail-salon/"]');
  await expect(tile).toHaveCount(1);
  await expect(tile).toContainText('Nail Salon');
  const box = await tile.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(120);
  await tile.click();
  await expect(page).toHaveURL(/\/nail-salon\//);
  await expect(page.locator('#screen-shape')).toBeVisible();
});

test('launcher has no off-site links', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('a[href]').evaluateAll(as => as.map(a => a.getAttribute('href')));
  for (const h of hrefs) expect(h.startsWith('./')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx playwright test tests/e2e/launcher.spec.mjs`
Expected: FAIL (404 on `/`).

- [ ] **Step 3: Write the launcher**

`index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#ffe5ec">
<title>Kids Games</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; min-height: 100%; background: #ffe5ec; font-family: -apple-system, system-ui, sans-serif;
    -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; overscroll-behavior: none; }
  main { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: max(24px, env(safe-area-inset-top)) 16px 24px; max-width: 520px; margin: 0 auto; }
  h1 { grid-column: 1 / -1; text-align: center; font-size: 40px; margin: 0 0 8px; }
  .tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    min-height: 160px; background: #fff; border-radius: 28px; box-shadow: 0 4px 0 #e8a2b8; text-decoration: none; color: #b5179e; font-weight: 700; font-size: 20px; }
  .tile .icon { font-size: 72px; line-height: 1; }
  .tile:active { transform: translateY(3px); box-shadow: 0 1px 0 #e8a2b8; }
</style>
</head>
<body>
<main>
  <h1>🎮</h1>
  <a class="tile" href="./nail-salon/"><span class="icon">💅</span>Nail Salon</a>
  <!-- Add the next game here: <a class="tile" href="./game-folder/"><span class="icon">🎨</span>Name</a> -->
</main>
</body>
</html>
```

- [ ] **Step 4: Write README.md**

```markdown
# Kids Games

Small, ad-free web games for a phone. One folder per game, a launcher at the root.

## Play on a phone
1. Open the site link in Safari.
2. Open a game, tap Share, then "Add to Home Screen".
3. The icon on the home screen opens the game full screen and works offline.

## Games
- `nail-salon/` — paint nails with a brush that stays inside the lines, glitter, stickers, and a photo at the end.
  Parent settings (caption, colors, stickers, skin tones) are at the top of `nail-salon/game.js`.
  After changing any file in the folder, bump `CACHE` in `nail-salon/sw.js` so phones pick up the update.

## Adding a game
1. Create a new folder with its own `index.html`, `manifest.webmanifest`, and `sw.js` (copy from `nail-salon/`).
2. Add a tile to the root `index.html`.

## Development
```
npm install
npx playwright install chromium
npm test          # unit + browser tests
npm run serve     # http://localhost:4173, open on a phone on the same Wi-Fi via your Mac's IP
```
```

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add index.html README.md tests/e2e/launcher.spec.mjs
git commit -m "Add launcher page and README"
```

---

### Task 9: Deploy to GitHub Pages and verify on the phone

**Files:** none created; this task publishes.

Creating a public repository is outward-facing: **confirm with the user before Step 2** and tell them the repo name and that it will be public.

- [ ] **Step 1: Check tooling**

Run: `gh --version && gh auth status`
Expected: a version and "Logged in to github.com". If `gh` is missing: `brew install gh`, then `gh auth login` (the user must run the login themselves with `! gh auth login`). If the user prefers not to use GitHub, skip to Step 5.

- [ ] **Step 2: Create the repo and push (after user confirmation)**

```bash
cd "/Users/jamesmednick/Documents/KIDS GAMES"
git branch -M main
gh repo create kids-games --public --source=. --push
```
Expected: the repo `<user>/kids-games` exists with `main` pushed.

- [ ] **Step 3: Enable Pages from the main branch root**

```bash
gh api -X POST "repos/{owner}/kids-games/pages" -f "source[branch]=main" -f "source[path]=/"
```
Expected: JSON containing `"html_url": "https://<user>.github.io/kids-games/"`. If it returns 409 (already exists) that is fine.

- [ ] **Step 4: Verify the deployed site**

Wait about a minute, then:
```bash
curl -sI "https://<user>.github.io/kids-games/nail-salon/" | head -1
curl -sI "https://<user>.github.io/kids-games/nail-salon/sw.js" | head -1
```
Expected: `HTTP/2 200` for both. Open `https://<user>.github.io/kids-games/` in a desktop browser once to confirm the launcher renders.

- [ ] **Step 5: Fallback if not using GitHub**

Go to https://app.netlify.com/drop, drag the whole `KIDS GAMES` folder (minus `node_modules`) onto the page, and copy the resulting `https://….netlify.app` link. Verify with the same two `curl` commands against that host.

- [ ] **Step 6: Phone checklist (manual, the user does this)**

Report these steps to the user in the final message:
1. Open the link in Safari on the iPhone, tap Nail Salon.
2. Tap Share, then "Add to Home Screen", then Add.
3. Open it from the home screen: no address bar should show.
4. Pick a shape, paint, add glitter and a sticker, tap Done, tap the camera, choose "Save Image".
5. Turn on Airplane Mode, close and reopen the game: it should still load.

---

## Self-review

**Spec coverage.** Shape picker with five shapes and four skin tones: Task 2. Salon layout, palette, tools, home, mute: Tasks 2, 3, 4, 6. Clipped painting with brush, glitter, stickers, dot, clear-nail arm-and-tap: Tasks 3, 4. Celebration, confetti, chime, photo via share sheet with fallback, new hand: Tasks 5, 6. Sound synthesized, audio unlock on first touch, mute persisted: Task 6. Kid-proofing (zoom, overscroll, callouts, no links, standalone, no network): Tasks 2 (CSS/meta) and 7. Config constants: Task 2. Error handling (share, SW, audio, no throws): Tasks 5, 6, 7. Offline via service worker: Task 7. Launcher and one-folder-per-game: Task 8. Hosting and phone verification: Task 9. Every spec test bullet maps to a test in Tasks 1 to 8.

**Placeholders.** None; every code step carries its full content.

**Type consistency.** `NailLayer` fields `canvas, ox, oy, w, h` are what `drawScene` reads. Hook names `layerHasPaint`, `layerLeak`, `layerAlphaAt`, `layerPixelAt`, `outsidePoint`, `nailCenterScreen`, `toScreen`, `hand`, `exportPhoto` are used identically across tests. `selectTool` and `armClear` are declared as function declarations so `showScreen` may call them regardless of order.
