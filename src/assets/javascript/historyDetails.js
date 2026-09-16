// What the little "i" on a drawn movie's poster reveals (bug report,
// 2026-09-13: "a button I could tap, something small and subtle for each
// poster on the home screen, that would show me the details of when it was
// added to the hat exactly, then by whom, and whatever other information we
// have").
//
// Everything here is already on the history record — `timeStamp` is written
// when a movie goes INTO the hat (PickAMovie), `dateDrawn` when it comes
// out (DrawMovie) — it just never had anywhere to show. Label/value rows
// since 2026-09-16 ("the style of that whole open panel should be a little
// nicer"), so the panel can set them in two columns; both halves are plain
// text and the component never renders them as markup.

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
 * @returns {Array<{ label: string, value: string }>}  one fact per row, most interesting first
 */
export const historyDetailRows = (movie, { rank } = {}) => {
  const rows = [];
  if (!movie) return rows;

  const added = asDate(movie.timeStamp);
  const drawn = asDate(movie.dateDrawn);

  if (movie.addedBy && added) rows.push({ label: 'Added', value: `by ${movie.addedBy}, ${formatWhen(added)}` });
  else if (movie.addedBy) rows.push({ label: 'Added', value: `by ${movie.addedBy}` });
  else if (added) rows.push({ label: 'Added', value: formatWhen(added) });

  if (drawn) {
    rows.push({ label: 'Drawn', value: `${formatWhen(drawn)}${rank ? ` · ${rank} draw` : ''}` });
  } else if (rank) {
    rows.push({ label: 'Drawn', value: `${rank} draw` });
  }

  if (added && drawn) {
    rows.push({ label: 'In the hat', value: plural(daysBetween(added, drawn), 'day') });
  }

  if (movie.note) rows.push({ label: 'Note', value: String(movie.note) });

  if (movie.release_date) {
    const released = asDate(movie.release_date);
    rows.push({
      label: 'Released',
      value: released
        ? released.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        : String(movie.release_date)
    });
  }

  if (Number.isFinite(Number(movie.vote_average)) && Number(movie.vote_average) > 0) {
    rows.push({ label: 'TMDB', value: `${Number(movie.vote_average).toFixed(1)} / 10` });
  }

  return rows;
};
