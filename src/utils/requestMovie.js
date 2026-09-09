// "Request this movie" — asking the Mac mini to add a movie to Radarr.
//
// A button beside a movie writes ONE row to Movie Hat's database:
//
//   requests/<tmdbId>: {
//     tmdbId, title, status: 'pending', source, requestedBy, createdAt
//   }
//
// A Node service on Matt's Mac mini (not in this repo — see README.md,
// "Movie requests") watches that node with the Admin SDK, hands the movie to
// Radarr, and moves `status` through 'processing' to one of 'added',
// 'exists' or 'error'. The client only ever writes 'pending'; the rules
// refuse anything else, and refuse touching a row that is already in flight.
//
// The row is keyed by TMDb id, which is the whole duplicate-prevention
// story: two people requesting the same movie collide on the same key, the
// second write is refused by the rules, and both see the one row's status.
// Only a row that ended in 'error' may be written over — that is the retry.
//
// SHARED WITH CINEMA ROLL. Cinema Roll already signs into Movie Hat's
// Firebase project (its movieHatAuth.js) to send movies to hats, so it will
// write to this same node and the Mac mini watches one place. To keep this
// file byte-identical in both repos it never imports a data layer: the
// caller hands in `read(path)` / `write(path, value)` — Movie Hat's dbGet /
// dbPut, Cinema Roll's hatRequest — and says which app it is.
//
// Status changes reach the button by short polling over REST rather than a
// live listener: this app talks to the database with fetch only, and the
// realtime SDK would be a hundred kilobytes of bundle for a row that
// changes twice.
import { ref, computed } from 'vue';

export const REQUEST_SOURCES = ['movie-hat', 'cinema-roll'];
export const REQUEST_STATUSES = ['pending', 'processing', 'added', 'exists', 'error'];
// Nothing further will happen to these; polling stops.
export const TERMINAL_STATUSES = ['added', 'exists', 'error'];

export const POLL_INTERVAL_MS = 2500;
// If the Mac mini is asleep the row can sit pending indefinitely; the button
// keeps saying "Requested" and the next visit polls afresh.
export const POLL_TIMEOUT_MS = 3 * 60 * 1000;

export const requestPath = (tmdbId) => `requests/${tmdbId}`;

/** A TMDb id is a positive integer. Anything else is not a request. */
export function isValidTmdbId (tmdbId) {
  return Number.isInteger(tmdbId) && tmdbId > 0;
}

/**
 * The row the client writes. Pure: the tests pin the contract the rules
 * and the Mac mini service both depend on.
 *
 * `createdAt` is Firebase's server-timestamp sentinel, which the database
 * replaces with its own clock — so the rules can insist it is a number and
 * the service can trust the ordering.
 */
export function buildRequest ({ tmdbId, title, source, email }) {
  if (!isValidTmdbId(tmdbId)) throw new Error(`Not a TMDb id: ${tmdbId}`);
  if (!REQUEST_SOURCES.includes(source)) throw new Error(`Unknown request source: ${source}`);
  if (typeof email !== 'string' || !email) throw new Error('A request needs a signed-in email');

  return {
    tmdbId,
    title: String(title || '').slice(0, 300),
    status: 'pending',
    source,
    requestedBy: email,
    createdAt: { '.sv': 'timestamp' }
  };
}

/** May the client write a row over this one? Only nothing, or a failure. */
export function canRequestOver (existing) {
  return !existing || existing.status === 'error';
}

/** Button text for a row's state. `null` row → the idle call to action. */
export function requestLabel (row, { requesting = false } = {}) {
  if (requesting) return 'Requesting…';
  switch (row?.status) {
    case 'pending': return 'Requested';
    case 'processing': return 'Adding…';
    case 'added': return 'Added to library';
    case 'exists': return 'Already in library';
    case 'error': return 'Couldn’t add — try again';
    default: return 'Request this movie';
  }
}

