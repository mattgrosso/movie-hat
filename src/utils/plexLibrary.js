// "Already on Plex" (report of 2026-10-14, Matt: "one of the possible places
// that it could already be is on my Plex server … include it as a first
// option if it's already there"). The browser can't see the Plex server, so
// the Mac mini service — the same one that answers `requests` — writes what
// is in the library to this project's database:
//
//   plexLibrary: {
//     movies: { <tmdbId>: true, … },   every movie Plex has, by TMDb id
//     updatedAt: number                ms, when the list was last written
//   }
//
// It rewrites the list every few minutes with the Admin SDK; the rules let
// nobody else write it, and let the same people who may request read it —
// Plex is only somewhere to watch for them. See README.md, "On Plex".
//
// Until that list exists (or for a movie that landed since its last write) a
// request the service has finished already says the movie is there, so that
// counts too.
import { isReadyToWatch, isValidTmdbId, requestPath } from './requestMovie.js';

export const PLEX_LIBRARY_PATH = 'plexLibrary';
export const plexLibraryPath = (tmdbId) => `${PLEX_LIBRARY_PATH}/movies/${tmdbId}`;

/** Is this movie on the Plex server, going by the list and its request row? */
export function isOnPlex ({ listed, row } = {}) {
  return listed === true || isReadyToWatch(row);
}

/**
 * Look one movie up. `row` is the movie's `requests` row when the caller
 * read the whole node already (null for "none"); leave it undefined and it
 * is read here. A failed read of either half just counts as "not there".
 */
export async function lookUpOnPlex (read, tmdbId, row) {
  if (!isValidTmdbId(Number(tmdbId))) return false;
  const quietly = (path) => read(path).catch(() => null);
  const [listed, requestRow] = await Promise.all([
    quietly(plexLibraryPath(tmdbId)),
    row === undefined ? quietly(requestPath(tmdbId)) : row
  ]);
  return isOnPlex({ listed, row: requestRow });
}
