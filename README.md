# Kids Games

Small, ad-free web games for a phone. One folder per game, a launcher at the root.

## Play on a phone
1. Open the site link in Safari.
2. Open a game, tap Share, then "Add to Home Screen".
3. The icon on the home screen opens the game full screen and works offline.

## Games
- `nail-salon/` — tap a finger to zoom in, then paint with a little polish brush that stays inside the lines, add glitter and stickers, and save a photo at the end.
  Parent settings (caption, colors, stickers, skin tones) are at the top of `nail-salon/game.js`.
  After changing any file in the folder, bump `CACHE` in `nail-salon/sw.js` so phones pick up the update.

## Adding a game
1. Create a new folder with its own `index.html`, `manifest.webmanifest`, and `sw.js` (copy from `nail-salon/`).
2. Add a tile to the root `index.html`.

## Development
```
npm install
npx playwright install chromium
npm test          # unit + browser tests
npm run serve     # http://localhost:4173, open on a phone on the same Wi-Fi via your Mac's IP
```