/**
 * useRequestMovie({ read, write, source, email })
 *
 *   read(path)         → the value at `path`, or null
 *   write(path, value) → PUT `value` at `path`
 *   source             → 'movie-hat' | 'cinema-roll'
 *   email              → the signed-in address (a string, or a ref/getter)
 *
 * Returns refs: `row` (the database row, or null), `requesting` (a write is
 * in flight), `error` (a human-readable failure, or null), `label` (button
 * text), `settled` (nothing more will happen), and:
 *
 *   load(tmdbId)                → read the row once; keep polling if it is
 *                                 still in flight
 *   request({ tmdbId, title }) → write 'pending', then poll for the outcome
 *   stop()                     → end polling (call on unmount)
 */
export function useRequestMovie ({ read, write, source, email, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const row = ref(null);
  const requesting = ref(false);
  const error = ref(null);

  let timer = null;
  let watching = null; // the tmdbId being polled, so a stale tick can't land

  const label = computed(() => requestLabel(row.value, { requesting: requesting.value }));
  const settled = computed(() => TERMINAL_STATUSES.includes(row.value?.status));
  const canRequest = computed(() => !requesting.value && canRequestOver(row.value));

  const currentEmail = () => {
    const value = typeof email === 'function' ? email() : (email?.value ?? email);
    return typeof value === 'string' ? value : null;
  };

  function stop () {
    if (timer) clearTimer(timer);
    timer = null;
    watching = null;
  }

  function schedule (tmdbId, startedAt) {
    timer = setTimer(async () => {
      timer = null;
      if (watching !== tmdbId) return;
      try {
        row.value = await read(requestPath(tmdbId));
      } catch (readError) {
        // A blip mid-poll is not worth alarming anyone over; try again.
        console.warn('Could not check on the movie request', readError);
      }
      if (watching !== tmdbId) return;
      const done = TERMINAL_STATUSES.includes(row.value?.status);
      const timedOut = now() - startedAt >= POLL_TIMEOUT_MS;
      if (done || timedOut) {
        stop();
      } else {
        schedule(tmdbId, startedAt);
      }
    }, POLL_INTERVAL_MS);
  }

  function watch (tmdbId) {
    stop();
    watching = tmdbId;
    schedule(tmdbId, now());
  }

  async function load (tmdbId) {
    stop();
    error.value = null;
    if (!isValidTmdbId(tmdbId)) {
      row.value = null;
      return null;
    }
    try {
      row.value = await read(requestPath(tmdbId));
    } catch (readError) {
      // Not signed in, or offline: the button simply has no history to
      // show. It still works if tapped — the write reports its own failure.
      console.warn('Could not read the movie request', readError);
      row.value = null;
    }
    if (row.value && !TERMINAL_STATUSES.includes(row.value.status)) watch(tmdbId);
    return row.value;
  }

  async function request ({ tmdbId, title }) {
    if (requesting.value) return;
    error.value = null;

    let payload;
    try {
      payload = buildRequest({ tmdbId, title, source, email: currentEmail() });
    } catch (buildError) {
      error.value = buildError.message;
      return;
    }

    requesting.value = true;
    stop();
    try {
      await write(requestPath(tmdbId), payload);
      // Show 'pending' at once; the first poll replaces the sentinel with
      // the row the database actually holds.
      row.value = { ...payload, createdAt: now() };
      watch(tmdbId);
    } catch (writeError) {
      // A refusal here is almost always the duplicate case: somebody got
      // there first between our read and our write. Re-read so the button
      // shows THEIR request rather than an error.
      const refused = writeError?.status === 401 || writeError?.status === 403;
      if (refused) {
        await load(tmdbId);
        if (!row.value) error.value = 'Movie Hat wouldn’t take the request — are you signed in?';
      } else {
        console.error('The movie request didn’t save', writeError);
        error.value = 'The request didn’t go through. Please try again.';
      }
    } finally {
      requesting.value = false;
    }
  }

  return { row, requesting, error, label, settled, canRequest, load, request, stop };
}
