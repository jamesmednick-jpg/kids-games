import { COLORS, FEATURES, towerParts, cubeSize } from './blocks.js';

// The numeral sign is the most important thing on screen, so it is drawn at a
// fixed size and never shrinks with the cubes.
export const SIGN_SIZE = 72;
const GAP = 4;
const INK = '#3a2c22';   // warm dark brown, like paint on a wooden toy

const rand = (a, b) => a + Math.random() * (b - a);

const svg = (cls, body, viewBox = '0 0 100 100') =>
  `<svg class="${cls}" viewBox="${viewBox}" overflow="visible" aria-hidden="true">${body}</svg>`;

const dots = (n, r, cy) => Array.from({ length: n }, (_, i) => {
  const x = 50 + (i - (n - 1) / 2) * (r * 2.6);
  return `<circle class="feature-shape" cx="${x}" cy="${cy}" r="${r}"/>`;
}).join('');

// An eye: white, a pupil that follows her finger (.pupil) and glances about
// on its own (.glance), and a lid in the cube's own colour that blinks.
const eye = (cx, cy, r, lid) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.08}" fill="#fff" stroke="${INK}" stroke-width="4"/>
   <g class="pupil"><g class="glance">
     <circle cx="${cx}" cy="${cy + r * 0.18}" r="${r * 0.42}" fill="${INK}"/>
     <circle cx="${cx - r * 0.2}" cy="${cy - r * 0.15}" r="${r * 0.14}" fill="#fff"/>
   </g></g>
   <ellipse class="lid" cx="${cx}" cy="${cy}" rx="${r + 1}" ry="${r * 1.08 + 1}" fill="${lid}" stroke="${INK}" stroke-width="3"/>`;

const grin = (y = 66) => `<path d="M30 ${y} Q50 ${y + 20} 70 ${y}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;

// One's single eye is its whole face; everyone else gets two.
const faceTwoEyes = lid => svg('face', eye(34, 40, 13, lid) + eye(66, 40, 13, lid) + grin());
const faceGrinOnly = () => svg('face', grin(74));

// Each buddy wears N of its own decoration, so the decoration is itself
// countable. Shapes are drawn in a 100x100 box and scaled with the cubes.
export function featureShapes(n) {
  switch (FEATURES[n]) {
    case 'eye':       // one big eye — a cyclops
      return svg('feature', `<g class="feature-shape">${eye(50, 50, 17, COLORS[1])}</g>`);
    case 'antennae':  // two bobbles, out from the temples so they miss the sign
      return svg('feature', [[-1, 8], [1, 92]].map(([d, x]) =>
        `<line x1="${x}" y1="18" x2="${x + d * 22}" y2="-14" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
         <circle class="feature-shape" cx="${x + d * 22}" cy="-18" r="11"/>`).join(''));
    case 'freckles':  // three
      return svg('feature', dots(3, 8, 50));
    case 'petals4':
      return svg('feature', Array.from({ length: 4 }, (_, i) =>
        `<ellipse class="feature-shape" cx="50" cy="24" rx="13" ry="23" transform="rotate(${i * 90} 50 50)"/>`).join('')
        + `<circle cx="50" cy="50" r="9" fill="#fff8e1"/>`);
    case 'star':      // one five-pointed star
      return svg('feature', `<polygon class="feature-shape" points="50,10 62,38 92,40 68,59 76,90 50,72 24,90 32,59 8,40 38,38"/>`);
    case 'spots':     // six ladybird spots
      return svg('feature', dots(3, 10, 30) + dots(3, 10, 70));
    case 'sparkles':  // seven
      return svg('feature', [[16, 22], [50, 16], [84, 22], [28, 52], [72, 52], [40, 82], [62, 82]].map(([x, y]) =>
        `<polygon class="feature-shape" points="${x},${y - 11} ${x + 3},${y - 3} ${x + 11},${y} ${x + 3},${y + 3} ${x},${y + 11} ${x - 3},${y + 3} ${x - 11},${y} ${x - 3},${y - 3}"/>`).join(''));
    case 'arms':      // eight little arms, waving out past the cube
      return svg('feature', Array.from({ length: 8 }, (_, i) =>
        `<rect class="feature-shape" x="45" y="-6" width="10" height="34" rx="5" transform="rotate(${i * 45 + 22.5} 50 50)"/>`).join('')
        + `<circle cx="50" cy="50" r="14" fill="#fff8e1"/>`);
    case 'petals9':
      return svg('feature', Array.from({ length: 9 }, (_, i) =>
        `<ellipse class="feature-shape" cx="50" cy="20" rx="9" ry="21" transform="rotate(${i * 40} 50 50)"/>`).join('')
        + `<circle cx="50" cy="50" r="10" fill="#fff8e1"/>`);
    case 'stripes':   // ten, a rainbow belt
      return svg('feature', Array.from({ length: 10 }, (_, i) =>
        `<rect class="feature-shape" x="${i * 10}" y="0" width="10" height="100" style="fill:hsl(${i * 36} 85% 58%)"/>`).join(''));
    default:
      return '';
  }
}

