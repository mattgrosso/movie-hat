// What the little "i" on a drawn movie's poster reveals (bug report,
// 2026-09-13: "a button I could tap, something small and subtle for each
// poster on the home screen, that would show me the details of when it was
// added to the hat exactly, then by whom, and whatever other information we
// have").
//
// Everything here is already on the history record — `timeStamp` is written
// when a movie goes INTO the hat (PickAMovie), `dateDrawn` when it comes
// out (DrawMovie) — it just never had anywhere to show. Plain lines, so the
// component renders them as text and never as markup.

const DAY_MS = 24 * 60 * 60 * 1000;

const asDate = (value) => {
  if (value == null || value === '') return null;
  const date = new Date(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatWhen = (value) => {
  const date = asDate(value);
  if (!date) return null;
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

const daysBetween = (from, to) => Math.max(0, Math.round((to - from) / DAY_MS));

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * @param {object} movie   a history record
 * @param {{ rank?: string }} options  the draw's ordinal ("3rd"), if known
 * @returns {string[]}  one fact per line, most interesting first
 */
export const historyDetailLines = (movie, { rank } = {}) => {
  const lines = [];
  if (!movie) return lines;

  const added = asDate(movie.timeStamp);
  const drawn = asDate(movie.dateDrawn);

  if (movie.addedBy && added) lines.push(`Added by ${movie.addedBy} on ${formatWhen(added)}`);
  else if (movie.addedBy) lines.push(`Added by ${movie.addedBy}`);
  else if (added) lines.push(`Added ${formatWhen(added)}`);

  if (drawn) {
    lines.push(`Drawn ${formatWhen(drawn)}${rank ? ` · ${rank} draw` : ''}`);
  } else if (rank) {
    lines.push(`${rank} draw`);
  }

  if (added && drawn) {
    lines.push(`Waited in the hat ${plural(daysBetween(added, drawn), 'day')}`);
  }

  if (movie.note) lines.push(`Note: ${movie.note}`);

  if (movie.release_date) {
    const released = asDate(movie.release_date);
    lines.push(released
      ? `Released ${released.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
      : `Released ${movie.release_date}`);
  }

  if (Number.isFinite(Number(movie.vote_average)) && Number(movie.vote_average) > 0) {
    lines.push(`TMDB rating ${Number(movie.vote_average).toFixed(1)}`);
  }

  return lines;
};
