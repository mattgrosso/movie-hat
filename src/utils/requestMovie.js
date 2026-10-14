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
import { trackEvent } from './usage.js';

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

// "Watch in Plex" (2026-10-13, report from Seth: the "ready to watch"
// notification "takes you back into Movie Hat. Really, it should take you
// into Plex"). A notification can't open Plex itself — on iOS a tap always
// opens the app that sent it, and a URL outside that app's scope opens in an
// in-app browser instead. So the push opens the request screen with
// `?ready=<tmdbId>`, and that screen puts the movie on top with one big
// button into Plex.
//
// The button opens Plex's home screen, not the movie: linking to one title
// needs the server's id and the library's own key for it, and nothing here
// knows either. Phones get the app's URL scheme; anything else gets Plex's
// web app, where the scheme would do nothing.
export const READY_PARAM = 'ready';

// "Movie requests" picked from the menu while already on that screen. The
// router ignores a push to the route you are on, so the menu says it this way
// instead, and the screen drops any search and shows the list again (report
// of 2026-10-14: after a search there was no way back to the list short of
// reloading).
export const REQUESTS_HOME_EVENT = 'movie-requests:home';
export const PLEX_APP_URL = 'plex://';
export const PLEX_WEB_URL = 'https://app.plex.tv/desktop';

/** Is this movie in the library now — something there is to go and watch? */
export function isReadyToWatch (row) {
  if (!row) return false;
  if (row.status === 'added') return typeof row.importedAt === 'number';
  return row.status === 'exists';
}

/**
 * Where the "Watch in Plex" button goes on this device. An iPad calls itself
 * a Mac; the touch screen is what gives it away.
 */
export function plexUrl ({
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  maxTouchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints
} = {}) {
  const phoneOrTablet = /iPhone|iPad|iPod|Android/i.test(userAgent || '') ||
    (/Macintosh/.test(userAgent || '') && maxTouchPoints > 1);
  return phoneOrTablet ? PLEX_APP_URL : PLEX_WEB_URL;
}

/** The row a `?ready=<tmdbId>` link is about, if that movie is ready. */
export function readyRequest (rows, readyParam) {
  const tmdbId = Number(readyParam);
  if (!isValidTmdbId(tmdbId)) return null;
  const row = rows?.[tmdbId];
  return isReadyToWatch(row) ? row : null;
}

// The card a `?ready=` link puts on top is a one-off, not a fixture (report
// of 2026-10-14: "how long will the Watch in Plex button appear… feels like
// there should be some way that it clears itself"). The app reopens on the
// address it was left on, so the link alone would keep the card up for
// good. Each movie's card is remembered on this device: when it was first
// shown, or 0 once it was dealt with (Watch in Plex, ✕, a search, back to
// the list). It stops showing after that, or an hour after it first showed.
// A notification for another movie is another id, so it still shows.
export const READY_CARD_KEY = 'movieRequests.readyCards';
export const READY_CARD_LINGER_MS = 60 * 60 * 1000;
const READY_CARD_REMEMBERED = 20;

