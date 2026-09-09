// Pure geometry for the nail salon. No DOM, no canvas. Tested in Node.

export const SHAPES = ['round', 'square', 'oval', 'almond', 'pointed'];
export const LOGICAL_W = 600;
export const LOGICAL_H = 800;

// Tip profile per shape. f(t) maps t in [-1,1] (left edge to right edge)
// to [0,1] where 0 is the very tip and 1 is where the tip meets the side.
// tipH is how tall the tip region is. hScale lengthens the whole nail.
// hScale lengthens the nail; over is how much of it reaches past the
// fingertip, as a fraction of the nail's own height. Short shapes end at the
// tip, long ones extend beyond it the way real long nails do.
const TIP = {
  square:  { f: t => Math.abs(t) ** 12,            tipH: w => w * 0.08, hScale: 1.0,  over: 0.03 },
  round:   { f: t => 1 - Math.sqrt(1 - t * t),     tipH: w => w * 0.5,  hScale: 1.0,  over: 0.04 },
  oval:    { f: t => 1 - Math.sqrt(1 - t * t),     tipH: w => w * 0.7,  hScale: 1.24, over: 0.32 },
  almond:  { f: t => Math.abs(t) ** 1.4,           tipH: w => w * 0.9,  hScale: 1.38, over: 0.44 },
  pointed: { f: t => Math.abs(t),                  tipH: w => w * 1.0,  hScale: 1.52, over: 0.53 },
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

export function rotatePoint(x, y, cx, cy, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

// ---------------------------------------------------------------------------
// The hand. Back of a left hand, fingers up, thumb splayed to the left.
//
// Every finger is an axis (base point, lean angle, length) with a width that
// tapers from base to tip. The silhouette is ONE closed outline: adjacent
// fingers share their web notch exactly, so there are no seams where a finger
// meets the palm. Proportions follow a real hand — the visible part of the
// middle finger is about three quarters of the palm's length.
// ---------------------------------------------------------------------------

const deg = d => (d * Math.PI) / 180;

// Shared anchors on the silhouette. n1..n3 are the notches between fingers.
const WEB = {
  indexOuter: { x: 215, y: 450 },
  n1: { x: 285, y: 432 },
  n2: { x: 357, y: 430 },
  n3: { x: 423, y: 450 },
  pinkyOuter: { x: 479, y: 484 },
  wristL: { x: 272, y: 802 },
  wristR: { x: 438, y: 802 },
  ctrlPalmL: { x: 248, y: 752 },   // wrist up to the thumb's outer root
  ctrlThumbWeb: { x: 186, y: 505 },// the deep web between thumb and index
  ctrlPalmR: { x: 498, y: 625 },   // pinky root down to the wrist
};

const FINGERS = [
  { index: 0, name: 'thumb',  bx: 258, by: 660, len: 258, wb: 71, wt: 55, angle: deg(-42), ringT: 0.66, webT: 0.45 },
  { index: 1, name: 'index',  bx: 250, by: 448, len: 302, wb: 66, wt: 47, angle: deg(-8),   ringT: 0.25, anchorL: WEB.indexOuter, anchorR: WEB.n1 },
  { index: 2, name: 'middle', bx: 321, by: 442, len: 333, wb: 68, wt: 49, angle: deg(-1.5), ringT: 0.24, anchorL: WEB.n1, anchorR: WEB.n2 },
  { index: 3, name: 'ring',   bx: 390, by: 448, len: 310, wb: 62, wt: 45, angle: deg(6),    ringT: 0.25, anchorL: WEB.n2, anchorR: WEB.n3 },
  { index: 4, name: 'pinky',  bx: 451, by: 478, len: 246, wb: 54, wt: 39, angle: deg(14),   ringT: 0.27, anchorL: WEB.n3, anchorR: WEB.pinkyOuter },
];

// u runs from base to tip; n is across the finger, positive to its right.
export function fingerFrame(f) {
  return {
    u: { x: Math.sin(f.angle), y: -Math.cos(f.angle) },
    n: { x: Math.cos(f.angle), y: Math.sin(f.angle) },
  };
}

export function widthAt(f, t) {
  const k = Math.max(0, Math.min(1, t));
  return f.wb + (f.wt - f.wb) * k;
}

export function axisPoint(f, t) {
  const { u } = fingerFrame(f);
  return { x: f.bx + u.x * f.len * t, y: f.by + u.y * f.len * t };
}

export function edgePoint(f, t, side) {
  const { n } = fingerFrame(f);
  const p = axisPoint(f, t), h = (widthAt(f, t) / 2) * side;
  return { x: p.x + n.x * h, y: p.y + n.y * h };
}

export function fingerTip(f) { return axisPoint(f, 1); }

// The two side edges of a finger, from its web anchors up to the tip.
export function fingerEdges(f, anchorL, anchorR) {
  const { n } = fingerFrame(f);
  const tip = fingerTip(f);
  const h = f.wt / 2, bulge = 3;
  const tipL = { x: tip.x - n.x * h, y: tip.y - n.y * h };
  const tipR = { x: tip.x + n.x * h, y: tip.y + n.y * h };
  return {
    tip, tipL, tipR, radius: h,
    cL: { x: (anchorL.x + tipL.x) / 2 - n.x * bulge, y: (anchorL.y + tipL.y) / 2 - n.y * bulge },
    cR: { x: (anchorR.x + tipR.x) / 2 + n.x * bulge, y: (anchorR.y + tipR.y) / 2 + n.y * bulge },
  };
}

export function buildHand(shape) {
  const anchors = FINGERS.map(f => (f.name === 'thumb'
    ? { L: edgePoint(f, 0, -1), R: edgePoint(f, f.webT, 1) }
    : { L: f.anchorL, R: f.anchorR }));

  const nails = FINGERS.map((f, index) => {
    const { u } = fingerFrame(f);
    const w = Math.round(f.wt * 0.92);          // nearly as wide as the fingertip
    const baseH = Math.round(w * 1.2);
    const h = Math.round(baseH * TIP[shape].hScale);
    const tip = fingerTip(f);
    const back = h * (1 - TIP[shape].over);     // the nail ends at the fingertip, or past it
    const pivot = { x: tip.x - u.x * back, y: tip.y - u.y * back };
    const rect = { x: pivot.x - w / 2, y: pivot.y - h, w, h };
    const points = nailPolygon(shape, rect).map(([x, y]) => rotatePoint(x, y, pivot.x, pivot.y, f.angle));
    const [cx, cy] = rotatePoint(pivot.x, pivot.y - h / 2, pivot.x, pivot.y, f.angle);
    return { index, finger: f.name, rect, angle: f.angle, pivot, center: { x: cx, y: cy }, points, bounds: polygonBounds(points) };
  });

  const pts = [];
  for (const f of FINGERS) {
    for (let t = 0; t <= 1.0001; t += 0.1) for (const side of [-1, 1]) {
      const p = edgePoint(f, t, side);
      pts.push([p.x, p.y]);
    }
    const tip = fingerTip(f), r = f.wt / 2;
    pts.push([tip.x - r, tip.y - r], [tip.x + r, tip.y + r]);
  }
  for (const n of nails) pts.push([n.bounds.minX, n.bounds.minY], [n.bounds.maxX, n.bounds.maxY]);
  const qmid = (a, c, b) => [0.25 * a.x + 0.5 * c.x + 0.25 * b.x, 0.25 * a.y + 0.5 * c.y + 0.25 * b.y];
  pts.push([WEB.wristL.x, WEB.wristL.y], [WEB.wristR.x, WEB.wristR.y]);
  pts.push(qmid(WEB.wristL, WEB.ctrlPalmL, anchors[0].L));
  pts.push(qmid(WEB.pinkyOuter, WEB.ctrlPalmR, WEB.wristR));
  const bounds = polygonBounds(pts);

  return { shape, fingers: FINGERS, web: WEB, anchors, nails, bounds };
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

// Which finger is under this point, anywhere along its length. -1 for the palm.
export function hitFinger(hand, x, y, margin = 14) {
  let best = -1, bestD = Infinity;
  for (const f of hand.fingers) {
    const { u, n } = fingerFrame(f);
    const dx = x - f.bx, dy = y - f.by;
    // a little slack past each end, but not so much that the thumb's root
    // swallows the middle of the palm
    const t = (dx * u.x + dy * u.y) / f.len;
    if (t < -0.06 || t > 1.12) continue;
    const d = Math.abs(dx * n.x + dy * n.y) - widthAt(f, t) / 2;
    if (d <= margin && d < bestD) { bestD = d; best = f.index; }
  }
  return best;
}
