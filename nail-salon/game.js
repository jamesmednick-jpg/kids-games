import { SHAPES, LOGICAL_W, LOGICAL_H, buildHand } from './geometry.js';
import { drawScene } from './render.js';

// ===== Parent config: edit these freely =====
export const CAPTION = 'Nail Salon';
export const PALETTE = [
  '#ff4d6d', '#ff85a1', '#ff9f1c', '#ffd60a', '#80ed99', '#38b000',
  '#48cae4', '#0077b6', '#9d4edd', '#ffafcc', '#ffffff', '#1d1d1d',
];
export const STICKERS = ['❤️', '⭐', '🌸', '💎', '🦋', '🌈', '☀️', '●'];
export const SKIN_TONES = ['#f8d9c4', '#e8b894', '#b87a4b', '#6b4226'];
// ============================================

const $ = id => document.getElementById(id);
const els = {
  shape: $('screen-shape'), salon: $('screen-salon'), skins: $('skins'), tiles: $('tiles'),
  stage: $('stage'), hand: $('hand'),
};

export const state = {
  screen: 'shape', shape: 'round', skin: 1, hand: null, layers: [],
  tool: 'brush', color: 0, sticker: 0, activeNail: -1, last: null, clearArmed: false,
  muted: false, dirty: true, frames: 0,
};
const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

// ---------- screens ----------
function showScreen(name) {
  state.screen = name;
  els.shape.hidden = name !== 'shape';
  els.salon.hidden = name !== 'salon';
}

function buildSkins() {
  els.skins.innerHTML = '';
  SKIN_TONES.forEach((color, i) => {
    const b = document.createElement('button');
    b.dataset.skin = i;
    b.style.background = color;
    b.setAttribute('aria-label', `Skin tone ${i + 1}`);
    b.classList.toggle('selected', i === state.skin);
    b.addEventListener('click', () => { state.skin = i; buildSkins(); buildTiles(); });
    els.skins.append(b);
  });
}

function buildTiles() {
  els.tiles.innerHTML = '';
  SHAPES.forEach(shape => {
    const b = document.createElement('button');
    b.dataset.shape = shape;
    b.setAttribute('aria-label', shape);
    const c = document.createElement('canvas');
    b.append(c);
    b.addEventListener('click', () => startSalon(shape));
    els.tiles.append(b);
    requestAnimationFrame(() => drawTile(c, shape));
  });
}

function drawTile(canvas, shape) {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, r.width * dpr); canvas.height = Math.max(1, r.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, r.height);
  // show the finger region, logical y 40..600
  const region = { x: 0, y: 40, w: LOGICAL_W, h: 560 };
  const s = Math.min(r.width / region.w, r.height / region.h);
  ctx.translate((r.width - region.w * s) / 2, (r.height - region.h * s) / 2);
  ctx.scale(s, s);
  ctx.translate(-region.x, -region.y);
  drawScene(ctx, buildHand(shape), SKIN_TONES[state.skin], null);
}

function startSalon(shape) {
  state.shape = shape;
  state.hand = buildHand(shape);
  state.layers = [];
  state.frames = 0;
  showScreen('salon');
  fitCanvas();
  state.dirty = true;
}

// ---------- main canvas ----------
function fitCanvas() {
  const r = els.stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  view.dpr = window.devicePixelRatio || 1;
  els.hand.width = Math.round(r.width * view.dpr);
  els.hand.height = Math.round(r.height * view.dpr);
  view.scale = Math.min(r.width / LOGICAL_W, r.height / LOGICAL_H);
  view.ox = (r.width - LOGICAL_W * view.scale) / 2;
  view.oy = r.height - LOGICAL_H * view.scale; // bottom-align the hand
  state.dirty = true;
}

function toLogical(e) {
  const r = els.hand.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.ox) / view.scale, y: (e.clientY - r.top - view.oy) / view.scale };
}

function toScreen(x, y) {
  const r = els.hand.getBoundingClientRect();
  return { x: r.left + view.ox + x * view.scale, y: r.top + view.oy + y * view.scale };
}

function render() {
  if (state.dirty && state.screen === 'salon' && state.hand) {
    state.dirty = false;
    const ctx = els.hand.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.hand.width, els.hand.height);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    drawScene(ctx, state.hand, SKIN_TONES[state.skin], state.layers);
    state.frames++;
  }
  requestAnimationFrame(render);
}

// ---------- wiring ----------
$('btn-home').addEventListener('click', () => showScreen('shape'));
new ResizeObserver(() => { if (state.screen === 'salon') fitCanvas(); }).observe(els.stage);

buildSkins();
buildTiles();
showScreen('shape');
requestAnimationFrame(render);

// ---------- test hooks ----------
window.__salon = {
  state, PALETTE, STICKERS, SKIN_TONES,
  hand: () => state.hand,
  toScreen,
  nailCenterScreen(i) {
    const { x, y, w, h } = state.hand.nails[i].rect;
    return toScreen(x + w / 2, y + h / 2);
  },
};
