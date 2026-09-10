// Voice clips are pre-generated files; effects are synthesised. Nothing here
// knows or cares which voice produced a clip — see tools/make-voice.mjs.
let ctx = null;
let muted = false;
let clips = null;              // id -> filename
const buffers = new Map();     // id -> AudioBuffer

// Every clip id the game asks for, in order. Tests assert on this instead of
// listening for sound.
const spoken = [];
window.__nb = window.__nb || {};
window.__nb.spoken = spoken;

export async function initAudio() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = AC ? new AC() : null;
    } catch (err) {
      console.warn('audio unavailable', err);
    }
  }
  if (ctx && ctx.state === 'suspended') await ctx.resume().catch(() => {});
  if (!clips) {
    try {
      clips = (await (await fetch('./voice/manifest.json')).json()).clips;
    } catch (err) {
      console.warn('voice manifest unavailable', err);
      clips = {};
    }
  }
}

export function setMuted(m) { muted = !!m; }
export function hasClip(id) { return !!(clips && clips[id]); }
export function isMuted() { return muted; }

async function buffer(id) {
  if (buffers.has(id)) return buffers.get(id);
  const bytes = await (await fetch(`./voice/${clips[id]}`)).arrayBuffer();
  const buf = await ctx.decodeAudioData(bytes);
  buffers.set(id, buf);
  return buf;
}

async function play(id) {
  if (!clips || !clips[id]) { console.warn('no such clip:', id); return; }
  if (!ctx || muted) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = await buffer(id);
    src.connect(ctx.destination);
    await new Promise(resolve => { src.onended = resolve; src.start(); });
  } catch (err) {
    console.warn('clip failed', id, err);
  }
}

// Clips queue up and play one after another. When she taps five times fast
// she hears "one, two, three, four, five", not five voices at once.
let queue = Promise.resolve();
export function say(id) {
  spoken.push(id);
  const turn = queue.then(() => play(id));
  queue = turn.catch(() => {});
  return turn;
}

// A reaction — a giggle, a "wheee" — plays straight away over whatever is
// queued, and never holds the lesson up.
export function sayNow(id) {
  spoken.push(id);
  return play(id);
}

// Enqueues every clip at once, in order; resolves when the last has played.
export function sayAll(ids) {
  let last = Promise.resolve();
  for (const id of ids) last = say(id);
  return last;
}

function tone(freq, dur, type = 'sine', gain = 0.2, when = 0) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (err) {
    console.warn('tone failed', err);
  }
}

function slide(f0, f1, dur, type = 'sine', gain = 0.18, when = 0) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (err) {
    console.warn('slide failed', err);
  }
}

export function thunk() { tone(180, 0.11, 'triangle', 0.22); }
// A single glint of the sparkle trail.
export function glint() { tone(2200 + Math.random() * 1800, 0.09, 'sine', 0.035); }
// A cube landing.
export function boing() { slide(420, 160, 0.16, 'triangle', 0.2); }
// A cube igniting during a count, brighter each time.
export function ding(k) { const f = 1046.5 * Math.pow(2, (k - 1) / 12); tone(f, 0.22, 'sine', 0.12); tone(f * 2, 0.12, 'sine', 0.04, 0.01); }
export function step(k) { tone(392 * Math.pow(2, (k - 1) / 12), 0.14, 'sine', 0.16); }
export function clunk() { tone(120, 0.18, 'square', 0.16); tone(240, 0.12, 'triangle', 0.1, 0.04); }
export function chime() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.6, 'sine', 0.18, i * 0.14)); }
// A quick glittering run, for the moment two buddies touch.
export function sparkle() { [880, 1108.7, 1318.5, 1760, 2217.5, 2637].forEach((f, i) => tone(f, 0.28, 'sine', 0.10, i * 0.045)); }
// A little fanfare under the cheer.
export function fanfare() {
  const notes = [[523.25, 0, 0.18], [659.25, 0.12, 0.18], [783.99, 0.24, 0.18], [1046.5, 0.40, 0.22], [783.99, 0.58, 0.14], [1046.5, 0.70, 0.7]];
  for (const [f, at, dur] of notes) { tone(f, dur, 'triangle', 0.15, at); tone(f / 2, dur, 'sine', 0.08, at); }
}
