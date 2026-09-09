import { MAX_SUPPORTED } from './blocks.js';
import { initAudio, setMuted, say } from './audio.js';
import { mountBuild } from './build.js';
import { mountAdd } from './add.js';
import { mountPlay } from './play.js';
import { drawBuddy } from './render.js';

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
  if (state.screen === 'build' && name !== 'build') build.stop();
  if (state.screen === 'add' && name !== 'add') add.stop();
  if (state.screen === 'play' && name !== 'play') play.stop();
  state.screen = name;
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  $('btn-home').hidden = name === 'home';
  if (name === 'build') build.start();
  if (name === 'add') add.start();
  if (name === 'play') play.start();
}

for (const btn of document.querySelectorAll('[data-mode]')) {
  btn.addEventListener('click', async () => {
    await initAudio();
    say(`mode-${btn.dataset.mode}`);
    go(btn.dataset.mode);
  });
}
$('btn-home').addEventListener('click', () => go('home'));
$('btn-mute').addEventListener('click', () => {
  state.muted = !state.muted;
  setMuted(state.muted);
  $('btn-mute').textContent = state.muted ? '🔇' : '🔊';
});

// Little buddies on the home tiles, so the first screen already looks like
// the game rather than a row of emoji.
function drawTiles() {
  const mini = (host, n) => {
    const slot = document.createElement('span');
    slot.className = 'mini';
    host.append(slot);
    drawBuddy(slot, n, { size: 16, sign: 26 });
  };
  const build = document.querySelector('[data-pic="build"]');
  mini(build, 3);
  const add = document.querySelector('[data-pic="add"]');
  mini(add, 2);
  add.insertAdjacentHTML('beforeend', '<span class="mini-plus">+</span>');
  mini(add, 3);
  const play = document.querySelector('[data-pic="play"]');
  for (const n of [1, 4, 2]) mini(play, n);
}
drawTiles();

// Tests shorten the idle delay with ?nudge=250 rather than waiting eight seconds.
const nudgeMs = Number(new URLSearchParams(location.search).get('nudge')) || IDLE_NUDGE_MS;

const build = mountBuild($('screen-build'), { max: MAX_NUMBER, nudgeMs });
const add = mountAdd($('screen-add'), { max: MAX_NUMBER, nudgeMs });
const play = mountPlay($('screen-play'), { max: MAX_NUMBER });
Object.assign(window.__nb, { build, add, play, nudgeMs });

go('home');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

window.__nb = Object.assign(window.__nb || {}, { state, go, settings: { MAX_NUMBER, IDLE_NUDGE_MS, CHATTINESS } });
