// Pre-generates every spoken clip with the macOS `say` command.
//
// Nothing is spoken live by the phone. Generating up front means the voice is
// identical on every device, works with no network, and cannot fail because a
// voice is missing from the phone.
//
// Requires macOS. The generated .m4a files are committed, so running the game
// or its tests needs no Mac.
//
//   npm run voice
//
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { characterPitch, characterRate, countPitch } from '../number-buddies/blocks.js';

// ===== Voice config: edit these freely, then run `npm run voice` =====
// pbas = pitch (higher is squeakier), pmod = sing-song lilt, rate = words/min.
export const NARRATOR = { voice: 'Moira', pbas: 52, pmod: 90, rate: 145 };

// One entry per buddy. Today every buddy is Moira at its own pitch. To give
// each buddy a real voice of its own, change the `voice` here and re-run —
// no game file knows or cares which voice produced a clip.
export const VOICES = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => i + 1).map(n => [n, {
    voice: 'Moira', pbas: characterPitch(n), rate: characterRate(n),
  }]),
);
// =====================================================================

const NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'twenty one', 'twenty two',
];
const word = n => NUMBER_WORDS[n - 1];

const narrated = (id, text, over = {}) => ({ id, text, ...NARRATOR, ...over });

export function buildPhrases(max) {
  const out = [];

  // The counting beat. Each clip is a little higher than the last, so playing
  // them in order gives the rising count with no runtime pitch handling.
  for (let k = 1; k <= max; k++) {
    out.push(narrated(`count-${k}`, `${word(k)}.`, { pbas: countPitch(k), pmod: 100 }));
  }

  // A buddy introducing itself, in that buddy's own voice.
  for (let n = 1; n <= max; n++) {
    const v = VOICES[n];
    out.push({ id: `is-${n}`, text: `[[emph +]] I'm ${word(n)}!`, voice: v.voice, pbas: v.pbas, pmod: NARRATOR.pmod, rate: v.rate });
  }

  // The prompt.
  for (let n = 1; n <= max; n++) out.push(narrated(`make-${n}`, `Can you make ${word(n)}?`));

  // Overshoot, always kind and always with a way out. Covers up to two cubes
  // past the largest target.
  for (let n = 2; n <= max + 2; n++) {
    out.push(narrated(`over-${n}`, `Ooh, that's ${word(n)}! Pop one off?`));
  }

  out.push(narrated('join', `Let's count them all!`));
  // Flying through the air.
  ['Wheeeeeeee!', 'Whoooooa!'].forEach((text, i) =>
    out.push(narrated(`fall-${i + 1}`, `[[emph +]] ${text}`, { pbas: NARRATOR.pbas + 10, rate: NARRATOR.rate - 25 })));
  // Being picked up.
  ['Wheee!', 'Hee hee hee!', 'Up we go!'].forEach((text, i) =>
    out.push(narrated(`pickup-${i + 1}`, `[[emph +]] ${text}`, { pbas: NARRATOR.pbas + 8, rate: NARRATOR.rate + 20 })));
  out.push(narrated('nudge-tap', 'Tap another block!'));
  out.push(narrated('nudge-drag', 'Push them together!'));
  out.push(narrated('mode-build', 'Build!'));
  out.push(narrated('mode-add', 'Add!'));
  out.push(narrated('mode-play', 'Play!'));

  ['You made it!', 'Woo hoo!', 'Brilliant!', 'Look at you!']
    .forEach((text, i) => out.push(narrated(`cheer-${i + 1}`, `[[emph +]] ${text}`)));

  return out;
}

async function main() {
  const OUT = decodeURIComponent(new URL('../number-buddies/voice/', import.meta.url).pathname);
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const phrases = buildPhrases(20);
  const clips = {};
  for (const p of phrases) {
    const wav = `${OUT}${p.id}.wav`;
    const m4a = `${OUT}${p.id}.m4a`;
    execFileSync('say', ['-v', p.voice, '-o', wav, '--data-format=LEI16@22050',
      `[[pbas ${p.pbas}]] [[pmod ${p.pmod}]] [[rate ${p.rate}]] ${p.text}`]);
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', wav, m4a]);
    await rm(wav);
    clips[p.id] = `${p.id}.m4a`;
  }
  await writeFile(`${OUT}manifest.json`, JSON.stringify({ clips }, null, 2) + '\n');
  console.log(`wrote ${phrases.length} clips to number-buddies/voice/`);
}

// Only generate when run directly; importing this module must not shell out.
if (process.argv[1] && process.argv[1].endsWith('make-voice.mjs')) await main();
