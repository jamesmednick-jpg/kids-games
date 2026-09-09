# Number Buddies — Design Spec

Date: 2026-09-09
Status: approved in conversation, awaiting written review

## Purpose

A counting and adding game for a 5-year-old to play on an iPhone. She builds
numbers out of coloured cubes, pushes two numbers together to make a bigger
one, and plays freely with a bin of blocks. Every number she makes comes
alive with a face and an Irish voice that counts along with her.

The child loves Numberblocks. This game is built in that spirit — a number is
a tower of that many cubes, and joining towers makes a new number — but with
original art, original names, and no reference to the show or its characters.
The site is public, so nothing from the show is copied or named.

Second game in the "KIDS GAMES" collection. It follows every convention
established by `nail-salon/`.

## Non-goals

Deliberately excluded. Do not add these:

- No score, no stars, no timers, no streaks, no progress tracking.
- No levels or unlocks. Every mode is available from the home screen always.
- No accounts, no network calls, no analytics, no ads, no links out.
- No in-game settings screen. Parent settings are labelled constants at the
  top of one file, as in `nail-salon/game.js`.
- No subtraction, no multiplication, no number bonds drills.
- No text the child must read in order to proceed.

## Delivery

Identical to Nail Salon:

- Static web app in its own folder. No build step, no runtime dependencies.
- Installed via Safari "Add to Home Screen", opens full screen with its
  own icon.
- Served by GitHub Pages from `main` of `jamesmednick-jpg/kids-games`.
- Works offline after first load via a service worker scoped to the folder.
- `npm run publish` bumps the cache name, commits and pushes.

## Folder layout

```
number-buddies/
  index.html               game shell
  style.css
  game.js                  modes, state machine, parent settings
  blocks.js                tower model: build, split, join, colours, faces
  render.js                DOM/CSS rendering of towers and faces
  audio.js                 clip playback + synthesised sound effects
  voice/                   pre-generated .m4a speech clips
    manifest.json          clip id -> filename, generated
    *.m4a
  sw.js                    offline cache
  manifest.webmanifest
  icon-192.png, icon-512.png, apple-touch-icon.png
tools/
  make-voice.mjs           regenerates voice/ from a phrase list
```

Blocks and faces are DOM elements styled with CSS, not canvas. Towers are
rectangles with rounded corners; CSS transforms and transitions give the
squash, bounce and merge animations for free, keep the art crisp at every
screen density, and make the whole thing straightforward to drive from
Playwright. Nail Salon uses canvas because it needed freehand painting
clipped to nail outlines; this game has no such need.

## The blocks

A number N is a vertical tower of N cubes in that number's colour, with a
face on the top cube and a round white numeral sign above it.

Art direction comes from wooden stacking toys: flat face-on squares, softly
rounded corners, matte colour with a faint grain, and shading limited to a
soft inner highlight at the top of each cube and a slightly darker band at
the bottom. Cubes are drawn straight on, not in isometric perspective.
Gaps between cubes in a tower are visible but small, so the tower reads as
separate countable cubes rather than one painted column.

### The numeral sign

A white circle on a short stalk sits centred above every tower, carrying the
number in chunky near-black type. The circle overlaps the top cube slightly,
as if planted in it.

The sign is drawn at a **fixed size regardless of tower height or cube
size** — a One and a Ten carry the same sign. It is the most important thing
on screen and must never shrink with the art. (Nail Salon hit exactly this
bug with ring previews; see commit `042fdf0`.)

### Faces and signature features

The top cube carries a face: eyes and a wide grin, cartoon-simple.

Beyond the face, each buddy wears **N of its own decoration**, spread across
the cubes of the tower. The decoration is itself countable, so the character
design reinforces the number — she can count Three's freckles.

| N | Colour | Hex | Signature feature |
|---|--------|-----|-------------------|
| 1 | red | `#e63946` | one big eye, centred — a cyclops |
| 2 | orange | `#f4802b` | two bobble antennae |
| 3 | yellow | `#ffd23f` | three freckles |
| 4 | green | `#43aa5a` | a four-petal flower |
| 5 | blue | `#3b82d6` | one five-pointed star |
| 6 | violet | `#8b5cf6` | six ladybird spots |
| 7 | sky | `#38bdf8` | seven sparkles |
| 8 | pink | `#ec4899` | eight little arms |
| 9 | teal | `#14b8a6` | a nine-petal flower |
| 10 | white | `#ffffff` | ten stripes in a rainbow band |

Features are defined as small inline SVG shapes in `render.js`, one function
per buddy, taking the tower geometry and returning the decoration positions.
Every feature must be positioned relative to the tower's cubes so it scales
with them.

Above ten there are no new features. A number renders as a ten-tower plus a
remainder tower, and each part wears its own — thirteen is Ten's rainbow
stripes standing beside Three's freckles. The numeral sign shows `13` once,
above the pair.

### Sizing

