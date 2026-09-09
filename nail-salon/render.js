// Canvas drawing helpers. Browser only.
import { fingerFrame, fingerEdges, axisPoint, widthAt } from './geometry.js';

// Ring styles. Parents can edit these: band is the metal, gem is optional.
export const RINGS = [
  { name: 'gold',    band: '#f2c14e', gem: null },
  { name: 'silver',  band: '#dfe3ea', gem: null },
  { name: 'rose',    band: '#eeb0a8', gem: null },
  { name: 'ruby',    band: '#f2c14e', gem: '#e63946', shape: 'round' },
  { name: 'diamond', band: '#dfe3ea', gem: '#bfefff', shape: 'diamond' },
  { name: 'heart',   band: '#f2c14e', gem: '#ff5d8f', shape: 'heart' },
  { name: 'emerald', band: '#dfe3ea', gem: '#2ec4b6', shape: 'diamond' },
  { name: 'pearl',   band: '#f2c14e', gem: '#fff1f5', shape: 'round' },
];

export function nailPath(nail) {
  if (!nail._path) {
    const p = new Path2D();
    nail.points.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    nail._path = p;
  }
  return nail._path;
}

// Lighten (pct > 0) or darken (pct < 0) a #rrggbb color.
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const ch = v => Math.max(0, Math.min(255, Math.round(v + (pct > 0 ? (255 - v) * pct : v * pct))));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function edgesOf(hand) {
  if (!hand._edges) hand._edges = hand.fingers.map((f, i) => fingerEdges(f, hand.anchors[i].L, hand.anchors[i].R));
  return hand._edges;
}

// The whole hand as ONE closed path: wrist, thumb, web, four fingers, wrist.
// Adjacent fingers share their notch exactly, so nothing can seam.
function handOutline(hand) {
  if (hand._outline) return hand._outline;
  const p = new Path2D();
  const W = hand.web, A = hand.anchors, F = hand.fingers, E = edgesOf(hand);
  const cap = i => {
    const { n } = fingerFrame(F[i]);
    p.arc(E[i].tip.x, E[i].tip.y, E[i].radius, Math.atan2(-n.y, -n.x), Math.atan2(n.y, n.x), false);
  };
  p.moveTo(W.wristL.x, W.wristL.y);
  p.quadraticCurveTo(W.ctrlPalmL.x, W.ctrlPalmL.y, A[0].L.x, A[0].L.y);
  for (let i = 0; i < 5; i++) {
    p.quadraticCurveTo(E[i].cL.x, E[i].cL.y, E[i].tipL.x, E[i].tipL.y);
    cap(i);
    p.quadraticCurveTo(E[i].cR.x, E[i].cR.y, A[i].R.x, A[i].R.y);
    if (i === 0) p.quadraticCurveTo(W.ctrlThumbWeb.x, W.ctrlThumbWeb.y, A[1].L.x, A[1].L.y);
  }
  p.quadraticCurveTo(W.ctrlPalmR.x, W.ctrlPalmR.y, W.wristR.x, W.wristR.y);
  p.closePath();
  hand._outline = p;
  return p;
}

