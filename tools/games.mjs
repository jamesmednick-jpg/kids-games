// Shared knowledge about the games in this repo, so the tools do not each
// hard-code one game's folder name.
export const GAMES = ['nail-salon', 'number-buddies'];

// Service workers serve the cached copy until the cache name changes, so a
// publish that skips this is an update nobody ever sees.
export function bumpCache(source, game) {
  const re = new RegExp(`const CACHE = '${game}-v(\\d+)'`);
  const match = source.match(re);
  if (!match) throw new Error(`Could not find the cache name for ${game}.`);
  const version = Number(match[1]) + 1;
  return { text: source.replace(match[0], `const CACHE = '${game}-v${version}'`), version };
}
