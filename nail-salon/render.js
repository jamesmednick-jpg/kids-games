// Canvas drawing helpers. Browser only.
import { fingerTip } from './geometry.js';

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
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}

// One tapered capsule in the finger's own frame, transformed into place.
// Drawn clockwise so all subpaths union under nonzero winding.
function fingerPath(f) {
  if (f._path) return f._path;
  const p = new Path2D();
  const r = f.wt / 2, top = -f.len + r;
  p.moveTo(-f.wb / 2, 0);
  p.lineTo(-r, top);
  p.arc(0, top, r, Math.PI, Math.PI * 2, false);
  p.lineTo(f.wb / 2, 0);
  p.quadraticCurveTo(0, 18, -f.wb / 2, 0);
  p.closePath();
  const out = new Path2D();
  out.addPath(p, new DOMMatrix().translate(f.bx, f.by).rotate((f.angle * 180) / Math.PI));
  f._path = out;
  return out;
}

function palmPath(palm) {
  const p = new Path2D();
  const [tl, tr] = palm.top;
  p.moveTo(tl[0], tl[1]);
  p.quadraticCurveTo((tl[0] + tr[0]) / 2, tl[1] - 30, tr[0], tr[1]);
  const [r1, r2, r3] = palm.right;
  p.bezierCurveTo(r1[0], r1[1], r2[0], r2[1], r3[0], r3[1]);
  p.lineTo(palm.bottom[0][0], palm.bottom[0][1]);
  const [l1, l2] = palm.left;
  p.bezierCurveTo(l1[0], l1[1], l2[0], l2[1], tl[0], tl[1]);
  p.closePath();
  const m = palm.mound;
  p.moveTo(m.x + m.r, m.y);
  p.arc(m.x, m.y, m.r, 0, Math.PI * 2, false);
  return p;
}

function handSilhouette(hand) {
  if (!hand._silhouette) {
    const P = new Path2D();
    P.addPath(palmPath(hand.palm));
    for (const f of hand.fingers) P.addPath(fingerPath(f));
    hand._silhouette = P;
  }
  return hand._silhouette;
}

export function drawHand(ctx, hand, skin) {
  const P = handSilhouette(hand);
  // one soft shadow around the whole silhouette
  ctx.save();
  ctx.shadowColor = 'rgba(120, 40, 60, 0.18)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = skin;
  ctx.fill(P, 'nonzero');
  ctx.restore();
  // outline of the union only: stroke every piece, then cover the inner half with the fill
  ctx.strokeStyle = shade(skin, -0.22);
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.4;
  ctx.stroke(P);
  ctx.globalAlpha = 1;
  ctx.fillStyle = skin;
  ctx.fill(P, 'nonzero');

  ctx.save();
  ctx.clip(P, 'nonzero');
  // gentle roundness: light on the left of each finger, shade on the right
  for (const f of hand.fingers) {
    ctx.save();
    ctx.clip(fingerPath(f));
    const tip = fingerTip(f);
    const nx = Math.cos(f.angle), ny = Math.sin(f.angle); // across the finger
    const g = ctx.createLinearGradient(f.bx - nx * f.wb / 2, f.by - ny * f.wb / 2, f.bx + nx * f.wb / 2, f.by + ny * f.wb / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(90,30,40,0.16)');
    ctx.fillStyle = g;
    ctx.fill(fingerPath(f));
    // two faint knuckle creases
    ctx.strokeStyle = 'rgba(110,50,60,0.13)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (const t of [0.36, 0.64]) {
      const cx = f.bx + (tip.x - f.bx) * t, cy = f.by + (tip.y - f.by) * t;
      const hw = (f.wb + (f.wt - f.wb) * t) * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx - nx * hw, cy - ny * hw);
      ctx.quadraticCurveTo(cx - ny * 4, cy + nx * 4, cx + nx * hw, cy + ny * hw);
      ctx.stroke();
    }
    ctx.restore();
  }
  // the palm sits over the finger bases so each finger rises out of the hand
  ctx.fillStyle = skin;
  ctx.fill(palmPath(hand.palm), 'nonzero');
  // soft shading where the fingers rise out of the palm
  const pg = ctx.createLinearGradient(0, 500, 0, 660);
  pg.addColorStop(0, 'rgba(90,30,40,0)');
  pg.addColorStop(0.4, 'rgba(90,30,40,0.09)');
  pg.addColorStop(1, 'rgba(90,30,40,0)');
  ctx.fillStyle = pg;
  ctx.fillRect(120, 500, 460, 160);
  ctx.restore();
}

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
  // bristles dipped in color
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
  // ferrule
  ctx.fillStyle = '#c9c9d4';
  ctx.fillRect(-bw / 2, -bl - fl, bw, fl);
  // handle
  ctx.fillStyle = BRUSH_HANDLE;
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = w * 0.025;
  ctx.beginPath();
  ctx.roundRect(-hw / 2, -bl - fl - hl, hw, hl, hw / 2);
  ctx.fill();
  ctx.stroke();
  // cap
  ctx.fillStyle = shade(color, -0.15);
  ctx.beginPath();
  ctx.roundRect(-hw / 2, -bl - fl - hl, hw, hl * 0.28, [hw / 2, hw / 2, 0, 0]);
  ctx.fill();
  ctx.restore();
}
