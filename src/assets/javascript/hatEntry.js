// What a movie looks like once it is IN a hat, and the local bookkeeping
// that saves re-reading the whole hat after every add or draw.
//
// Why (2026-10-13): Sentry flagged the home page's hat read as a large
// payload. That read is every movie in the hat plus its entire history, and
// each entry carried the search screen's streaming list (up to ten provider
// records with logos) and two sort-only numbers, none of which anything
// shows once the movie is saved: Where to Watch looks providers up live.
// Cinema Roll writes the same slim shape (its toHatMovie) and reads only
// title, poster_path, id, addedBy, note and dateDrawn, so dropping these is
// invisible to it.
//
// Entries saved before this were slimmed in place by
// scripts/slim-hat-entries.mjs (the home page read stayed large without it).
//
// 2026-10-14: Sentry reopened it — the biggest hat was still ~444 KB, over
// its ~300 KB line. The plot summary and background-image path were most of
// what was left, and nothing shows either from a hat: Movie Hat never renders
// them, and Cinema Roll's preview fetches its own overview from TMDB. Cinema
// Roll's toHatMovie stopped writing them the same day.

// Never shown once a movie is in a hat.
export const SEARCH_ONLY = ['streamers', 'popularity', 'vote_count', 'overview', 'backdrop_path'];

/** A movie (a search choice or a hat entry) → what the database keeps. */
export function slimHatMovie (movie) {
  const slim = { ...movie };
  for (const field of SEARCH_ONLY) delete slim[field];
  // The entry's own key is the path it lives at, never a field in it.
  delete slim.dbKey;
  return slim;
}

/** The hat after a successful add, without reading it back. */
export function hatWithAdded (movies, entry, dbKey) {
  return [...(movies || []), { ...entry, dbKey }];
}

/** Hat and history after a successful draw, without reading them back. */
export function afterDraw ({ movies, history }, drawn, historyKey, historyEntry) {
  return {
    movies: (movies || []).filter((movie) => movie.dbKey !== drawn.dbKey),
    history: [...(history || []), { ...historyEntry, dbKey: historyKey }]
  };
}
