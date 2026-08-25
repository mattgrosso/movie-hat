// Logic behind the hidden "peek in the hat" screen.
//
// The app deliberately never shows what is still IN a hat — you draw blind,
// which is the whole conceit. This screen is the one exception: a private way
// to look inside a hat and take a movie back out.
//
// WHAT THE GATE IS AND IS NOT. isOwner() runs in the browser, in a bundle
// anybody can read, so it is NOT a security boundary — someone determined
// could reach the screen without it. It does not need to be a security
// boundary: the database rules already refuse any hat you are not a member of,
// so the worst anybody can do by getting past this is spoil their own hat.
// The gate's job is to keep a spoiler tool from being stumbled into, nothing
// more. Do not let anything sensitive come to depend on it.
export const OWNER_EMAIL = 'mattgrosso@gmail.com';

export function isOwner (email) {
  return typeof email === 'string' && email.trim().toLowerCase() === OWNER_EMAIL;
}

/** The year a movie came out, or '' when the date is missing or unparseable. */
export function movieYear (movie) {
  const year = String(movie?.release_date || '').slice(0, 4);
  return /^\d{4}$/.test(year) ? year : '';
}

// Sorting by title puts "The Conversation" under C, the way a shelf does.
// Without this, a third of any hat lands under T.
const LEADING_ARTICLE = /^(the|a|an)\s+/i;

export function titleSortKey (movie) {
  return String(movie?.title || '').replace(LEADING_ARTICLE, '').trim().toLowerCase();
}

/**
 * Movies whose title, note or adder matches `query`.
 *
 * A blank query matches everything — this screen's list is long (hundreds of
 * movies in a well-fed hat), so the search box is how you find one, not a
 * filter you opt into.
 */
export function filterMovies (movies, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [...(movies || [])];

  return (movies || []).filter((movie) => {
    const haystack = [movie?.title, movie?.note, movie?.addedBy]
      .filter((part) => typeof part === 'string')
      .join(' ')
      .toLowerCase();

    return haystack.includes(needle);
  });
}

/**
 * `sort` is 'title' (A–Z, articles ignored) or 'added' (most recent first).
 *
 * Returns a NEW array; the caller's list is left alone.
 */
export function sortMovies (movies, sort = 'title') {
  const list = [...(movies || [])];

  if (sort === 'added') {
    // Undated entries sort last rather than jumping to the top, which is what
    // a missing timeStamp would otherwise do against a real one.
    return list.sort((a, b) => (Number(b?.timeStamp) || 0) - (Number(a?.timeStamp) || 0));
  }

  return list.sort((a, b) => titleSortKey(a).localeCompare(titleSortKey(b)));
}

/** Search and sort in one step — what the screen actually renders. */
export function visibleMovies (movies, { query = '', sort = 'title' } = {}) {
  return sortMovies(filterMovies(movies, query), sort);
}