export function drawHand(ctx, hand, skin) {
  const P = handOutline(hand);
  const E = edgesOf(hand);

  ctx.save();
  ctx.shadowColor = 'rgba(120,40,60,0.18)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = skin;
  ctx.fill(P);
  ctx.restore();

  ctx.save();
  ctx.clip(P);
  // one light source: soft highlight on the left, shadow on the right
  const g = ctx.createLinearGradient(40, 0, 560, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.17)');
  g.addColorStop(0.34, 'rgba(255,255,255,0)');
  g.addColorStop(0.64, 'rgba(120,50,60,0)');
  g.addColorStop(1, 'rgba(120,50,60,0.15)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 810);
  // warmth across the back of the hand
  const rg = ctx.createRadialGradient(320, 600, 20, 320, 600, 240);
  rg.addColorStop(0, 'rgba(255,255,255,0.13)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(90, 400, 480, 410);

  ctx.lineCap = 'round';
  hand.fingers.forEach((f, i) => {
    const a = hand.anchors[i], e = E[i];
    const left = new Path2D();
    left.moveTo(a.L.x, a.L.y);
    left.quadraticCurveTo(e.cL.x, e.cL.y, e.tipL.x, e.tipL.y);
    const right = new Path2D();
    right.moveTo(a.R.x, a.R.y);
    right.quadraticCurveTo(e.cR.x, e.cR.y, e.tipR.x, e.tipR.y);
    // these hug the silhouette's own edges, so they can never seam inside it
    ctx.strokeStyle = 'rgba(255,255,255,0.20)'; ctx.lineWidth = f.wt * 0.30; ctx.stroke(left);
    ctx.strokeStyle = 'rgba(120,50,60,0.09)';  ctx.lineWidth = f.wt * 0.46; ctx.stroke(right);
    ctx.strokeStyle = 'rgba(120,50,60,0.08)';  ctx.lineWidth = f.wt * 0.20; ctx.stroke(right);
    // knuckle creases
    const { u, n } = fingerFrame(f);
    ctx.strokeStyle = 'rgba(120,55,65,0.13)';
    ctx.lineWidth = 2.4;
    for (const t of [0.42, 0.72]) {
      const c = axisPoint(f, t), hw = widthAt(f, t) * 0.30;
      ctx.beginPath();
      ctx.moveTo(c.x - n.x * hw, c.y - n.y * hw);
      ctx.quadraticCurveTo(c.x + u.x * 3, c.y + u.y * 3, c.x + n.x * hw, c.y + n.y * hw);
      ctx.stroke();
    }
  });
  // a touch of depth in each notch so the fingers read as separate
  for (const k of ['n1', 'n2', 'n3']) {
    const q = hand.web[k];
    const ng = ctx.createRadialGradient(q.x, q.y, 1, q.x, q.y, 20);
    ng.addColorStop(0, 'rgba(120,50,60,0.14)');
    ng.addColorStop(1, 'rgba(120,50,60,0)');
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = shade(skin, -0.26);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke(P);
  ctx.restore();
}

// ---------------------------------------------------------------------- rings
function gemPath(ctx, shape, s) {
  ctx.beginPath();
  if (shape === 'heart') {
    ctx.moveTo(0, s * 0.45);
    ctx.bezierCurveTo(-s * 1.2, -s * 0.3, -s * 0.52, -s * 1.05, 0, -s * 0.34);
    ctx.bezierCurveTo(s * 0.52, -s * 1.05, s * 1.2, -s * 0.3, 0, s * 0.45);
  } else if (shape === 'diamond') {
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.85, -s * 0.14);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.85, -s * 0.14);
    ctx.closePath();
  } else {
    ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
  }
}

// A ring worn across a finger: (x, y) is on the finger's axis, angle its lean.
export function drawRingAt(ctx, x, y, angle, fw, style) {
  const bandW = fw * 1.08, bandH = fw * 0.30;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, -bandH / 2, 0, bandH / 2);
  g.addColorStop(0, shade(style.band, 0.45));
  g.addColorStop(0.42, style.band);
  g.addColorStop(1, shade(style.band, -0.32));
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(60,30,10,0.28)';
  ctx.lineWidth = Math.max(1, fw * 0.025);
  ctx.beginPath();
  ctx.roundRect(-bandW / 2, -bandH / 2, bandW, bandH, bandH / 2);
  ctx.fill();
  ctx.stroke();
  if (style.gem) {
    const s = fw * 0.23;
    ctx.translate(0, -bandH * 0.12);
    ctx.save();
    ctx.shadowColor = 'rgba(60,30,10,0.35)';
    ctx.shadowBlur = fw * 0.06;
    ctx.fillStyle = style.gem;
    gemPath(ctx, style.shape, s);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, fw * 0.02);
    gemPath(ctx, style.shape, s);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';   // sparkle
    ctx.beginPath();
    ctx.ellipse(-s * 0.28, -s * 0.3, s * 0.2, s * 0.13, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawRings(ctx, hand, rings) {
  if (!rings) return;
  hand.fingers.forEach((f, i) => {
    const style = RINGS[rings[i]];
    if (!style) return;
    const p = axisPoint(f, f.ringT);
    drawRingAt(ctx, p.x, p.y, f.angle, widthAt(f, f.ringT), style);
  });
}

// ---------------------------------------------------------------------- nails
export function drawNailBase(ctx, nail, color) {
  ctx.fillStyle = color;
  ctx.fill(nailPath(nail));
}

export function drawShine(ctx, nail) {
  const { x, y, w, h } = nail.rect;
  ctx.save();
  ctx.clip(nailPath(nail));
  ctx.translate(nail.pivot.x, nail.pivot.y);
  ctx.rotate(nail.angle);
  ctx.translate(-nail.pivot.x, -nail.pivot.y);
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

// Draws hand + rings + nails in logical coordinates. ctx must already be transformed.
export function drawScene(ctx, hand, skin, layers, rings) {
  drawHand(ctx, hand, skin);
  drawRings(ctx, hand, rings);
  hand.nails.forEach((nail, i) => {
    drawNailBase(ctx, nail, NAIL_BASE);
    const L = layers && layers[i];
    if (L) ctx.drawImage(L.canvas, L.ox, L.oy, L.w, L.h);
    drawShine(ctx, nail);
    drawOutline(ctx, nail);
  });
}

// Little polish brush with its bristle tip at (x, y), handle pointing up-right.
export const BRUSH_TILT = 0.7; // radians, clockwise from straight up
export const BRUSH_HANDLE = '#f6f6fa';
export function brushHandleCenter(x, y, w) {
  const d = w * (0.4 + 0.12 + 0.5);
  return { x: x + Math.sin(BRUSH_TILT) * d, y: y - Math.cos(BRUSH_TILT) * d };
}
export function drawBrush(ctx, x, y, w, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(BRUSH_TILT);
  const bw = w * 0.16, bl = w * 0.4, fl = w * 0.12, hw = w * 0.22, hl = w * 1.0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-bw * 0.9, -bl * 0.55, -bw / 2, -bl);
  ctx.lineTo(bw / 2, -bl);
  ctx.quadraticCurveTo(bw * 0.9, -bl * 0.55, 0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = w * 0.02;
  ctx.stroke();
  ctx.fillStyle = '#c9c9d4';
  ctx.fillRect(-bw / 2, -bl - fl, bw, fl);
  ctx.fillStyle = BRUSH_HANDLE;
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = w * 0.025;
  ctx.beginPath();
  ctx.roundRect(-hw / 2, -bl - fl - hl, hw, hl, hw / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = shade(color, -0.15);
  ctx.beginPath();
  ctx.roundRect(-hw / 2, -bl - fl - hl, hw, hl * 0.28, [hw / 2, hw / 2, 0, 0]);
  ctx.fill();
  ctx.restore();
}