Cube edge is computed so that the tallest tower on screen fits the play area
with margin, clamped to a minimum of 44 px so cubes stay tappable. At ten
cubes on a typical phone this lands around 56 px. Towers are centred
horizontally in their slot.

Above 10 (see Range below), a tower renders as a full ten-block plus the
remainder beside it — `13` is a ten-tower with a three-tower next to it —
rather than a single very tall column.

## Range

`MAX_NUMBER` is a parent setting at the top of `game.js`, default `10`.

- At 10: Build targets are 1–10, Add pairs always sum to 10 or less.
- At 20: targets and sums extend to 20 and towers above ten render as
  ten-plus-remainder.

Nothing else in the game reads a hard-coded 10.

## Voice

All speech is pre-generated on the developer's Mac with the built-in `say`
command and shipped as `.m4a` files. Nothing is spoken live by the phone.
This guarantees identical delivery on every device, works with no network,
and cannot fail because a voice is missing from the phone.

Voice: **Moira** (`en_IE`, Irish), tuned playful:

```
[[pbas 66]] [[pmod 170]] [[rate 200]]
```

`pbas` raises the pitch, `pmod` is the sing-song lilt, `rate` is words per
minute. These three numbers are constants at the top of `tools/make-voice.mjs`
so the whole voice can be retuned or swapped by editing one line and running
`npm run voice`.

### Character pitch

Each number speaks its own lines at its own base pitch, so the buddies feel
like different little characters without needing different voices. Pitch
falls linearly from squeaky One to deep Ten:

```
pbas(n) = round(92 - (n - 1) * 5.6)     // 92 at n=1, 42 at n=10
rate(n) = round(205 - (n - 1) * 3)      // little ones talk faster
```

Narration lines — prompts, counting, cheers — use the standard tuned Moira
settings above, not the per-character pitch.

### Per-number voices, later

Moira does everything in version one. Giving each buddy its own distinct
voice — Junior, Jester, Superstar, Bubbles and friends — is a planned
follow-up, not a maybe, so version one must not make it expensive.

The requirement that falls out of that: **no game code may depend on which
voice produced a clip.** The game asks the audio layer for `is-7` and gets a
sound; where that sound came from is entirely `make-voice.mjs`'s business.
Concretely, `make-voice.mjs` holds a `VOICES` table mapping each number to a
voice name and tuning. In version one every entry is Moira at that number's
character pitch. Assigning real voices later is an edit to that table plus
`npm run voice` — no changes to `game.js`, `audio.js`, or any test.

Character lines (`is-N`) are therefore the only clips keyed by number.
Narration, counting, cheers and nudges stay in the single narrator voice
permanently, so the follow-up work stays small.

### Clip inventory

`tools/make-voice.mjs` holds a phrase list of `{ id, text, voiceOpts }` and
writes one `.m4a` per entry plus `voice/manifest.json`. Clips needed:

- `count-1` … `count-20` — "one", "two", …, the counting beat. Each clip is
  generated at a pitch `pbas = 50 + k * 1.6`, so playing them in sequence
  produces the rising count on its own. Playback is a plain sequence with no
  runtime pitch handling.
- `is-1` … `is-20` — "I'm one!", each at that number's character pitch.
- `make-1` … `make-20` — "Can you make five?", narrator voice.
- `cheer-1` … `cheer-4` — "you made it!", "woo hoo!", "brilliant!", "look at
  you!". One is picked at random per celebration so it does not get stale.
- `over-2` … `over-22` — "ooh, that's six! pop one off?". Generated for
  2..MAX+2, covering an overshoot of up to two cubes past the largest target.
- `join` — "let's count them all!", played once as a merged tower begins its
  recount.
- `nudge-tap` — "tap another block!"
- `nudge-drag` — "push them together!"
- `mode-build`, `mode-add`, `mode-play` — spoken when a home tile is tapped.

Total is roughly 100 short clips, well under 1 MB at 64 kbps AAC. All are
listed in `sw.js` so the game is fully playable offline.

### Sound effects

Synthesised with Web Audio, reusing the approach in `nail-salon/audio.js`
(no audio files): a soft `thunk` when a cube lands, a rising note per cube
during a count, a `clunk` on merge, and the existing `chime` for a cheer.

## Screens

Portrait, full width, minimum 56 px touch targets, nothing to read.

### Home

Three big tiles in a row (stacking to a column on narrow screens), each
showing a picture of its mode and a one-word label. Tapping a tile speaks
the mode name and enters it. A mute toggle sits in the corner, matching
Nail Salon's.

```
            Number Buddies
  ┌─────────┐ ┌─────────┐ ┌─────────┐
  │   ▢▢▢   │ │  ☺ + ☺  │ │  ▢ ☺ ▢  │
  │  BUILD  │ │   ADD   │ │  PLAY   │
  └─────────┘ └─────────┘ └─────────┘
```