// Where a buddy's decoration sits. The face owns the top cube, so most
// decorations live on the cube below it; One's eye and Two's antennae belong
// on the head.
function featurePlacement(pn, size) {
  const f = FEATURES[pn];
  if (f === 'eye') return { top: 0, scale: 1 };
  if (f === 'antennae') return { top: 0, scale: 1 };
  if (pn >= 2) return { top: size + GAP, scale: f === 'stripes' ? 1 : 0.8 };
  return { top: 0, scale: 0.8 };
}

// One cube size for a whole scene, worked out from the tallest buddy that can
// appear in it. Every buddy on screen must share it: Ten is exactly one cube
// taller than Nine, and that is the entire point of the blocks.
export function cubeSizeFor(availableH, tallestN) {
  return cubeSize(availableH - SIGN_SIZE, Math.max(...towerParts(tallestN)), { gap: GAP });
}

// Builds a buddy into host and returns it. Clears whatever was there. Pass
// `size` (from cubeSizeFor) whenever more than one buddy shares a screen.
// `sign` exists only for the home-screen thumbnails; in play the sign is
// always SIGN_SIZE.
export function drawBuddy(host, n, { availableH = host.clientHeight || 520, size = null, faces = true, sign = SIGN_SIZE } = {}) {
  host.textContent = '';
  const parts = towerParts(n);
  size = size || cubeSizeFor(availableH, n);

  const buddy = document.createElement('div');
  buddy.className = 'buddy alive';
  buddy.dataset.n = n;
  buddy.style.setProperty('--cube', `${size}px`);
  // Each buddy breathes, blinks and glances on its own rhythm.
  buddy.style.setProperty('--breath-delay', `${-rand(0, 2.6)}s`);
  buddy.style.setProperty('--blink-delay', `${-rand(0, 4.5)}s`);
  buddy.style.setProperty('--glance-delay', `${-rand(0, 7)}s`);

  const signEl = document.createElement('div');
  signEl.className = 'sign';
  signEl.textContent = String(n);
  signEl.style.setProperty('--sign', `${sign}px`);
  buddy.append(signEl);

  const row = document.createElement('div');
  row.className = 'parts';
  for (const [pi, pn] of parts.entries()) {
    const part = document.createElement('div');
    part.className = 'part';
    part.dataset.partN = pn;
    for (let i = pn - 1; i >= 0; i--) {   // top cube first; data-index 0 is the top
      const cube = document.createElement('div');
      cube.className = 'cube';
      cube.dataset.index = pn - 1 - i;
      // --i counts from the top; --lag grows toward the top so a held tower
      // bends like a reed rather than tilting as a block.
      cube.style.cssText = `width:${size}px;height:${size}px;background:${COLORS[pn]};--i:${pn - 1 - i};--lag:${(i * 0.12).toFixed(2)}`;
      if (faces && pi === 0 && i === pn - 1) {
        cube.innerHTML = FEATURES[pn] === 'eye' ? faceGrinOnly() : faceTwoEyes(COLORS[pn]);
      }
      part.append(cube);
    }
    const place = featurePlacement(pn, size);
    part.insertAdjacentHTML('beforeend',
      `<div class="feature-holder" style="top:${place.top}px;width:${size}px;height:${size}px;--scale:${place.scale}">${featureShapes(pn)}</div>`);
    row.append(part);
  }
  buddy.append(row);
  host.append(buddy);
  return buddy;
}

// ---------- celebration ----------
// Build and Add earn the fireworks; Play stays calm and never calls these.

const PALETTE = Object.values(COLORS).filter(c => c !== '#ffffff');

// Effects live in one overlay per screen, above the towers, never touchable.
function fxLayer(screen) {
  let fx = screen.querySelector('.fx');
  if (!fx) {
    fx = document.createElement('div');
    fx.className = 'fx';
    screen.append(fx);
  }
  return fx;
}

export function clearFx(screen) {
  const fx = screen.querySelector('.fx');
  if (fx) fx.textContent = '';
}

function piece(fx, cls, style, life) {
  const el = document.createElement('i');
  el.className = cls;
  el.style.cssText = style;
  fx.append(el);
  setTimeout(() => el.remove(), life);
  return el;
}

