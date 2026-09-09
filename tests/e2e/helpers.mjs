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
export function mainPixel(page, x, y) {
  return page.evaluate(([x, y]) => {
    const c = document.getElementById('hand');
    const r = c.getBoundingClientRect();
    const dpr = c.width / r.width;
    const d = c.getContext('2d').getImageData(Math.round((x - r.left) * dpr), Math.round((y - r.top) * dpr), 1, 1).data;
    return Array.from(d);
  }, [x, y]);
}
