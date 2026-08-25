// Magic Mirror feed.
//
// Matt's Magic Mirror (a hallway display, no keyboard, no login) shows the
// hat's most recent pick as a full-screen "Now Showing" poster, in the
// evening, until it has been rated in Cinema Roll. It used to get that by
// reading the hat over unauthenticated REST:
//
//   GET .../hats/The%20Movie%20Hat/-NP5dbtXUMBZpHth_2BG.json
//
// The membership rules ended that — correctly; that read handed the whole
// hat, its history and its members' email keys to anyone with the URL. The
// mirror went quiet, and silently: its fetch returns null on failure, so the
// panel simply never appeared.
//
// Rather than reopening a hat, Movie Hat PUBLISHES the one movie the mirror
// renders to mirrorFeed/<title>/<hatKey>/<secret>, which the rules make
// world-readable at the SECRET level only. No credentials live on the mirror.
//
// Third app to need this: Cinema Roll (2026-08-14) and Meal Hat (2026-08-19)
// broke the same way and are fixed the same way.

/**
 * Build the mirror's payload from a hat's history.
 *
 * `history` is the array the store holds (or the keyed object the database
 * stores); entries carry `dateDrawn`, `id`, `title` and `poster_path`.
 *
 * Shape published:
 *   {
 *     updatedAt,
 *     currentPick: { id, title, poster_path, dateDrawn } | null
 *   }
 *
 * Only the latest pick, because that is all the mirror shows. The rest of the
 * history is nobody else's business, and this feed is public to anyone holding
 * the URL.
 */
export function buildMirrorFeed (history, { now = Date.now() } = {}) {
  const drawn = Object.values(history || {})
    .filter((movie) => movie && Number.isFinite(movie.dateDrawn) && movie.id != null)
    // A pick with no poster is worse than no pick at all: the mirror builds an
    // image URL from poster_path unconditionally and gives the whole screen to
    // the result, so a missing path shows a full-screen broken image where the
    // clock used to be.
    .filter((movie) => typeof movie.poster_path === 'string' && movie.poster_path);

  if (!drawn.length) return { updatedAt: now, currentPick: null };

  const latest = drawn.reduce((best, movie) => (movie.dateDrawn > best.dateDrawn ? movie : best));

  return {
    updatedAt: now,
    currentPick: {
      id: latest.id,
      title: latest.title || '',
      poster_path: latest.poster_path,
      dateDrawn: latest.dateDrawn
    }
  };
}
