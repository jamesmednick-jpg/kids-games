import { SHAPES, LOGICAL_W, LOGICAL_H, buildHand, hitNail, hitNailLoose, interpolate, pointInPolygon } from './geometry.js';
import { drawScene, drawBrush, brushHandleCenter } from './render.js';
import { NailLayer } from './paint.js';
import { initAudio, setMuted, pop, tinkle, chime } from './audio.js';

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
  stage: $('stage'), hand: $('hand'), palette: $('palette'), tray: $('tray'),
  toolButtons: [...document.querySelectorAll('#tools .tool[data-tool]')],
  stickerBtn: $('tool-sticker'), clearBtn: $('tool-clear'),
  muteBtn: $('btn-mute'), backBtn: $('btn-back'), party: $('party'), confetti: $('confetti'), fallback: $('fallback'), fallbackImg: $('fallback-img'),
};

export const state = {
  screen: 'shape', shape: 'round', skin: 1, hand: null, layers: [],
  tool: 'brush', color: 0, sticker: 0, activeNail: -1, last: null, clearArmed: false,
  muted: false, dirty: true, frames: 0,
  zoomNail: -1, animating: false,
  cursor: null, // { x, y, mouse } in logical coords while a pointer is over the hand
};
const TAP_MARGIN = 28; // logical px of forgiveness when picking a finger
const view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 };
let animToken = 0;

// ---------- screens ----------
function showScreen(name) {
  state.screen = name;
  armClear(false);
  hideParty();
  els.fallback.hidden = true;
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
  // show the finger region
  const region = { x: 0, y: 90, w: LOGICAL_W, h: 580 };
  const s = Math.min(r.width / region.w, r.height / region.h);
  ctx.translate((r.width - region.w * s) / 2, (r.height - region.h * s) / 2);
  ctx.scale(s, s);
  ctx.translate(-region.x, -region.y);
  drawScene(ctx, buildHand(shape), SKIN_TONES[state.skin], null);
}

function startSalon(shape) {
  state.shape = shape;
  state.hand = buildHand(shape);
  state.frames = 0;
  state.zoomNail = -1;
  state.animating = false;
  animToken++;
  els.backBtn.hidden = true;
  showScreen('salon');
  fitCanvas();
  // layers must stay crisp at the zoomed-in scale
  const zoomScale = Math.max(...state.hand.nails.map((_, i) => nailView(i).scale));
  const layerDpr = Math.min(6, Math.max(1, Math.ceil(zoomScale * view.dpr)));
  state.layers = state.hand.nails.map(n => new NailLayer(n, layerDpr));
  state.activeNail = -1;
  state.dirty = true;
}

function buildPalette() {
  els.palette.innerHTML = '';
  PALETTE.forEach((color, i) => {
    const b = document.createElement('button');
    b.dataset.color = i;
    b.style.background = color;
    b.setAttribute('aria-label', `Color ${i + 1}`);
    b.classList.toggle('selected', i === state.color);
    b.addEventListener('click', () => { state.color = i; buildPalette(); });
    els.palette.append(b);
  });
}

// ---------- main canvas ----------
function fitCanvas() {
  const r = els.stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  view.dpr = window.devicePixelRatio || 1;
  const w = Math.round(r.width * view.dpr), h = Math.round(r.height * view.dpr);
  if (w === els.hand.width && h === els.hand.height) return;
  els.hand.width = w;
  els.hand.height = h;
  view.w = r.width; view.h = r.height;
  Object.assign(view, state.zoomNail >= 0 ? nailView(state.zoomNail) : homeView());
  state.dirty = true;
}

// Whole hand, bottom-aligned, as large as the stage allows.
function homeView() {
  const TOP = 100; // nothing is drawn above this line, so let the hand use that room
  const scale = Math.min(view.w / LOGICAL_W, view.h / (LOGICAL_H - TOP));
  return { scale, ox: (view.w - LOGICAL_W * scale) / 2, oy: view.h - LOGICAL_H * scale };
}

// One nail filling most of the stage, with a little finger around it.
function nailView(i) {
  const n = state.hand.nails[i];
  const b = n.bounds;
  const w = b.maxX - b.minX, h = b.maxY - b.minY;
  const padX = n.rect.w * 0.45, padY = n.rect.h * 0.3;
  const rw = w + padX * 2, rh = h + padY * 2;
  const scale = Math.min(view.w / rw, view.h / rh);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  return { scale, ox: view.w / 2 - cx * scale, oy: view.h / 2 - cy * scale };
}

