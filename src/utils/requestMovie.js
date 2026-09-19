// "Request this movie" — asking the Mac mini to add a movie to Radarr.
//
// A button beside a movie writes ONE row to Movie Hat's database:
//
//   requests/<tmdbId>: {
//     tmdbId, title, status: 'pending', source, requestedBy, createdAt,
//     force: true   // optional, Matt only - see FORCE_EMAIL below
//   }
//
// A Node service on Matt's Mac mini (not in this repo — see README.md,
// "Movie requests") watches that node with the Admin SDK, hands the movie to
// Radarr, and moves `status` through 'processing' to one of 'added',
// 'exists' or 'error'. 'added' means Radarr TOOK the request — the file is
// still on its way, and the service stamps `importedAt` when it lands (the
// push Lambda then tells the requester). The client only ever writes
// 'pending'; the rules refuse anything else, and refuse touching a row that
// is already in flight.
//
// The row is keyed by TMDb id, which is the whole duplicate-prevention
// story: two people requesting the same movie collide on the same key, the
// second write is refused by the rules, and both see the one row's status.
// Only a row that ended in 'error' may be written over — that is the retry.
//
// SHARED, BYTE-IDENTICAL, WITH movie-requests (and, when it adopts this,
// Cinema Roll). Every app that can ask for a download signs into Movie Hat's
// Firebase project and writes to this same node, so the Mac mini watches one
// place. To keep the copies identical this file never imports a data layer:
// the caller hands in `read(path)` / `write(path, value)` — Movie Hat's
// dbGet / dbPut — and says which app it is.
//
// The copies live at:
//   movie-hat/src/utils/requestMovie.js
//   movie-requests/src/utils/requestMovie.js
// Change one, copy it to the other, run both test suites.
//
// Status changes reach the button by short polling over REST rather than a
// live listener: this app talks to the database with fetch only, and the
// realtime SDK would be a hundred kilobytes of bundle for a row that
// changes twice.
import { ref, computed } from 'vue';

export const REQUEST_SOURCES = ['movie-hat', 'cinema-roll', 'movie-requests'];

// Forcing a request past the Plex hold. Normally the Mac mini waits until
// nobody is watching before it starts a download; `force: true` tells it to
// bring the VPN up and start anyway. It is Matt's alone - the database rules
// refuse the field from anybody else, and this is only the client agreeing
// with them so the option is not offered to someone who would be refused.
// The service caps how long a forced download may run (FORCE_MAX_HOURS in
// its README); nothing here needs to know that number.
export const FORCE_EMAIL = 'mattgrosso@gmail.com';

export function canForce (email) {
  return typeof email === 'string' && email.toLowerCase() === FORCE_EMAIL;
}
export const REQUEST_STATUSES = ['pending', 'processing', 'added', 'exists', 'error'];
// Nothing further will happen to these; polling stops. 'added' is NOT here:
// an added row is still downloading until it carries `importedAt`.
export const TERMINAL_STATUSES = ['exists', 'error'];

/** Has this row reached a state nothing further will change? */
export function isSettled (row) {
  if (!row) return false;
  if (row.status === 'added') return typeof row.importedAt === 'number';
  return TERMINAL_STATUSES.includes(row.status);
}

// Two speeds. The first few minutes poll quickly, because that is when the
// answer usually arrives and the person is watching the button. After that
// the row is being held on purpose — the Mac mini waits for whoever is
// watching Plex to finish before it downloads, which can be a whole film —
// so polling drops to a slow tick and carries on until the row settles.
// Nothing polls while the page is hidden; coming back to the foreground
// reads at once (see `listenForForeground`), which is how an installed PWA
// that sat in the background for an hour learns the movie was added.
export const POLL_INTERVAL_MS = 2500;
export const POLL_FAST_WINDOW_MS = 3 * 60 * 1000;
export const POLL_SLOW_INTERVAL_MS = 30 * 1000;

/**
 * Is the page in front of someone? Anything that isn't a browser (tests,
 * SSR) counts as visible so polling behaves as before.
 */