Every mode screen has a single large home arrow in the top-left. There is
no other navigation.

### Build

1. A target buddy appears in outline at the top — a ghost tower of N cubes —
   and Moira asks "Can you make five?"
2. A cube waits at the bottom of the screen. Tapping it, or dragging it up,
   drops a cube onto the tower. Either gesture works; a 5-year-old should
   not have to discover a specific one.
3. Each cube that lands plays `count-k` for the new height, with a rising
   note. The numeral is shown large beside the tower.
4. When the tower reaches N the outline fills, a face pops onto the top
   cube, the tower squashes and bounces, confetti fires, the buddy says
   `is-N`, and a random `cheer-*` plays.
5. A big "again" button offers the next target. Targets are drawn in random
   order from a shuffled bag of 1..MAX so nothing repeats until all have
   been seen.

Overshoot: cubes beyond N are allowed to land. The tower plays `over-N+k`,
the extra cubes tint slightly and jiggle, and tapping any extra cube removes
it. Nothing says "wrong" and nothing is blocked.

### Add

1. Two buddies stand apart with a `+` between them, both already faced and
   labelled with their numerals. The pair is chosen so the sum is within
   MAX.
2. She drags either buddy toward the other. They snap together when close
   and clunk into a single tower.
3. The merged tower recounts from one — each cube lights in turn with
   `count-k` and the rising note — then the new numeral appears, a face pops
   on, and the buddy says `is-N` followed by a cheer.
4. "Again" offers a new pair.

The drag has generous tolerance: releasing anywhere in the middle third of
the screen counts as "together". Tapping either buddy instead of dragging
also merges them, after a `nudge-drag` hint.

### Play

A bin of loose cubes along the bottom, unlimited. Dragging a cube out
creates a one-tower. Dropping a cube or tower onto another joins them.
Dragging the top cube off a tower splits it. Any tower whose height changes
speaks its new number and shows its numeral. Towers keep their faces.

A sweep button clears the board. Nothing else. No goals, no prompts.

## Guidance

The child is 5 and the game must never stall or scold.

- **Idle nudge.** After 8 seconds with no touch in Build or Add, the thing
  to touch next glows and bounces. After 8 more, the matching `nudge-*` clip
  plays. The cycle repeats indefinitely; it never gives up or advances on
  her behalf.
- **No failure state.** There is no wrong answer, no retry, no "try again".
  Overshoot is a gentle observation plus an obvious way to undo it.
- **Every instruction is voice plus picture.** Text on screen is decorative
  — numerals, the mode labels — and never load-bearing.
- **Counting is always from one.** Merged towers recount the whole tower
  rather than counting on from the first addend. That is how the show does
  it and it is what a 5-year-old can follow.

## Parent settings

Labelled constants at the top of `game.js`, in the style of
`nail-salon/game.js`:

- `MAX_NUMBER` — 10 or 20.
- `CHATTINESS` — how often cheers and nudges fire.
- `IDLE_NUDGE_MS` — default 8000.
- `COLORS` — the palette above.

Voice tuning lives in `tools/make-voice.mjs`, documented in the README.

## Testing

Unit (`node --test`), on the pure logic in `blocks.js`:

- Joining two towers yields a tower of the summed height and keeps colour
  rules.
- Splitting a tower at k yields two towers summing to the original.
- The shuffled-bag target picker emits every value in 1..MAX before
  repeating any.
- Character pitch and rate ramps produce the documented values at n=1 and
  n=MAX.
- Tower rendering above 10 splits into ten-plus-remainder.

End-to-end (Playwright), following the patterns in `tests/e2e/`:

- Launcher shows both game tiles and the Number Buddies tile opens the game.
- Home shows three mode tiles; each opens its mode; the home arrow returns.
- Build: tapping the cube N times completes the target, fires the
  celebration, and announces the right number.
- Build: overshoot shows the gentle message and tapping an extra cube
  removes it.
- Add: dragging one buddy onto the other merges them into the summed tower.
- Add: tapping instead of dragging also merges.
- Play: cubes can be pulled out, joined and split, and the spoken number
  tracks the tower height.
- Idle nudge appears after the configured delay.
- Kidproofing, mirroring `tests/e2e/kidproof.spec.mjs`: no pinch-zoom, no
  text selection, no scroll bounce, no way to leave the game, and rapid
  random tapping never breaks the state machine.
- Audio is muted in tests via the same mechanism Nail Salon uses; clip
  playback is asserted by the clip id requested, not by sound.

## Build order

1. `blocks.js` plus its unit tests — the tower model, no UI.
2. `tools/make-voice.mjs` and the generated clips, with the README note.
3. Shell: folder, manifest, service worker, icons, launcher tile.
4. Build mode end to end, including celebration and overshoot.
5. Add mode.
6. Play mode.
7. Idle nudges and kidproofing pass.
8. Publish.

Each step ends with its tests passing before the next begins.