// Confetti is little coloured cubes, in every buddy's colour, raining down.
export function confetti(screen, count = 40) {
  const fx = fxLayer(screen);
  for (let i = 0; i < count; i++) {
    const s = rand(8, 15);
    piece(fx, 'confetti-piece',
      `left:${rand(0, 100)}%; width:${s}px; height:${s}px; background:${PALETTE[i % PALETTE.length]};` +
      `animation-duration:${rand(1.8, 3)}s; animation-delay:${rand(0, 0.8)}s; --spin:${rand(-720, 720)}deg`,
      4200);
  }
}

// Fireworks fling outward from a point. For milestones.
export function fireworks(screen, x, y, count = 64) {
  const fx = fxLayer(screen);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand(-0.2, 0.2);
    const dist = rand(80, 230);
    piece(fx, 'firework',
      `left:${x}px; top:${y}px; background:${PALETTE[i % PALETTE.length]};` +
      `--dx:${Math.cos(angle) * dist}px; --dy:${Math.sin(angle) * dist}px; animation-delay:${rand(0, 0.15)}s`,
      1600);
  }
}

// Stars burst from the point where two buddies meet.
export function stars(screen, x, y, count = 22) {
  const fx = fxLayer(screen);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = rand(50, 120);
    const el = piece(fx, 'star',
      `left:${x}px; top:${y}px; font-size:${rand(14, 26)}px; --dx:${Math.cos(angle) * dist}px; --dy:${Math.sin(angle) * dist}px`,
      1200);
    el.textContent = '\u2726';
  }
}

export const isMilestone = n => n % 5 === 0;

// The face arrives with a boing.
export function popFace(buddy) {
  const face = buddy.querySelector('.face');
  if (face) face.classList.add('pop');
}

// The dance: sway, bop, wobble, eyes darting — CSS does the moving. Confetti
// for everyone, fireworks from the sign for a milestone.
export function celebrate(screen, buddy, n) {
  buddy.classList.add('dance');
  confetti(screen, isMilestone(n) ? 130 : 80);
  if (isMilestone(n)) {
    const r = buddy.querySelector('.sign').getBoundingClientRect();
    const s = screen.getBoundingClientRect();
    fireworks(screen, r.left + r.width / 2 - s.left, r.top + r.height / 2 - s.top);
  }
}

// ---------- life ----------

// Every face on the page looks toward a point; null looks straight ahead.
export function lookAt(x, y) {
  for (const face of document.querySelectorAll('.face')) {
    if (x === null) { face.style.setProperty('--px', '0px'); face.style.setProperty('--py', '0px'); continue; }
    const r = face.getBoundingClientRect();
    if (!r.width) continue;
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, dist / 90) * 6;   // pupils travel up to 6 units
    face.style.setProperty('--px', `${(dx / dist * reach).toFixed(1)}px`);
    face.style.setProperty('--py', `${(dy / dist * reach).toFixed(1)}px`);
  }
}

// Tiny glittering sparks around a point. Used for trails, meetings, landings.
export function sparks(screen, x, y, count = 6, spread = 22) {
  const fx = fxLayer(screen);
  for (let i = 0; i < count; i++) {
    piece(fx, 'spark',
      `left:${x + rand(-spread, spread)}px; top:${y + rand(-spread, spread)}px; width:${rand(4, 9)}px; height:${rand(4, 9)}px;` +
      `background:${i % 3 ? '#ffd23f' : '#fff'}; animation-delay:${rand(0, 0.12)}s; --rise:${rand(-30, -8)}px`,
      800);
  }
}

// A white flash across the screen for the instant two buddies touch.
export function flash(screen) {
  piece(fxLayer(screen), 'flash', '', 450);
}

// A cube flies from one place to another (both rects in viewport coords) and
// resolves when it lands.
export function flyCube(screen, from, to, color, size) {
  const fx = fxLayer(screen);
  const s = screen.getBoundingClientRect();
  const el = document.createElement('i');
  el.className = 'flying cube';
  el.style.cssText = `width:${size}px;height:${size}px;background:${color};left:0;top:0`;
  fx.append(el);
  const x0 = from.left + from.width / 2 - size / 2 - s.left, y0 = from.top + from.height / 2 - size / 2 - s.top;
  const x1 = to.left - s.left, y1 = to.top - s.top;
  const anim = el.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(0.9) rotate(0deg)` },
    { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 110}px) scale(1.12) rotate(180deg)`, offset: 0.5 },
    { transform: `translate(${x1}px, ${y1}px) scale(1) rotate(360deg)` },
  ], { duration: 330, easing: 'cubic-bezier(.3, .1, .6, 1)', fill: 'forwards' });
  return anim.finished.then(() => el.remove()).catch(() => el.remove());
}
