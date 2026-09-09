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
// Each finger is a tapered capsule: base point, length, base/tip widths,
// and a lean angle in radians (negative leans left on screen).
const deg = d => (d * Math.PI) / 180;
const FINGERS = [
  { name: 'thumb',  bx: 200, by: 660, len: 250, wb: 88, wt: 70, angle: deg(-38) },
  { name: 'index',  bx: 190, by: 545, len: 380, wb: 82, wt: 66, angle: deg(-6) },
  { name: 'middle', bx: 295, by: 540, len: 420, wb: 84, wt: 68, angle: 0 },
  { name: 'ring',   bx: 400, by: 545, len: 390, wb: 80, wt: 64, angle: deg(5) },
  { name: 'pinky',  bx: 495, by: 565, len: 300, wb: 70, wt: 56, angle: deg(12) },
];
// Palm outline (clockwise), wrist runs off the bottom of the logical space.
const PALM = {
  top: [[150, 560], [530, 578]],
  right: [[540, 700], [520, 820], [450, 840]],
  bottom: [[250, 840]],
  left: [[160, 800], [150, 700]],
  mound: { x: 212, y: 640, r: 76 }, // thumb web
};

export function rotatePoint(x, y, cx, cy, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

export function fingerTip(f) {
  return { x: f.bx + Math.sin(f.angle) * f.len, y: f.by - Math.cos(f.angle) * f.len };
}

export function buildHand(shape) {
  const nails = FINGERS.map((f, index) => {
    const w = Math.round(f.wt * 0.82);
    const baseH = Math.round(w * 1.15);
    const h = Math.round(baseH * TIP[shape].hScale);
    // cuticle center sits a little below the fingertip, along the finger axis
    const tip = fingerTip(f);
    const back = 14 + baseH;
    const pivot = { x: tip.x - Math.sin(f.angle) * back, y: tip.y + Math.cos(f.angle) * back };
    // local (unrotated) rect with its bottom center on the pivot; long nails grow upward
    const rect = { x: pivot.x - w / 2, y: pivot.y - h, w, h };
    const points = nailPolygon(shape, rect).map(([x, y]) => rotatePoint(x, y, pivot.x, pivot.y, f.angle));
    const [cx, cy] = rotatePoint(pivot.x, pivot.y - h / 2, pivot.x, pivot.y, f.angle);
    return { index, finger: f.name, rect, angle: f.angle, pivot, center: { x: cx, y: cy }, points, bounds: polygonBounds(points) };
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

// Forgiving hit test for small fingers: exact hit first, else the nearest
// nail whose bounds (grown by margin) contain the point.
export function hitNailLoose(hand, x, y, margin) {
  const exact = hitNail(hand, x, y);
  if (exact >= 0) return exact;
  let best = -1, bestD = Infinity;
  for (const n of hand.nails) {
    const b = n.bounds;
    if (x < b.minX - margin || x > b.maxX + margin || y < b.minY - margin || y > b.maxY + margin) continue;
    const d = Math.hypot(x - n.center.x, y - n.center.y);
    if (d < bestD) { bestD = d; best = n.index; }
  }
  return best;
}
