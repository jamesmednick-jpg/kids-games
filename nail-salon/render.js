// Canvas drawing helpers. Browser only.
//
// Everything is vector: soft, airbrushed-looking shading is built from layered
// gradients and edge-hugging strokes rather than blur filters, so it renders
// the same on every phone and stays cheap enough to redraw each frame.
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

export const NAIL_BASE = '#f7dede';

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

// A soft edge: the same path stroked from wide and faint to narrow and firm.
function softStroke(ctx, path, color, passes) {
  for (const [width, alpha] of passes) {
    ctx.strokeStyle = `rgba(${color},${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }
}

const SKIN_SHADOW = '120,50,60';
const LIGHT = '255,255,255';

// ------------------------------------------------------------------ the hand
function edgesOf(hand) {
  if (!hand._edges) hand._edges = hand.fingers.map((f, i) => fingerEdges(f, hand.anchors[i].L, hand.anchors[i].R));
  return hand._edges;
}

function unit(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

// The whole hand as ONE closed path: wrist, thumb, web, four fingers, wrist.
// Adjacent fingers share their notch exactly, so nothing can seam. Where the
// palm meets a finger the control points are derived from that finger's own
// edge direction, so the outline carries straight through instead of kinking.
export function handOutline(hand) {
  if (hand._outline) return hand._outline;
  const p = new Path2D();
  const W = hand.web, A = hand.anchors, F = hand.fingers, E = edgesOf(hand);
  const cap = i => {
    const { n } = fingerFrame(F[i]);
    p.arc(E[i].tip.x, E[i].tip.y, E[i].radius, Math.atan2(-n.y, -n.x), Math.atan2(n.y, n.x), false);
  };

  // up the left of the palm, arriving along the thumb's own outer edge
  const thumbUp = unit(A[0].L.x, A[0].L.y, E[0].cL.x, E[0].cL.y);
  p.moveTo(W.wristL.x, W.wristL.y);
  p.bezierCurveTo(
    W.wristL.x - 6, W.wristL.y - 58,
    A[0].L.x - thumbUp.x * W.palmLTangent, A[0].L.y - thumbUp.y * W.palmLTangent,
    A[0].L.x, A[0].L.y,
  );

  for (let i = 0; i < 5; i++) {
    p.quadraticCurveTo(E[i].cL.x, E[i].cL.y, E[i].tipL.x, E[i].tipL.y);
    cap(i);
    p.quadraticCurveTo(E[i].cR.x, E[i].cR.y, A[i].R.x, A[i].R.y);
    if (i === 0) {
      // the thumb web: leave along the thumb's inner edge, arrive along the
      // index finger's outer edge, so neither junction shows a corner
      const downThumb = unit(E[0].tipR.x, E[0].tipR.y, A[0].R.x, A[0].R.y);
      const upIndex = unit(A[1].L.x, A[1].L.y, E[1].cL.x, E[1].cL.y);
      p.bezierCurveTo(
        A[0].R.x + downThumb.x * W.webTangentThumb, A[0].R.y + downThumb.y * W.webTangentThumb,
        A[1].L.x - upIndex.x * W.webTangentIndex, A[1].L.y - upIndex.y * W.webTangentIndex,
        A[1].L.x, A[1].L.y,
      );
    }
  }

  // down the right of the palm, leaving along the pinky's own outer edge
  const pinkyDown = unit(E[4].cR.x, E[4].cR.y, A[4].R.x, A[4].R.y);
  p.bezierCurveTo(
    A[4].R.x + pinkyDown.x * W.palmRTangent, A[4].R.y + pinkyDown.y * W.palmRTangent,
    W.ctrlPalmR.x, W.ctrlPalmR.y,
    W.wristR.x, W.wristR.y,
  );
  p.closePath();
  hand._outline = p;
  return p;
}

function fingerSides(hand, i) {
  const a = hand.anchors[i], e = edgesOf(hand)[i];
  const left = new Path2D();
  left.moveTo(a.L.x, a.L.y);
  left.quadraticCurveTo(e.cL.x, e.cL.y, e.tipL.x, e.tipL.y);
  const right = new Path2D();
  right.moveTo(a.R.x, a.R.y);
  right.quadraticCurveTo(e.cR.x, e.cR.y, e.tipR.x, e.tipR.y);
  return { left, right };
}

export function drawHand(ctx, hand, skin) {
  const P = handOutline(hand);

  // the hand itself, with one soft shadow beneath it
  ctx.save();
  ctx.shadowColor = 'rgba(120,40,60,0.20)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = skin;
  ctx.fill(P);
  ctx.restore();

  ctx.save();
  ctx.clip(P);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. form light: the back of the hand turns toward the light
  const form = ctx.createRadialGradient(290, 500, 20, 310, 570, 430);
  form.addColorStop(0, `rgba(${LIGHT},0.22)`);
  form.addColorStop(0.45, `rgba(${LIGHT},0.07)`);
  form.addColorStop(1, `rgba(${LIGHT},0)`);
  ctx.fillStyle = form;
  ctx.fillRect(0, 0, 600, 812);

  // 2. key light from the upper left, shadow falling to the lower right
  const key = ctx.createLinearGradient(50, 140, 550, 720);
  key.addColorStop(0, `rgba(${LIGHT},0.11)`);
  key.addColorStop(0.4, `rgba(${LIGHT},0)`);
  key.addColorStop(0.7, `rgba(${SKIN_SHADOW},0)`);
  key.addColorStop(1, `rgba(${SKIN_SHADOW},0.17)`);
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, 600, 812);

  // 3. tendons running down the back of the hand: each fades in and out and
  //    ends somewhere of its own, so they never pool into a smudge
  ctx.lineWidth = 7;
  hand.fingers.slice(1).forEach((f, k) => {
    const top = axisPoint(f, 0.02);
    const x0 = top.x, y0 = top.y + 34, x1 = 306 + (k - 1.5) * 30, y1 = 690;
    const tg = ctx.createLinearGradient(x0, y0, x1, y1);
    tg.addColorStop(0, `rgba(${SKIN_SHADOW},0)`);
    tg.addColorStop(0.4, `rgba(${SKIN_SHADOW},0.05)`);
    tg.addColorStop(1, `rgba(${SKIN_SHADOW},0)`);
    ctx.strokeStyle = tg;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.45, y0 + 160, x1, y1);
    ctx.stroke();
  });

  // 4. each finger: rim light down one side, core shadow down the other
  hand.fingers.forEach((f, i) => {
    const { left, right } = fingerSides(hand, i);
    softStroke(ctx, right, SKIN_SHADOW, [[f.wt * 0.66, 0.045], [f.wt * 0.36, 0.055], [f.wt * 0.17, 0.065]]);
    softStroke(ctx, left, LIGHT, [[f.wt * 0.42, 0.07], [f.wt * 0.21, 0.09], [f.wt * 0.09, 0.12]]);

    // sheen down the middle, fading out before the knuckles
    const { u, n } = fingerFrame(f);
    const a0 = axisPoint(f, 0.12), a1 = axisPoint(f, 0.95);
    const sheen = new Path2D();
    sheen.moveTo(a0.x - n.x * 2, a0.y - n.y * 2);
    sheen.lineTo(a1.x - n.x * 2, a1.y - n.y * 2);
    const sg = ctx.createLinearGradient(a0.x, a0.y, a1.x, a1.y);
    sg.addColorStop(0, `rgba(${LIGHT},0)`);
    sg.addColorStop(0.4, `rgba(${LIGHT},0.10)`);
    sg.addColorStop(1, `rgba(${LIGHT},0.02)`);
    ctx.strokeStyle = sg;
    ctx.lineWidth = f.wt * 0.44;
    ctx.stroke(sheen);

    // knuckles: barely there, just enough to read as a hand
    ctx.strokeStyle = `rgba(${SKIN_SHADOW},0.07)`;
    ctx.lineWidth = 2.2;
    for (const t of [0.44, 0.73]) {
      const c = axisPoint(f, t), hw = widthAt(f, t) * 0.26;
      ctx.beginPath();
      ctx.moveTo(c.x - n.x * hw, c.y - n.y * hw);
      ctx.quadraticCurveTo(c.x + u.x * 3, c.y + u.y * 3, c.x + n.x * hw, c.y + n.y * hw);
      ctx.stroke();
    }
  });

  // 5. the crevices between fingers hold the deepest shadow
  hand.fingers.slice(1).forEach((f, k) => {
    const q = hand.anchors[k + 1].L;
    const { u } = fingerFrame(f);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(Math.atan2(u.y, u.x) + Math.PI / 2);
    const ng = ctx.createRadialGradient(0, 0, 1, 0, 0, 26);
    ng.addColorStop(0, `rgba(${SKIN_SHADOW},0.16)`);
    ng.addColorStop(1, `rgba(${SKIN_SHADOW},0)`);
    ctx.fillStyle = ng;
    ctx.scale(0.62, 1.5);
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 6. a soft inner rim instead of a drawn outline: only the inside half of
  //    these strokes survives the clip, so the edge darkens without a line
  softStroke(ctx, P, SKIN_SHADOW, [[9, 0.05], [4.5, 0.055], [2, 0.07]]);
  ctx.restore();
}

// ----------------------------------------------------------------- the rings
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

function drawGem(ctx, style, s) {
  const color = style.gem, shape = style.shape;
  // the gem sits in a seat that shadows the metal below it
  ctx.fillStyle = 'rgba(60,30,10,0.38)';
  ctx.save();
  ctx.translate(0, s * 0.14);
  gemPath(ctx, shape, s * 1.04);
  ctx.fill();
  ctx.restore();

  const g = ctx.createRadialGradient(-s * 0.32, -s * 0.36, s * 0.04, 0, 0, s * 1.3);
  g.addColorStop(0, shade(color, 0.6));
  g.addColorStop(0.42, color);
  g.addColorStop(1, shade(color, -0.38));
  ctx.fillStyle = g;
  gemPath(ctx, shape, s);
  ctx.fill();

  // facets catch and lose the light across the stone
  ctx.save();
  gemPath(ctx, shape, s);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.15); ctx.lineTo(s * 0.55, -s * 0.05); ctx.lineTo(0, s * 0.22); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.moveTo(0, s * 1.15); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s * 0.12); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(-s * 1.1, 0); ctx.lineTo(0, -s * 0.3); ctx.lineTo(0, s * 0.3); ctx.closePath();
  ctx.fill();
  ctx.restore();

  // prongs clasping the stone
  ctx.fillStyle = shade(style.band, 0.28);
  ctx.strokeStyle = 'rgba(60,30,10,0.3)';
  ctx.lineWidth = s * 0.06;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * s * 0.62, s * 0.2, s * 0.15, s * 0.22, sx * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = s * 0.08;
  gemPath(ctx, shape, s);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, -s * 0.36, s * 0.21, s * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

// A ring worn ROUND a finger: (x, y) is on the finger's axis, angle its lean,
// fw the finger's width there. The band's edges bow toward the viewer, its
// ends darken as the metal turns away, and it casts a shadow on the finger.
export function drawRingAt(ctx, x, y, angle, fw, style) {
  const bandH = fw * 0.30;
  const halfW = fw / 2 + fw * 0.055;    // a little wider than the finger
  const sag = bandH * 0.46;             // how far the edges bow toward us
  const top = -bandH / 2, bot = bandH / 2;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineJoin = 'round';

  // shadow the ring throws down the finger
  const sh = new Path2D();
  const shW = halfW * 0.94, shH = bandH * 0.85;
  sh.moveTo(-shW, bot);
  sh.quadraticCurveTo(0, bot + sag * 2, shW, bot);
  sh.lineTo(shW, bot + shH);
  sh.quadraticCurveTo(0, bot + shH + sag * 2, -shW, bot + shH);
  sh.closePath();
  const shg = ctx.createLinearGradient(0, bot, 0, bot + shH + sag);
  shg.addColorStop(0, 'rgba(95,45,50,0.34)');
  shg.addColorStop(1, 'rgba(95,45,50,0)');
  ctx.fillStyle = shg;
  ctx.fill(sh);

  // the band: both edges curve the same way, which is what reads as "round it"
  const band = new Path2D();
  band.moveTo(-halfW, top);
  band.quadraticCurveTo(0, top + sag * 2, halfW, top);
  band.lineTo(halfW, bot);
  band.quadraticCurveTo(0, bot + sag * 2, -halfW, bot);
  band.closePath();

  const g = ctx.createLinearGradient(0, top, 0, bot + sag * 1.4);
  g.addColorStop(0, shade(style.band, -0.22));   // the far edge rolls away
  g.addColorStop(0.16, shade(style.band, 0.62));
  g.addColorStop(0.4, style.band);
  g.addColorStop(0.72, shade(style.band, -0.34));
  g.addColorStop(1, shade(style.band, 0.04));    // light bouncing off the finger
  ctx.fillStyle = g;
  ctx.fill(band);

  ctx.save();
  ctx.clip(band);
  // the ends curve away from the light
  const hg = ctx.createLinearGradient(-halfW, 0, halfW, 0);
  hg.addColorStop(0, 'rgba(45,22,10,0.45)');
  hg.addColorStop(0.16, 'rgba(45,22,10,0)');
  hg.addColorStop(0.82, 'rgba(45,22,10,0)');
  hg.addColorStop(1, 'rgba(45,22,10,0.38)');
  ctx.fillStyle = hg;
  ctx.fillRect(-halfW, top - bandH, halfW * 2, bandH * 4);
  // a hot specular running along the metal
  const spec = new Path2D();
  spec.moveTo(-halfW * 0.8, top + bandH * 0.3);
  spec.quadraticCurveTo(0, top + bandH * 0.3 + sag * 2, halfW * 0.8, top + bandH * 0.3);
  const sg = ctx.createLinearGradient(-halfW, 0, halfW, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)');
  sg.addColorStop(0.26, 'rgba(255,255,255,0.9)');
  sg.addColorStop(0.44, 'rgba(255,255,255,0.35)');
  sg.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = sg;
  ctx.lineWidth = bandH * 0.17;
  ctx.lineCap = 'round';
  ctx.stroke(spec);
  ctx.restore();

  ctx.strokeStyle = 'rgba(70,35,10,0.34)';
  ctx.lineWidth = Math.max(1, fw * 0.022);
  ctx.stroke(band);

  if (style.gem) {
    ctx.translate(0, top + bandH * 0.28);
    drawGem(ctx, style, fw * 0.23);
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

// ----------------------------------------------------------------- the nails
export function drawNailBase(ctx, nail, color) {
  ctx.fillStyle = color;
  ctx.fill(nailPath(nail));
}

// Where the nail meets skin it should sit in the finger, not on it.
function nailContactShadow(ctx, nail) {
  softStroke(ctx, nailPath(nail), '110,55,60', [[8, 0.05], [4.5, 0.06], [2, 0.07]]);
}

// Polish is wet: a broad top light, a hot specular streak, a smaller sparkle
// and a bright rim all the way round.
export function drawGloss(ctx, nail) {
  const { x, y, w, h } = nail.rect;
  ctx.save();
  ctx.clip(nailPath(nail));
  ctx.translate(nail.pivot.x, nail.pivot.y);
  ctx.rotate(nail.angle);
  ctx.translate(-nail.pivot.x, -nail.pivot.y);

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.18)');
  g.addColorStop(0.32, 'rgba(255,255,255,0.03)');
  g.addColorStop(0.8, 'rgba(90,40,55,0.05)');
  g.addColorStop(1, 'rgba(90,40,55,0.15)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

  ctx.save();
  ctx.translate(x + w * 0.32, y + h * 0.36);
  ctx.rotate(-0.12);
  const s = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w * 0.15, h * 0.29));
  s.addColorStop(0, 'rgba(255,255,255,0.92)');
  s.addColorStop(0.42, 'rgba(255,255,255,0.7)');
  s.addColorStop(0.72, 'rgba(255,255,255,0.28)');
  s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.15, h * 0.29, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.68, y + h * 0.58, w * 0.055, h * 0.1, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // wet rim, brightest along the free edge
  ctx.save();
  ctx.clip(nailPath(nail));
  softStroke(ctx, nailPath(nail), '255,255,255', [[5, 0.10], [2.4, 0.18]]);
  ctx.restore();
}

// Draws hand + rings + nails in logical coordinates. ctx must already be transformed.
export function drawScene(ctx, hand, skin, layers, rings) {
  drawHand(ctx, hand, skin);
  drawRings(ctx, hand, rings);

  // contact shadows live on the skin, so they are clipped to the hand
  ctx.save();
  ctx.clip(handOutline(hand));
  hand.nails.forEach(nail => nailContactShadow(ctx, nail));
  ctx.restore();

  hand.nails.forEach((nail, i) => {
    drawNailBase(ctx, nail, NAIL_BASE);
    const L = layers && layers[i];
    if (L) ctx.drawImage(L.canvas, L.ox, L.oy, L.w, L.h);
    drawGloss(ctx, nail);
  });
}

// ---------------------------------------------------------- the polish brush
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
