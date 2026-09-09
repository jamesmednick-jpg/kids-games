import { MAX_SUPPORTED } from './blocks.js';

// ===== Parent config: edit these freely =====
export const MAX_NUMBER = 10;        // 10 or 20
export const IDLE_NUDGE_MS = 8000;   // how long before the game offers a hint
export const CHATTINESS = 1;         // 0 quiet, 1 normal, 2 chatty
// Colours and character features live in blocks.js because they are drawn.
// Voice tuning lives in tools/make-voice.mjs; run `npm run voice` after editing.
// ============================================

if (MAX_NUMBER > MAX_SUPPORTED) throw new Error(`MAX_NUMBER must be at most ${MAX_SUPPORTED}`);

const $ = id => document.getElementById(id);
const SCREENS = ['home', 'build', 'add', 'play'];

export const state = { screen: 'home', muted: false };

export function go(name) {
  state.screen = name;
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  $('btn-home').hidden = name === 'home';
}

for (const btn of document.querySelectorAll('[data-mode]')) {
  btn.addEventListener('click', () => go(btn.dataset.mode));
}
$('btn-home').addEventListener('click', () => go('home'));
$('btn-mute').addEventListener('click', () => {
  state.muted = !state.muted;
  $('btn-mute').textContent = state.muted ? '🔇' : '🔊';
});

go('home');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

window.__nb = { state, go, settings: { MAX_NUMBER, IDLE_NUDGE_MS, CHATTINESS } };