function zoomTo(i, ms = 320) {
  state.zoomNail = i;
  els.backBtn.hidden = i < 0;
  state.activeNail = -1;
  const from = { scale: view.scale, ox: view.ox, oy: view.oy };
  const to = i >= 0 ? nailView(i) : homeView();
  const token = ++animToken;
  const t0 = performance.now();
  state.animating = true;
  function step(now) {
    if (token !== animToken) return;
    const t = Math.min(1, (now - t0) / ms);
    const k = 1 - Math.pow(1 - t, 3); // ease out
    view.scale = from.scale + (to.scale - from.scale) * k;
    view.ox = from.ox + (to.ox - from.ox) * k;
    view.oy = from.oy + (to.oy - from.oy) * k;
    state.dirty = true;
    if (t < 1) requestAnimationFrame(step);
    else state.animating = false;
  }
  requestAnimationFrame(step);
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
    if (brushShown()) {
      const n = state.hand.nails[state.zoomNail >= 0 ? state.zoomNail : 2];
      drawBrush(ctx, state.cursor.x, state.cursor.y, n.rect.w, PALETTE[state.color]);
    }
    state.frames++;
  }
  requestAnimationFrame(render);
}

// ---------- painting ----------
function brushRadius(nail) { return nail.rect.w / 6; }

function applyTool(i, p, isStart) {
  const L = state.layers[i];
  const nail = state.hand.nails[i];
  const color = PALETTE[state.color];
  const r = brushRadius(nail);
  if (state.tool === 'brush') {
    L.paint(p.x, p.y, color, r);
  } else if (state.tool === 'glitter') {
    L.glitter(p.x, p.y, color, r);
    if (Math.random() < 0.15) tinkle();
  } else if (state.tool === 'sticker' && isStart) {
    const s = STICKERS[state.sticker];
    if (s === '●') L.dot(p.x, p.y, color, nail.rect.w * 0.22);
    else L.sticker(p.x, p.y, s, nail.rect.w * 0.45, nail.angle);
  }
  state.dirty = true;
}

function selectTool(tool) {
  state.tool = tool;
  els.toolButtons.forEach(b => b.classList.toggle('selected', b.dataset.tool === tool));
  // the top strip: stickers while placing stickers, colors otherwise
  els.tray.hidden = tool !== 'sticker';
  els.palette.hidden = tool === 'sticker';
  state.dirty = true;
}

function buildTray() {
  els.tray.innerHTML = '';
  STICKERS.forEach((s, i) => {
    const b = document.createElement('button');
    b.dataset.sticker = i;
    b.textContent = s;
    b.setAttribute('aria-label', `Sticker ${i + 1}`);
    b.classList.toggle('selected', i === state.sticker);
    b.addEventListener('click', () => {
      state.sticker = i;
      els.stickerBtn.textContent = s;
      buildTray();
      selectTool('sticker');
    });
    els.tray.append(b);
  });
}

function armClear(on) {
  state.clearArmed = on;
  els.clearBtn.classList.toggle('armed', on);
}

// The polish brush shows while painting, or while a mouse hovers a zoomed nail.
function brushShown() {
  if (state.tool !== 'brush' || !state.cursor || state.screen !== 'salon') return false;
  if (state.activeNail >= 0) return true;
  return state.cursor.mouse && state.zoomNail >= 0 && hitNail(state.hand, state.cursor.x, state.cursor.y) === state.zoomNail;
}

function setCursor(e) {
  const p = toLogical(e);
  const was = brushShown();
  state.cursor = { x: p.x, y: p.y, mouse: e.pointerType === 'mouse' };
  if (was || brushShown()) state.dirty = true;
}

els.hand.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (state.animating) return;
  setCursor(e);
  const p = toLogical(e);
  const i = state.zoomNail < 0 ? hitNailLoose(state.hand, p.x, p.y, TAP_MARGIN) : hitNail(state.hand, p.x, p.y);
  if (state.clearArmed) {
    if (i >= 0) { state.layers[i].clear(); state.dirty = true; }
    armClear(false);
    return;
  }
  if (i < 0) return;
  if (i !== state.zoomNail) { pop(); zoomTo(i); return; } // whole hand or a neighbour: zoom to it
  els.hand.setPointerCapture(e.pointerId);
  state.activeNail = i;
  state.last = p;
  applyTool(i, p, true);
});

els.hand.addEventListener('pointermove', e => {
  setCursor(e);
  if (state.activeNail < 0) return;
  const p = toLogical(e);
  const nail = state.hand.nails[state.activeNail];
  for (const q of interpolate(state.last, p, brushRadius(nail) / 3)) applyTool(state.activeNail, q, false);
  state.last = p;
});

const endStroke = e => {
  state.activeNail = -1; state.last = null;
  if (e && e.pointerType !== 'mouse') state.cursor = null;
  state.dirty = true;
};
els.hand.addEventListener('pointerup', endStroke);
els.hand.addEventListener('pointercancel', endStroke);
els.hand.addEventListener('pointerleave', () => { state.cursor = null; state.dirty = true; });

