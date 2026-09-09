import { COLORS, FEATURES, towerParts, cubeSize } from './blocks.js';

// The numeral sign is the most important thing on screen, so it is drawn at a
// fixed size and never shrinks with the cubes.
export const SIGN_SIZE = 72;
const GAP = 4;
const INK = '#3a2c22';   // warm dark brown, like paint on a wooden toy

const svg = (cls, body, viewBox = '0 0 100 100') =>
  `<svg class="${cls}" viewBox="${viewBox}" overflow="visible" aria-hidden="true">${body}</svg>`;

const dots = (n, r, cy) => Array.from({ length: n }, (_, i) => {
  const x = 50 + (i - (n - 1) / 2) * (r * 2.6);
  return `<circle class="feature-shape" cx="${x}" cy="${cy}" r="${r}"/>`;
}).join('');

const eye = (cx, cy, r) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.08}" fill="#fff" stroke="${INK}" stroke-width="4"/>
   <circle cx="${cx}" cy="${cy + r * 0.18}" r="${r * 0.42}" fill="${INK}"/>
   <circle cx="${cx - r * 0.2}" cy="${cy - r * 0.15}" r="${r * 0.14}" fill="#fff"/>`;

const grin = (y = 66) => `<path d="M30 ${y} Q50 ${y + 20} 70 ${y}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;

// One's single eye is its whole face; everyone else gets two.
const FACE_TWO_EYES = svg('face', eye(34, 40, 13) + eye(66, 40, 13) + grin());
const FACE_GRIN_ONLY = svg('face', grin(74));

// Each buddy wears N of its own decoration, so the decoration is itself
// countable. Shapes are drawn in a 100x100 box and scaled with the cubes.
export function featureShapes(n) {
  switch (FEATURES[n]) {
    case 'eye':       // one big eye — a cyclops
      return svg('feature', `<g class="feature-shape">${eye(50, 50, 17)}</g>`);
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

// Builds a buddy into host and returns it. Clears whatever was there.
export function drawBuddy(host, n, { availableH = host.clientHeight || 520, faces = true } = {}) {
  host.textContent = '';
  const parts = towerParts(n);
  const tallest = Math.max(...parts);
  const size = cubeSize(availableH - SIGN_SIZE, tallest, { gap: GAP });

  const buddy = document.createElement('div');
  buddy.className = 'buddy';
  buddy.dataset.n = n;
  buddy.style.setProperty('--cube', `${size}px`);

  const sign = document.createElement('div');
  sign.className = 'sign';
  sign.textContent = String(n);
  sign.style.setProperty('--sign', `${SIGN_SIZE}px`);
  buddy.append(sign);

  const row = document.createElement('div');
  row.className = 'parts';
  for (const [pi, pn] of parts.entries()) {
    const part = document.createElement('div');
    part.className = 'part';
    part.dataset.partN = pn;
    for (let i = pn - 1; i >= 0; i--) {   // top cube first, so index 0 is the top
      const cube = document.createElement('div');
      cube.className = 'cube';
      cube.dataset.index = i;
      cube.style.cssText = `width:${size}px;height:${size}px;background:${COLORS[pn]}`;
      if (faces && pi === 0 && i === pn - 1) {
        cube.innerHTML = FEATURES[pn] === 'eye' ? FACE_GRIN_ONLY : FACE_TWO_EYES;
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