function defaultStorage () {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

// Kept as [tmdbId, at] pairs, oldest first: numeric object keys would sort
// by id, not by when they were seen.
function readReadyCards (storage) {
  try {
    const pairs = JSON.parse(storage?.getItem(READY_CARD_KEY));
    return new Map(Array.isArray(pairs) ? pairs : []);
  } catch { return new Map(); }
}

function noteReadyCard (storage, tmdbId, at) {
  const cards = readReadyCards(storage);
  cards.delete(tmdbId);
  cards.set(tmdbId, at);
  // The newest few only; an old id never comes back through a notification.
  const kept = [...cards].slice(-READY_CARD_REMEMBERED);
  try { storage?.setItem(READY_CARD_KEY, JSON.stringify(kept)); } catch { /* private mode */ }
}

/** Should the card for this `?ready=` value still show? Notes its first showing. */
export function readyCardFresh (readyParam, { now = Date.now(), storage = defaultStorage() } = {}) {
  const tmdbId = Number(readyParam);
  if (!isValidTmdbId(tmdbId)) return false;
  const shownAt = readReadyCards(storage).get(tmdbId);
  if (shownAt === undefined) {
    noteReadyCard(storage, tmdbId, now);
    return true;
  }
  return shownAt > 0 && now - shownAt < READY_CARD_LINGER_MS;
}

/** This movie's card has been dealt with; don't show it again on this device. */
export function dismissReadyCard (readyParam, { storage = defaultStorage() } = {}) {
  const tmdbId = Number(readyParam);
  if (!isValidTmdbId(tmdbId)) return;
  noteReadyCard(storage, tmdbId, 0);
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

/**
 * How long the /request LIST should wait before reading the node again.
 *
 * Report -P1qwtjFEgBEaB4ALm_o (2026-09-18): "It would be nice if the list of
 * requested movies updated live without having to reload the page." The
 * screen read `requests` once on arrival and never again, so a request made
 * from the button below it, a request Seth made, or a row the Mac mini moved
 * on all needed a reload to show.
 *
 * Same two speeds as a single button, for the same reason, but the fast one
 * is bounded by a window rather than by the row's state: a row can sit
 * unsettled for a whole film while Plex is in use, and hammering the node for
 * an hour because somebody left the tab open is not "live", it's a bill.
 * Nothing polls at all while the page is hidden — coming back reads at once.
 */
export function requestsPollDelay (rows, { now = Date.now(), fastUntil = 0 } = {}) {
  const anythingMoving = Object.values(rows || {}).some((row) => row && !isSettled(row));
  if (!anythingMoving) return POLL_SLOW_INTERVAL_MS;
  return now < fastUntil ? POLL_INTERVAL_MS : POLL_SLOW_INTERVAL_MS;
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
    case 'added': {
      if (isSettled(row)) return short ? 'Ready' : 'Ready to watch';
      // In a list there is no room for the bar, so the number rides in the label.
      const progress = short ? downloadProgress(row) : null;
      if (progress) return progress.heldBy ? `Paused ${progress.percent}%` : `Downloading ${progress.percent}%`;
      return short ? 'Downloading' : 'Downloading — you’ll get a notification';
    }
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
    case 'added': {
      if (isSettled(row)) return null;
      const progress = downloadProgress(row);
      if (progress?.heldBy) return HELD_NOTES[progress.heldBy];
      return 'Still downloading. You’ll get a notification when it’s ready.';
    }
    default: return null;
  }
}

// Download progress (Matt, 2026-10-13: "give an actual progress bar, or at a
// minimum an ETA"). The Mac mini service reads Radarr's queue on its
// one-minute tick and writes three optional fields onto an 'added' row that
// hasn't landed:
//
//   progress  0–100, from the furthest-along copy (it races a second release
//             when one crawls, so a movie can have several in the queue)
//   etaAt     ms, that same copy's estimated finish
//   heldBy    'plex' | 'disk' | 'stuck' when it has stopped the torrent on
//             purpose. Absent means unknown, not running.
//
// It writes only when the whole percent or heldBy changes, and removes all
// three when the file lands or the request gives up. No progress field means
// nothing is downloading yet (often "still looking for a copy"), so the
// button keeps saying "Downloading" rather than drawing an empty bar.
//
// Radarr's estimates swing by days on a thin swarm, so an exact time is only
// shown when it is close; further out it is said loosely or not at all.
export const ETA_EXACT_UNDER_MS = 6 * 60 * 60 * 1000;
export const ETA_DAY_MS = 24 * 60 * 60 * 1000;
export const HELD_NOTES = {
  plex: 'Paused while someone’s watching Plex.',
  disk: 'Paused: the library drive is nearly full.',
  stuck: 'Paused: reconnecting.'
};

/** "about 25 min left", "several hours left"… or null when there is nothing honest to say. */
export function timeLeftText (etaAt, now = Date.now()) {
  if (typeof etaAt !== 'number' || !Number.isFinite(etaAt)) return null;
  const ms = etaAt - now;
  if (ms <= 0) return null;
  if (ms >= ETA_DAY_MS) return 'more than a day left';
  if (ms >= ETA_EXACT_UNDER_MS) return 'several hours left';
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `about ${minutes} min left`;
  return `about ${Math.round(minutes / 60)} h left`;
}

/**
 * What to draw for a row that is downloading: `{ percent, heldBy, timeLeft }`,
 * or null when there is no bar to show (not downloading, already landed, or
 * the service hasn't reported a number yet).
 */
export function downloadProgress (row, { now = Date.now() } = {}) {
  if (row?.status !== 'added' || isSettled(row)) return null;
  if (typeof row.progress !== 'number' || !Number.isFinite(row.progress)) return null;
  const percent = Math.max(0, Math.min(100, Math.round(row.progress)));
  const heldBy = HELD_NOTES[row.heldBy] ? row.heldBy : null;
  return { percent, heldBy, timeLeft: heldBy ? null : timeLeftText(row.etaAt, now) };
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
 * text), `note` (a line of explanation under it, or null), `progress`
 * (see downloadProgress, or null), `settled`
 * (nothing more will happen), and:
 *
 *   load(tmdbId, preloaded?)   → read the row once (or take the one given);
 *                                 keep polling if it is still in flight
 *   request({ tmdbId, title }) → write 'pending', then poll for the outcome
 *   force(tmdbId)              → owner only: add `force: true` to a row
 *                                 that is still 'pending' (see canForceNow)
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
  // Recomputed whenever a poll replaces the row, which is often enough for
  // a number the service only moves once a minute — no timer of its own.
  const progress = computed(() => downloadProgress(row.value, { now: now() }));
  const canRequest = computed(() => !requesting.value && canRequestOver(row.value));
  // Whether to offer the force option at all: only to the one account the
  // rules will accept it from.
  const forceable = computed(() => canForce(currentEmail()));
  // Whether forcing is on offer RIGHT NOW: after the request, while the
  // Mac mini is still holding it for Plex, and not already forced. Matt,
  // 2026-09-25: "the force through button should only show up after I've
  // clicked the request button and should replace it" — request first,
  // then a second tap if he can't wait.
  const canForceNow = computed(() =>
    forceable.value && !requesting.value && row.value?.status === 'pending' && !row.value.force
  );

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
    trackEvent('movie-requested');
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

  // Add `force: true` to a row that is already waiting. Only that one field
  // is written: the rules refuse any other change to a row in flight, and
  // grant this one to the owner while the row is still 'pending'.
  async function force (tmdbId) {
    if (!canForceNow.value) return;
    error.value = null;
    requesting.value = true;
    try {
      await write(`${requestPath(tmdbId)}/force`, true);
      row.value = { ...row.value, force: true };
      watch(tmdbId);
    } catch (writeError) {
      // Refused almost always means the Mac mini picked the row up between
      // our read and the tap — nothing left to force. Show where it is now.
      const refused = writeError?.status === 401 || writeError?.status === 403;
      if (refused) {
        await load(tmdbId);
      } else {
        console.error('The force didn’t save', writeError);
        error.value = 'Couldn’t force it. Please try again.';
      }
    } finally {
      requesting.value = false;
    }
  }

  return { row, requesting, error, label, note, progress, settled, canRequest, forceable, canForceNow, load, request, force, stop };
}
