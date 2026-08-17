// Movie Hat Wrapped — a year in the hat, computed entirely from data the
// app already has. No new writes, no new database shape: history entries
// carry `dateDrawn`, `timeStamp` (when the movie went IN), `addedBy`, and
// the TMDB fields, which turns out to be enough for a whole year in review.
//
// Everything here is pure so it can be tested without a browser or a
// database, and so the page itself stays a dumb renderer.

const DAY = 24 * 60 * 60 * 1000;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Is it Wrapped season? December, plus January for anyone who missed it —
 * "something that would show up at the end of the year" (Matt, 2026-08-17).
 * The page itself is always reachable directly; this only governs whether
 * the app volunteers it.
 */
export function isWrappedSeason (now = new Date()) {
  const month = now.getMonth();
  return month === 11 || month === 0;
}

/**
 * The year Wrapped should show right now: December shows the year that is
 * ending; January still shows the year just gone.
 */
export function wrappedYear (now = new Date()) {
  return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
}

const yearOf = (timestamp) => (timestamp ? new Date(timestamp).getFullYear() : null);

/** Whole days between going into the hat and coming out, when both are known. */
export function waitInDays (movie) {
  if (!movie?.timeStamp || !movie?.dateDrawn) return null;
  const waited = movie.dateDrawn - movie.timeStamp;
  return waited > 0 ? Math.round(waited / DAY) : 0;
}

/** Tallies a field across entries → [{ name, count }], biggest first. */
function leaderboard (entries, field) {
  const counts = new Map();

  entries.forEach((entry) => {
    const name = (entry?.[field] || '').trim();
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * The whole report.
 *
 * @param history  drawn movies (store.state.history)
 * @param inHat    movies still waiting (store.state.movieHat)
 * @param year     the year to report on
 */
export function wrappedStats (history = [], inHat = [], year = new Date().getFullYear()) {
  const drawn = (history || []).filter((movie) => yearOf(movie?.dateDrawn) === year);

  // "Added this year" spans both places: a movie added in March and drawn
  // in April is in history; one added in March and still waiting is not.
  const addedThisYear = [...(history || []), ...(inHat || [])]
    .filter((movie) => yearOf(movie?.timeStamp) === year);

  const byMonth = Array(12).fill(0);
  drawn.forEach((movie) => { byMonth[new Date(movie.dateDrawn).getMonth()] += 1; });

  const busiestCount = Math.max(0, ...byMonth);
  const busiestMonth = busiestCount
    ? { name: MONTHS[byMonth.indexOf(busiestCount)], count: busiestCount }
    : null;

  const waits = drawn
    .map((movie) => ({ movie, days: waitInDays(movie) }))
    .filter((entry) => entry.days !== null);
  const longestWait = waits.length
    ? waits.reduce((longest, entry) => (entry.days > longest.days ? entry : longest))
    : null;

  const releaseYears = drawn
    .map((movie) => Number(String(movie?.release_date || '').slice(0, 4)))
    .filter((releaseYear) => Number.isFinite(releaseYear) && releaseYear > 1880);

  const withRelease = drawn.filter((movie) => String(movie?.release_date || '').length >= 4);
  const sortedByRelease = [...withRelease].sort((a, b) =>
    String(a.release_date).localeCompare(String(b.release_date)));

  // The one still waiting that has waited longest — the hat's patient soul.
  const waitingSince = (inHat || [])
    .filter((movie) => movie?.timeStamp)
    .sort((a, b) => a.timeStamp - b.timeStamp)[0] || null;

  return {
    year,
    drawnCount: drawn.length,
    addedCount: addedThisYear.length,
    stillWaiting: (inHat || []).length,
    addedBy: leaderboard(drawn, 'addedBy'),
    addedByThisYear: leaderboard(addedThisYear, 'addedBy'),
    byMonth,
    busiestMonth,
    longestWait,
    averageWaitDays: waits.length
      ? Math.round(waits.reduce((total, entry) => total + entry.days, 0) / waits.length)
      : null,
    averageReleaseYear: releaseYears.length
      ? Math.round(releaseYears.reduce((total, value) => total + value, 0) / releaseYears.length)
      : null,
    oldestFilm: sortedByRelease[0] || null,
    newestFilm: sortedByRelease[sortedByRelease.length - 1] || null,
    longestWaiting: waitingSince,
    notes: drawn.filter((movie) => movie?.note).length,
    hasData: drawn.length > 0 || addedThisYear.length > 0
  };
}

export { MONTHS };
