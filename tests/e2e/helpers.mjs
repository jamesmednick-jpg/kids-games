export async function openSalon(page, shape = 'round') {
  await page.goto('/nail-salon/index.html');
  await page.click(`[data-shape="${shape}"]`);
  await page.waitForSelector('#screen-salon:not([hidden])');
  await page.waitForFunction(() => window.__salon && window.__salon.hand() && window.__salon.state.frames > 0);
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
export async function mainPixel(page, x, y) {
  await page.waitForFunction(() => window.__salon.state.frames > 0 && !window.__salon.state.dirty);
  return page.evaluate(([x, y]) => {
    const c = document.getElementById('hand');
    const r = c.getBoundingClientRect();
    const dpr = c.width / r.width;
    const d = c.getContext('2d').getImageData(Math.round((x - r.left) * dpr), Math.round((y - r.top) * dpr), 1, 1).data;
    return Array.from(d);
  }, [x, y]);
}

// Tap nail i in the whole-hand view and wait for the zoom animation to finish.
export async function zoomNail(page, i) {
  await page.waitForFunction(() => !window.__salon.state.animating);
  const c = await nailCenter(page, i);
  await page.mouse.click(c.x, c.y);
  await page.waitForFunction(i => window.__salon.state.zoomNail === i && !window.__salon.state.animating, i);
}

export async function zoomOut(page) {
  await page.click('#btn-back');
  await page.waitForFunction(() => window.__salon.state.zoomNail === -1 && !window.__salon.state.animating);
}

// Screen-space rect of nail i (client coords).
export function nailRect(page, i) {
  return page.evaluate(i => {
    const n = window.__salon.hand().nails[i].rect;
    const a = window.__salon.toScreen(n.x, n.y);
    const z = window.__salon.toScreen(n.x + n.w, n.y + n.h);
    return { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
  }, i);
}

export function stageBox(page) {
  return page.locator('#stage').boundingBox();
}
