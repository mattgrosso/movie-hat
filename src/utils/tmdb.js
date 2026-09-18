// Finding the movie. TMDb's search, and just enough of a result to decide
// you have the right film: poster, year, and the one-line overview.
//
// SHARED, BYTE-IDENTICAL, between movie-hat and movie-requests. Change one,
// copy it to the other, run both test suites.
//
// Movie Hat has its own older TMDb search in AddMovie.vue, which puts a film
// INTO a hat. This one is for the request screen, which does not touch hats
// at all. They are deliberately not merged: AddMovie's also fetches
// streaming providers and builds a hat entry, and folding two jobs into one
// search is how a small module stops being obvious.
//
// The api_key rides in the query string, as it does in Movie Hat. It is a
// read-only TMDb key and the bundle is public either way — nothing here is
// a secret, and putting a proxy in front of a search endpoint would buy
// nothing but a Lambda to keep alive.
const API = 'https://api.themoviedb.org/3';
const IMAGE = 'https://image.tmdb.org/t/p';

export const posterUrl = (path, size = 'w342') => (path ? `${IMAGE}/${size}${path}` : null);

export const releaseYear = (movie) => {
  const date = movie?.release_date;
  return date && date.length >= 4 ? date.slice(0, 4) : null;
};

/**
 * One search result, pared to what the card shows. Keeping this a pure
 * function is what lets the tests pin the shape without touching the network.
 */
export function toResult (movie) {
  return {
    id: movie.id,
    title: movie.title || movie.original_title || 'Untitled',
    year: releaseYear(movie),
    overview: movie.overview || '',
    poster: posterUrl(movie.poster_path),
    // Popularity is the tie-breaker below; kept so the card can show nothing
    // and the sort can still use it.
    popularity: Number(movie.popularity) || 0,
    votes: Number(movie.vote_count) || 0
  };
}

/**
 * TMDb's own relevance order is mostly right, but it will put an obscure
 * short with a matching title above the film everyone means. An exact
 * title match wins; after that, TMDb's order stands.
 *
 * Results with no release date at all are pushed down rather than dropped:
 * an unreleased film is exactly the kind of thing somebody asks for early,
 * but it shouldn't outrank one you can actually watch tonight.
 */
export function rankResults (results, query) {
  const wanted = String(query || '').trim().toLowerCase();
  return [...results]
    .map((movie, index) => ({ movie, index }))
    .sort((a, b) => {
      const exact = (entry) => (entry.movie.title.toLowerCase() === wanted ? 0 : 1);
      const dated = (entry) => (entry.movie.year ? 0 : 1);
      return exact(a) - exact(b) || dated(a) - dated(b) || a.index - b.index;
    })
    .map((entry) => entry.movie);
}

/** Search TMDb. Throws a human-readable error; the caller shows it. */
export async function searchMovies (query, { signal } = {}) {
  const term = String(query || '').trim();
  if (!term) return [];

  const url = `${API}/search/movie?api_key=${process.env.VUE_APP_TMDB_API_KEY}` +
    `&language=en-US&include_adult=false&query=${encodeURIComponent(term)}`;

  let data;
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`TMDb responded ${response.status}`);
    data = await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    console.error('TMDb search failed', error);
    throw new Error('The movie search didn’t answer. Please try again.');
  }

  return rankResults((data.results || []).map(toResult), term);
}