// ---------- celebration ----------
function startConfetti(seconds = 3) {
  const c = els.confetti;
  const r = els.stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  c.hidden = false;
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 140 }, () => ({
    x: Math.random() * r.width, y: -20 - Math.random() * r.height * 0.8,
    vx: (Math.random() - 0.5) * 80, vy: 140 + Math.random() * 200,
    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
    size: 7 + Math.random() * 9, color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    star: Math.random() < 0.2,
  }));
  const t0 = performance.now();
  let last = t0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, r.width, r.height);
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.star) { ctx.font = `${p.size * 2}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✨', 0, 0); }
      else { ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
      ctx.restore();
    }
    if (now - t0 < seconds * 1000 && !c.hidden) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, r.width, r.height); c.hidden = true; }
  }
  requestAnimationFrame(frame);
}

function showParty() {
  chime();
  armClear(false);
  state.activeNail = -1;
  if (state.zoomNail >= 0) zoomTo(-1);
  els.party.hidden = false;
  els.salon.classList.add('partying');
  startConfetti(3);
}

function hideParty() {
  els.party.hidden = true;
  els.salon.classList.remove('partying');
  els.confetti.hidden = true;
}

// ---------- photo ----------
async function exportPhoto() {
  const S = 2;
  const out = document.createElement('canvas');
  out.width = LOGICAL_W * S; out.height = LOGICAL_H * S;
  const ctx = out.getContext('2d');
  ctx.scale(S, S);
  ctx.fillStyle = '#fff0f5';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  drawScene(ctx, state.hand, SKIN_TONES[state.skin], state.layers);
  ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#b5179e';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`✨ ${CAPTION} ✨`, LOGICAL_W - 20, LOGICAL_H - 20);
  return new Promise(res => out.toBlob(res, 'image/png'));
}

async function sharePhoto() {
  let blob;
  try {
    blob = await exportPhoto();
    const file = new File([blob], 'nails.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: CAPTION });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // she closed the sheet
        console.warn('share failed, showing fallback', err);
      }
    }
  } catch (err) {
    console.warn('photo export failed', err);
    if (!blob) return;
  }
  if (els.fallbackImg.src) URL.revokeObjectURL(els.fallbackImg.src);
  els.fallbackImg.src = URL.createObjectURL(blob);
  els.fallback.hidden = false;
}

// ---------- wiring ----------
$('btn-home').addEventListener('click', () => showScreen('shape'));
els.backBtn.addEventListener('click', () => { if (!state.animating) zoomTo(-1); });
els.toolButtons.forEach(b => b.addEventListener('click', () => {
  armClear(false);
  selectTool(b.dataset.tool);
}));
els.clearBtn.addEventListener('click', () => armClear(!state.clearArmed));
buildTray();
$('btn-done').addEventListener('click', showParty);
$('btn-new').addEventListener('click', () => { hideParty(); showScreen('shape'); });
$('btn-photo').addEventListener('click', sharePhoto);
$('btn-fallback-close').addEventListener('click', () => { els.fallback.hidden = true; });

function applyMute(m) {
  state.muted = m;
  setMuted(m);
  els.muteBtn.textContent = m ? '🔇' : '🔊';
  try { localStorage.setItem('nail-salon-muted', m ? '1' : '0'); } catch { /* private mode */ }
}
try { applyMute(localStorage.getItem('nail-salon-muted') === '1'); } catch { applyMute(false); }
els.muteBtn.addEventListener('click', () => applyMute(!state.muted));

// every button pops; the first touch anywhere unlocks audio on iOS
document.addEventListener('pointerdown', initAudio, { capture: true });
document.addEventListener('click', e => { if (e.target.closest('button')) pop(); }, { capture: true });
new ResizeObserver(() => { if (state.screen === 'salon') fitCanvas(); }).observe(els.stage);

buildSkins();
buildTiles();
buildPalette();
showScreen('shape');
requestAnimationFrame(render);

// ---------- kid-proofing ----------
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => { if (!e.target.closest('#fallback')) e.preventDefault(); });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd < 300 && !e.target.closest('button')) e.preventDefault(); // no double-tap zoom
  lastTouchEnd = now;
}, { passive: false });

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.warn('sw failed', err));
}

// ---------- test hooks ----------
window.__salon = {
  state, PALETTE, STICKERS, SKIN_TONES,
  hand: () => state.hand,
  toScreen,
  nailCenterScreen(i) {
    const c = state.hand.nails[i].center;
    return toScreen(c.x, c.y);
  },
  brushShown,
  brushHandleScreen() {
    const n = state.hand.nails[state.zoomNail >= 0 ? state.zoomNail : 2];
    const h = brushHandleCenter(state.cursor.x, state.cursor.y, n.rect.w);
    return toScreen(h.x, h.y);
  },
  exportPhoto,
  layers: () => state.layers,
  layerAlphaAt: (i, x, y) => state.layers[i].alphaAt(x, y),
  layerPixelAt: (i, x, y) => state.layers[i].pixelAt(x, y),
  layerHasPaint: i => state.layers[i].hasPaint(),
  layerLeak: i => state.layers[i].leakCount(),
  outsidePoint(i) {
    const n = state.hand.nails[i];
    const b = n.bounds;
    const candidates = [[b.minX + 2, b.minY + 2], [b.maxX - 2, b.minY + 2], [b.minX + 2, b.maxY - 2], [b.maxX - 2, b.maxY - 2]];
    const c = candidates.find(([x, y]) => !pointInPolygon(x, y, n.points));
    return { x: c[0], y: c[1] };
  },
};