export function pageIsVisible () {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

/**
 * Call `handler` whenever the page comes back to the foreground. Returns
 * the function that stops listening.
 *
 * visibilitychange alone is unreliable on iOS, particularly for a
 * home-screen-installed PWA — it sometimes just doesn't fire when the app
 * returns. pageshow and focus are more consistent there; listening to all
 * three is the set the auto-update code settled on. The handler must
 * tolerate being called twice for one return.
 */
export function listenForForeground (handler) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  const onVisibility = () => { if (document.visibilityState === 'visible') handler(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', handler);
  window.addEventListener('focus', handler);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', handler);
    window.removeEventListener('focus', handler);
  };
}

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
export function buildRequest ({ tmdbId, title, source, email, force = false }) {
  if (!isValidTmdbId(tmdbId)) throw new Error(`Not a TMDb id: ${tmdbId}`);
  if (!REQUEST_SOURCES.includes(source)) throw new Error(`Unknown request source: ${source}`);
  if (typeof email !== 'string' || !email) throw new Error('A request needs a signed-in email');
  if (force && !canForce(email)) throw new Error('Only Matt can force a request past the Plex hold');

  const row = {
    tmdbId,
    title: String(title || '').slice(0, 300),
    status: 'pending',
    source,
    requestedBy: email,
    createdAt: { '.sv': 'timestamp' }
  };
  // Omitted rather than written false: an ordinary request is the same row
  // it has always been, which is what keeps the rules and the service able
  // to treat the field as optional.
  if (force) row.force = true;
  return row;
}

/** May the client write a row over this one? Only nothing, or a failure. */
export function canRequestOver (existing) {
  return !existing || existing.status === 'error';
}

/**
 * Button text for a row's state. `null` row → the idle call to action.
 * `short` is for a button that shares a row with others, or sits in a list.
 *
 * The wording is careful about one thing (Matt, 2026-09-12): nothing may
 * sound like the movie is ready until the file has actually landed. So an
 * 'added' row says "Downloading" until it carries `importedAt`, and only
 * then "Ready to watch". 'exists' really is already there.
 */
export function requestLabel (row, { requesting = false, short = false } = {}) {
  if (requesting) return 'Requesting…';
  switch (row?.status) {
    case 'pending':
      if (row.force) return short ? 'Forced' : 'Forced — starting now';
      return short ? 'Requested' : 'Requested — waiting to start';
    case 'processing': return short ? 'Starting…' : 'Starting the download…';
    case 'added': return isSettled(row)
      ? (short ? 'Ready' : 'Ready to watch')
      : (short ? 'Downloading' : 'Downloading — you’ll get a notification');
    case 'exists': return short ? 'In library' : 'Already in the library';
    case 'error': return short ? 'Try again' : 'Couldn’t add — try again';
    default: return short ? 'Request' : 'Request this movie';
  }
}

/**
 * A line under the button, for the states where the label alone could be
 * misread. `null` when the label says it all.
 */
export function requestNote (row) {
  switch (row?.status) {
    case 'pending': return row.force
      ? 'Forced past the Plex hold: the VPN comes up and the download starts now.'
      : 'The download starts once nobody is watching Plex. You’ll get a notification when it’s ready.';
    case 'processing': return 'You’ll get a notification when it’s ready.';
    case 'added': return isSettled(row) ? null : 'Still downloading. You’ll get a notification when it’s ready.';
    default: return null;
  }
}

/**
 * useRequestMovie({ read, write, source, email })
 *
 *   read(path)         → the value at `path`, or null
 *   write(path, value) → PUT `value` at `path`
 *   source             → 'movie-hat' | 'cinema-roll'
 *   email              → the signed-in address (a string, or a ref/getter)
 *   short              → short labels (see requestLabel)
 *
 * Returns refs: `row` (the database row, or null), `requesting` (a write is
 * in flight), `error` (a human-readable failure, or null), `label` (button
 * text), `note` (a line of explanation under it, or null), `settled`
 * (nothing more will happen), and:
 *
 *   load(tmdbId, preloaded?)   → read the row once (or take the one given);
 *                                 keep polling if it is still in flight
 *   request({ tmdbId, title }) → write 'pending', then poll for the outcome
 *   stop()                     → end polling (call on unmount)
 *
 * `now`, `setTimer`, `clearTimer`, `isVisible` and `onForeground` exist so
 * the tests can drive the clock and the page's visibility by hand.
 */
export function useRequestMovie ({ read, write, source, email, short = false, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, isVisible = pageIsVisible, onForeground = listenForForeground }) {
  const row = ref(null);
  const requesting = ref(false);
  const error = ref(null);

  let timer = null;
  let watching = null; // the tmdbId being polled, so a stale tick can't land
  let startedAt = 0; // when polling for `watching` began: picks the speed
  let checking = false; // a read is in flight; a second trigger waits
  let stopListening = null; // undoes onForeground while polling

  const label = computed(() => requestLabel(row.value, { requesting: requesting.value, short }));
  const settled = computed(() => isSettled(row.value));
  const note = computed(() => (requesting.value ? null : requestNote(row.value)));
  const canRequest = computed(() => !requesting.value && canRequestOver(row.value));
  // Whether to offer the force option at all: only to the one account the
  // rules will accept it from.
  const forceable = computed(() => canForce(currentEmail()));

  const currentEmail = () => {
    const value = typeof email === 'function' ? email() : (email?.value ?? email);
    return typeof value === 'string' ? value : null;
  };

  function stop () {
    if (timer) clearTimer(timer);
    timer = null;
    watching = null;
    if (stopListening) stopListening();
    stopListening = null;
  }

  function schedule (tmdbId) {
    const fast = now() - startedAt < POLL_FAST_WINDOW_MS;
    // Returning the promise lets the tests await a tick; timers ignore it.
    timer = setTimer(() => {
      timer = null;
      return check(tmdbId);
    }, fast ? POLL_INTERVAL_MS : POLL_SLOW_INTERVAL_MS);
  }

  /**
   * Read the row and decide what happens next: stop if it settled, poll
   * again if it hasn't, or go quiet if nobody is looking — the foreground
   * listener picks it back up.
   */
  async function check (tmdbId) {
    if (watching !== tmdbId || checking) return;
    if (!isVisible()) return;
    checking = true;
    try {
      row.value = await read(requestPath(tmdbId));
    } catch (readError) {
      // A blip mid-poll is not worth alarming anyone over; try again.
      console.warn('Could not check on the movie request', readError);
    } finally {
      checking = false;
    }
    if (watching !== tmdbId) return;
    if (isSettled(row.value)) {
      stop();
    } else {
      schedule(tmdbId);
    }
  }

  function watch (tmdbId) {
    stop();
    watching = tmdbId;
    startedAt = now();
    // Back in front of someone: don't wait out a slow tick, look now.
    stopListening = onForeground(() => {
      if (watching !== tmdbId) return;
      if (timer) clearTimer(timer);
      timer = null;
      return check(tmdbId);
    });
    schedule(tmdbId);
  }

  /**
   * Read the row once. A page with many buttons (the home page's drawn
   * list) reads the whole `requests` node itself and hands each button
   * its row as `preloaded` — pass `null` for "there isn't one" — so a
   * hundred buttons don't make a hundred reads. Polling for a row still
   * in flight goes through `read` either way.
   */
  async function load (tmdbId, preloaded) {
    stop();
    error.value = null;
    if (!isValidTmdbId(tmdbId)) {
      row.value = null;
      return null;
    }
    if (preloaded !== undefined) {
      row.value = preloaded;
    } else {
      try {
        row.value = await read(requestPath(tmdbId));
      } catch (readError) {
        // Not signed in, or offline: the button simply has no history to
        // show. It still works if tapped — the write reports its own failure.
        console.warn('Could not read the movie request', readError);
        row.value = null;
      }
    }
    if (row.value && !isSettled(row.value)) watch(tmdbId);
    return row.value;
  }

  async function request ({ tmdbId, title, force = false }) {
    if (requesting.value) return;
    error.value = null;

    let payload;
    try {
      payload = buildRequest({ tmdbId, title, source, email: currentEmail(), force });
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

  return { row, requesting, error, label, note, settled, canRequest, forceable, load, request, stop };
}
