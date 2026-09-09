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
