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
export function isMuted() { return muted; }

async function buffer(id) {
  if (buffers.has(id)) return buffers.get(id);
  const bytes = await (await fetch(`./voice/${clips[id]}`)).arrayBuffer();
  const buf = await ctx.decodeAudioData(bytes);
  buffers.set(id, buf);
  return buf;
}

export async function say(id) {
  spoken.push(id);
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

export async function sayAll(ids) {
  for (const id of ids) await say(id);
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

export function thunk() { tone(180, 0.11, 'triangle', 0.22); }
export function step(k) { tone(392 * Math.pow(2, (k - 1) / 12), 0.14, 'sine', 0.16); }
export function clunk() { tone(120, 0.18, 'square', 0.16); tone(240, 0.12, 'triangle', 0.1, 0.04); }
export function chime() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.6, 'sine', 0.18, i * 0.14)); }
