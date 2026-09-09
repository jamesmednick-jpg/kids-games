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

  sticker(x, y, emoji, size, angle = 0) {
    this._clipped(c => {
      c.translate(x, y);
      c.rotate(angle);
      c.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#000';
      c.fillText(emoji, 0, 0);
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
