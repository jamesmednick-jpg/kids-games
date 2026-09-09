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
