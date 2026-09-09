# Nail Salon — Design Spec

Date: 2026-09-08
Status: approved in conversation, awaiting written review

## Purpose

A parent-controlled game for a 5-year-old to play on an iPhone. No ads, no
purchases, no accounts, no links out. She paints a hand of nails with a
brush that stays inside the lines, adds glitter and stickers, and gets a
celebration and a photo at the end.

This is the first game in a "KIDS GAMES" collection. The folder layout must
make adding a second game a matter of adding a folder.

## Delivery

- A static web app. No build step, no framework, no package dependencies at
  runtime.
- Installed on the phone via Safari "Add to Home Screen". It opens full
  screen (standalone) with its own icon.
- Hosted on GitHub Pages from a public repo. If Jake prefers not to use
  GitHub, the fallback is Netlify Drop (drag the folder onto their site).
  Either way the result is one https link.
- Works offline after the first load, via a service worker that caches all
  game files.

## Folder layout

```
KIDS GAMES/
  index.html                 launcher: big tiles, one per game
  nail-salon/
    index.html               the game shell
    style.css
    game.js                  all game logic
    sw.js                    offline cache
    manifest.webmanifest     name, icon, standalone display
    icon-192.png, icon-512.png, apple-touch-icon.png
  docs/superpowers/specs/    design docs
  tests/                     Playwright tests
```

Each game lives entirely in its own subfolder and registers its own service
worker scoped to that subfolder. The launcher is a plain page with one tile
per game (emoji icon plus name).

## Screens

All screens are portrait, full width, big touch targets (minimum 64 px),
no text the child must read to proceed. Icons carry meaning; short labels
are decorative.

### 1. Shape picker

- Five tiles, each showing a hand with one nail shape: round, square,
  oval, almond, pointed (stiletto).
- A row of four skin-tone swatches above the tiles. Default is the second
  from lightest. Tapping a swatch redraws the sample hands.
- Tapping a tile goes to the salon.

### 2. Salon

- A single left hand fills most of the screen, nails already drawn in the
  chosen shape on the chosen skin tone. Nails have a natural pale base and
  a subtle static shine highlight drawn on top of everything.
- Right edge: a vertical palette of 12 color swatches. The selected swatch
  is larger with a white ring.
- Bottom: tool row with five buttons: Brush, Glitter, Stickers, Clear nail,
  Done (checkmark).
- Top left: Home (back to shape picker). Top right: mute toggle.
- Stickers button opens a tray above the tool row with eight stickers.
  Tapping a sticker selects it and closes the tray; the Stickers button
  shows the selected sticker.

### 3. Celebration

- The hand stays visible. Confetti and sparkles animate over it for about
  three seconds with a chime.
- Two big buttons: Photo and New hand.
- Photo hands a PNG of the finished hand (with a small caption in a corner,
  see Config) to the iPhone share sheet, where "Save Image" puts it in
  Photos. If the share sheet is unavailable, the image is shown full screen
  with a press-and-hold-to-save hint icon.
- New hand returns to the shape picker.

## Painting mechanics

- Each nail is a closed path. Each nail owns an offscreen canvas the size of
  its bounding box. All paint, glitter, and stickers for that nail are drawn
  onto that offscreen canvas with the nail path set as a clip.
- A drag that starts inside nail N paints only nail N for the duration of
  that drag, even if the finger wanders outside or over another nail. A drag
  that starts outside every nail does nothing.
- Brush: round, soft-edged, width about one third of the nail width. Strokes
  are drawn as a series of circles between successive touch points so fast
  swipes have no gaps. Color is the selected swatch at full opacity.
- Glitter: on drag, sprinkles small dots (2 to 5 px) in the selected color,
  white, and gold, randomly within the brush radius. Same clipping.
- Stickers: a tap places one sticker centered at the tap point on that nail,
  sized to about 45 percent of nail width, clipped to the nail. Stickers are
  emoji rendered as text. Set: heart, star, flower, gem, butterfly, rainbow,
  sun, dot (a solid circle in the selected color).
- Clear nail: shows a brief "tap a nail" pulse; the next tap on a nail wipes
  that nail's offscreen canvas back to the base. Tapping anywhere else
  cancels.
- Done: goes to the celebration regardless of how many nails are painted.
- Redraw: the main canvas is redrawn each frame that something changed:
  hand, then each nail base, then each nail's offscreen canvas, then shine.

## Sound

- Synthesized with the Web Audio API; no audio files.
- Sounds: soft pop on any button, short sparkle tinkle while glittering,
  three-note chime on Done.
- The audio context is created on the first touch, as iOS requires.
- Mute toggle in the salon persists in localStorage.

## Kid-proofing

- Viewport locked (no user zoom); pinch and double-tap zoom prevented.
- Pull-to-refresh and overscroll disabled.
- Long-press callouts and text selection disabled.
- No external links anywhere in the game or launcher.
- Standalone display mode so there is no address bar to tap.
- No network calls after load. Nothing is collected or sent.

## Config

A small block of constants at the top of game.js that a parent can edit
without touching logic:

- CAPTION: text drawn in the photo corner. Default "Nail Salon".
- PALETTE: the 12 swatch colors.
- STICKERS: the emoji list.
- SKIN_TONES: the four hand colors.

## Error handling

- If the share sheet rejects or is unsupported, fall back to showing the
  image full screen (see Celebration).
- If the service worker fails to register, the game still runs online; no
  message is shown to the child.
- If the audio context fails, the game runs silent.
- Nothing in the game throws to the user. Any caught error is logged to the
  console only.

## Testing

- Playwright runs the game in a phone-sized viewport (iPhone 15 profile)
  with touch emulation.
- Tests:
  - Dragging inside a nail changes pixels inside that nail and none outside it.
  - A drag that starts outside every nail changes no pixels.
  - A drag that starts in nail 1 and crosses into nail 2 changes nothing in
    nail 2.
  - Placing a sticker near a nail edge leaves no pixels outside the nail.
  - Clear nail restores that nail to its base pixels and leaves others alone.
  - Every button's bounding box is at least 64 by 64 px.
  - Done shows the celebration; Photo produces a PNG blob of the expected size.
  - The launcher lists the nail salon tile and it links to the game.
- Geometry helpers (point-in-path per nail, stroke interpolation) are pure
  functions tested directly in Node.
- Final check is manual on the real phone: install to home screen, paint,
  save a photo, then turn on airplane mode and reopen.

## Out of scope for this game

- In-game gallery of past hands.
- Multiple hands or feet.
- Brush size choice, undo history, ombre or pattern brushes.
- Any login, sync, or cloud storage.
