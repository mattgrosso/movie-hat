// The arithmetic behind the charts, kept out of the component so it can be
// tested without a canvas.
//
// Everything is derived from what a hat already stores: movies waiting
// (`timeStamp`, `release_date`, `addedBy`) and movies drawn (the same, plus
// `dateDrawn`).

const DAY = 24 * 60 * 60 * 1000;

/** `2026-03` for a timestamp — sorts chronologically as a string. */
export function monthKey (timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** '2026-03' → 'Mar 26', for an axis that has to fit on a phone. */
export function monthLabel (key) {
  const [year, month] = key.split('-');
  const name = new Date(Number(year), Number(month) - 1, 1)
    .toLocaleString('en-US', { month: 'short' });
  return `${name} ${year.slice(2)}`;
}

/**
 * How many movies were in the hat at the end of each month, ever.
 *
 * Adds land on the month a movie went in; draws subtract on the month it
 * came out. Months with no activity still appear, so a flat stretch reads
 * as flat rather than as a missing gap.
 */
export function hatSizeOverTime (inHat = [], history = []) {
  const changes = new Map();
  const bump = (timestamp, delta) => {
    if (!timestamp) return;
    const key = monthKey(timestamp);
    changes.set(key, (changes.get(key) || 0) + delta);
  };

  [...(inHat || []), ...(history || [])].forEach((movie) => bump(movie?.timeStamp, 1));
  (history || []).forEach((movie) => bump(movie?.dateDrawn, -1));

  const keys = [...changes.keys()].sort();
  if (!keys.length) return { labels: [], values: [] };

  // Fill the calendar between first and last, so the line's slope is honest.
  const labels = [];
  const [firstYear, firstMonth] = keys[0].split('-').map(Number);
  const [lastYear, lastMonth] = keys[keys.length - 1].split('-').map(Number);
  const cursor = new Date(firstYear, firstMonth - 1, 1);
  const end = new Date(lastYear, lastMonth - 1, 1);

  while (cursor <= end) {
    labels.push(monthKey(cursor.getTime()));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  let running = 0;
  const values = labels.map((key) => {
    running += changes.get(key) || 0;
    return running;
  });

  return { labels, values };
}

/** Movies added and movies drawn, per calendar year. */
export function inAndOutByYear (inHat = [], history = []) {
  const added = new Map();
  const drawn = new Map();
  const note = (map, timestamp) => {
    if (!timestamp) return;
    const year = new Date(timestamp).getFullYear();
    map.set(year, (map.get(year) || 0) + 1);
  };

  [...(inHat || []), ...(history || [])].forEach((movie) => note(added, movie?.timeStamp));
  (history || []).forEach((movie) => note(drawn, movie?.dateDrawn));

  const years = [...new Set([...added.keys(), ...drawn.keys()])].sort((a, b) => a - b);

  return {
    labels: years.map(String),
    added: years.map((year) => added.get(year) || 0),
    drawn: years.map((year) => drawn.get(year) || 0)
  };
}

/**
 * Every movie the hat has ever held, by the decade it was released — the
 * closest thing the data has to a picture of taste.
 */
export function byReleaseDecade (inHat = [], history = []) {
  const counts = new Map();

  [...(inHat || []), ...(history || [])].forEach((movie) => {
    const year = Number(String(movie?.release_date || '').slice(0, 4));
    if (!Number.isFinite(year) || year < 1880) return;
    const decade = Math.floor(year / 10) * 10;
    counts.set(decade, (counts.get(decade) || 0) + 1);
  });

  const decades = [...counts.keys()].sort((a, b) => a - b);

  return {
    labels: decades.map((decade) => `${String(decade).slice(2)}s`),
    values: decades.map((decade) => counts.get(decade))
  };
}

// How long movies sat in the hat before being drawn. Buckets rather than a
// raw histogram: "about a month" is the answer people want, not "31 days".
const WAIT_BUCKETS = [
  { label: '< 1 wk', max: 7 },
  { label: '< 1 mo', max: 30 },
  { label: '1-3 mo', max: 91 },
  { label: '3-6 mo', max: 183 },
  { label: '6-12 mo', max: 365 },
  { label: '1-2 yr', max: 730 },
  { label: '2 yr+', max: Infinity }
];

export function waitTimes (history = []) {
  const values = WAIT_BUCKETS.map(() => 0);

  (history || []).forEach((movie) => {
    if (!movie?.timeStamp || !movie?.dateDrawn) return;
    const days = Math.max(0, (movie.dateDrawn - movie.timeStamp) / DAY);
    const index = WAIT_BUCKETS.findIndex((bucket) => days <= bucket.max);
    values[index === -1 ? WAIT_BUCKETS.length - 1 : index] += 1;
  });

  return { labels: WAIT_BUCKETS.map((bucket) => bucket.label), values };
}

/**
 * Who put movies in — counting everything, waiting or drawn. Capped at the
 * top few with the rest folded into "Others", because a bar per person
 * stops being readable well before it stops being possible.
 */
export function byContributor (inHat = [], history = [], limit = 6) {
  const counts = new Map();

  [...(inHat || []), ...(history || [])].forEach((movie) => {
    const name = String(movie?.addedBy || '').trim();
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked.slice(0, limit);
  const rest = ranked.slice(limit);

  if (rest.length) {
    top.push(['Others', rest.reduce((total, [, count]) => total + count, 0)]);
  }

  return {
    labels: top.map(([name]) => name),
    values: top.map(([, count]) => count)
  };
}

/** How long the movies STILL waiting have been waiting. */
export function agesInHat (inHat = [], now = Date.now()) {
  const values = WAIT_BUCKETS.map(() => 0);

  (inHat || []).forEach((movie) => {
    if (!movie?.timeStamp) return;
    const days = Math.max(0, (now - movie.timeStamp) / DAY);
    const index = WAIT_BUCKETS.findIndex((bucket) => days <= bucket.max);
    values[index === -1 ? WAIT_BUCKETS.length - 1 : index] += 1;
  });

  return { labels: WAIT_BUCKETS.map((bucket) => bucket.label), values };
}

export { WAIT_BUCKETS };
