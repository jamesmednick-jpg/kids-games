// Publish the current game to GitHub Pages.
//
// Bumps the service worker's cache name first: phones that already installed
// the game keep serving the old cached copy until that name changes, so
// skipping this step means an update nobody ever sees.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const SW = ROOT + 'nail-salon/sw.js';
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const sw = await readFile(SW, 'utf8');
const match = sw.match(/const CACHE = 'nail-salon-v(\d+)'/);
if (!match) {
  console.error('Could not find the cache name in nail-salon/sw.js.');
  process.exit(1);
}
const next = Number(match[1]) + 1;
await writeFile(SW, sw.replace(match[0], `const CACHE = 'nail-salon-v${next}'`));
console.log(`cache bumped to nail-salon-v${next}`);

if (!git('status', '--porcelain')) {
  console.log('Nothing to publish.');
  process.exit(0);
}
git('add', '-A');
git('commit', '-m', process.argv[2] || `Update the nail salon (cache v${next})`);
git('push');
console.log('\nPushed. GitHub Pages rebuilds in about a minute:');
console.log('  https://jamesmednick-jpg.github.io/kids-games/nail-salon/');
console.log('\nOn her phone the new version arrives the second time she opens the game.');
