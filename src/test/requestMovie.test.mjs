import { describe, it, expect, vi } from 'vitest';
import {
  buildRequest,
  canForce,
  canRequestOver,
  isValidTmdbId,
  requestLabel,
  requestNote,
  isSettled,
  requestPath,
  useRequestMovie,
  POLL_INTERVAL_MS,
  POLL_FAST_WINDOW_MS,
  POLL_SLOW_INTERVAL_MS,
  requestsPollDelay,
  isReadyToWatch,
  readyRequest,
  plexUrl,
  PLEX_APP_URL,
  PLEX_WEB_URL,
  downloadProgress,
  timeLeftText
} from '../utils/requestMovie.js';
import { readyCardFresh, dismissReadyCard, READY_CARD_LINGER_MS } from '../utils/requestMovie.js';

// Every write goes to requests/<tmdbId> — the key IS the duplicate check.
describe('requestPath', () => {
  it('keys the row by TMDb id', () => {
    expect(requestPath(12101)).toBe('requests/12101');
  });
});

describe('isValidTmdbId', () => {
  it('accepts positive integers only', () => {
    expect(isValidTmdbId(1)).toBe(true);
    expect(isValidTmdbId(12101)).toBe(true);
    expect(isValidTmdbId(0)).toBe(false);
    expect(isValidTmdbId(-3)).toBe(false);
    expect(isValidTmdbId(1.5)).toBe(false);
    expect(isValidTmdbId('12101')).toBe(false);
    expect(isValidTmdbId(undefined)).toBe(false);
  });
});

// The row the rules validate and the Mac mini service reads. If this shape
// changes, generate-hat-rules.mjs and README.md change with it.
describe('buildRequest', () => {
  const input = { tmdbId: 12101, title: 'Soylent Green', source: 'movie-hat', email: 'someone@example.com' };

  it('always writes status pending, under the requester, with a server timestamp', () => {
    expect(buildRequest(input)).toEqual({
      tmdbId: 12101,
      title: 'Soylent Green',
      status: 'pending',
      source: 'movie-hat',
      requestedBy: 'someone@example.com',
      createdAt: { '.sv': 'timestamp' }
    });
  });

  it('caps the title at the length the rules allow', () => {
    const long = 'x'.repeat(500);
    expect(buildRequest({ ...input, title: long }).title).toHaveLength(300);
  });

  it('refuses anything that is not a TMDb id', () => {
    expect(() => buildRequest({ ...input, tmdbId: '12101' })).toThrow(/TMDb id/);
    expect(() => buildRequest({ ...input, tmdbId: 0 })).toThrow(/TMDb id/);
  });

  it('refuses an unknown source and a missing email', () => {
    expect(() => buildRequest({ ...input, source: 'plex' })).toThrow(/source/);
    expect(() => buildRequest({ ...input, email: null })).toThrow(/signed-in/);
  });
});

// Forcing is the one field the service reads and never writes: it says
// "bring the VPN up and start now, even though somebody is watching Plex".
// The rules only accept it from Matt, so the module refuses it here too —
// a rejected write means the request never arrives at all.
describe('forcing a request past the Plex hold', () => {
  const input = { tmdbId: 12101, title: 'Soylent Green', source: 'movie-requests', email: 'mattgrosso@gmail.com' };

  it('knows the one account that may force, however it was typed', () => {
    expect(canForce('mattgrosso@gmail.com')).toBe(true);
    expect(canForce('MattGrosso@Gmail.com')).toBe(true);
    expect(canForce('someone@example.com')).toBe(false);
    expect(canForce(null)).toBe(false);
    expect(canForce(undefined)).toBe(false);
  });

  // Omitting it must behave exactly as before — the old rows have no such
  // field and the service treats its absence as "wait for the hold".
  it('leaves the field off entirely unless it was asked for', () => {
    expect(buildRequest(input)).not.toHaveProperty('force');
    expect(buildRequest({ ...input, force: false })).not.toHaveProperty('force');
  });

  it('writes force: true for Matt, and nothing else in the row changes', () => {
    expect(buildRequest({ ...input, force: true })).toEqual({
      ...buildRequest(input),
      force: true
    });
  });

  it('refuses to build a forced row for anybody else', () => {
    expect(() => buildRequest({ ...input, email: 'someone@example.com', force: true })).toThrow(/force/i);
    // …but they may still make an ordinary request.
    expect(buildRequest({ ...input, email: 'someone@example.com' }).requestedBy).toBe('someone@example.com');
  });

  it('says so on the button and underneath it while the row is pending', () => {
    expect(requestLabel({ status: 'pending', force: true })).toBe('Forced — starting now');
    expect(requestLabel({ status: 'pending', force: true }, { short: true })).toBe('Forced');
    expect(requestNote({ status: 'pending', force: true })).toMatch(/VPN/);
    // Once it is actually downloading, forced or not reads the same.
    expect(requestLabel({ status: 'added', force: true })).toMatch(/^Downloading/);
  });
});

describe('canRequestOver', () => {
  it('allows a fresh request, or a retry after an error, and nothing else', () => {
    expect(canRequestOver(null)).toBe(true);
    expect(canRequestOver({ status: 'error' })).toBe(true);
    expect(canRequestOver({ status: 'pending' })).toBe(false);
    expect(canRequestOver({ status: 'processing' })).toBe(false);
    expect(canRequestOver({ status: 'added' })).toBe(false);
    expect(canRequestOver({ status: 'exists' })).toBe(false);
  });
});

describe('requestLabel', () => {
  it('names every state the button can be in', () => {
    expect(requestLabel(null)).toBe('Request this movie');
    expect(requestLabel(null, { requesting: true })).toBe('Requesting…');
    expect(requestLabel({ status: 'pending' })).toMatch(/^Requested/);
    expect(requestLabel({ status: 'processing' })).toMatch(/^Starting/);
    expect(requestLabel({ status: 'added' })).toMatch(/^Downloading/);
    expect(requestLabel({ status: 'added', importedAt: 1 })).toBe('Ready to watch');
    expect(requestLabel({ status: 'exists' })).toBe('Already in the library');
    expect(requestLabel({ status: 'error' })).toMatch(/try again/);
  });

  it('never says a movie is there before the file has landed', () => {
    for (const short of [false, true]) {
      expect(requestLabel({ status: 'added' }, { short })).not.toMatch(/library|ready|added/i);
      expect(requestLabel({ status: 'pending' }, { short })).not.toMatch(/library|ready/i);
      expect(requestLabel({ status: 'processing' }, { short })).not.toMatch(/library|ready/i);
    }
    expect(isSettled({ status: 'added' })).toBe(false);
    expect(isSettled({ status: 'added', importedAt: 1 })).toBe(true);
    expect(isSettled({ status: 'exists' })).toBe(true);
    expect(isSettled({ status: 'error' })).toBe(true);
    expect(isSettled(null)).toBe(false);
  });

  it('explains the waiting states and promises the notification', () => {
    expect(requestNote({ status: 'pending' })).toMatch(/Plex.*notification/);
    expect(requestNote({ status: 'processing' })).toMatch(/notification/);
    expect(requestNote({ status: 'added' })).toMatch(/Still downloading.*notification/);
    expect(requestNote({ status: 'added', importedAt: 1 })).toBeNull();
    expect(requestNote({ status: 'exists' })).toBeNull();
    expect(requestNote(null)).toBeNull();
  });

  it('has a short form for a button that shares a row', () => {
    expect(requestLabel(null, { short: true })).toBe('Request');
    expect(requestLabel({ status: 'pending' }, { short: true })).toBe('Requested');
    expect(requestLabel({ status: 'added' }, { short: true })).toBe('Downloading');
    expect(requestLabel({ status: 'added', importedAt: 1 }, { short: true })).toBe('Ready');
    expect(requestLabel({ status: 'exists' }, { short: true })).toBe('In library');
    expect(requestLabel({ status: 'error' }, { short: true })).toBe('Try again');
  });
});

// A fake database plus fake timers, so the polling can be stepped by hand.
function harness ({ rows = {}, writeError = null, source = 'movie-hat', email = 'someone@example.com' } = {}) {
  const store = { ...rows };
  const timers = [];
  let clock = 1_000_000;

  const read = vi.fn(async (path) => store[path] ?? null);
  const write = vi.fn(async (path, value) => {
    if (writeError) throw writeError;
    store[path] = value;
  });

  let visible = true;
  const foregroundHandlers = [];

  const api = useRequestMovie({
    read,
    write,
    source,
    email: () => email,
    now: () => clock,
    setTimer: (fn, ms) => { const id = { fn, ms }; timers.push(id); return id; },
    clearTimer: (id) => { const i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1); },
    isVisible: () => visible,
    onForeground: (handler) => {
      foregroundHandlers.push(handler);
      return () => { const i = foregroundHandlers.indexOf(handler); if (i >= 0) foregroundHandlers.splice(i, 1); };
    }
  });

  // Fires the next scheduled poll, advancing the clock by its delay.
  async function tick () {
    const next = timers.shift();
    if (!next) return false;
    clock += next.ms;
    await next.fn();
    return true;
  }

  return {
    ...api,
    store,
    read,
    write,
    timers,
    tick,
    advance: (ms) => { clock += ms; },
    hide: () => { visible = false; },
    // The page comes back in front of someone (and, as on iOS, says so twice).
    show: async () => { visible = true; await Promise.all([...foregroundHandlers, ...foregroundHandlers].map((handler) => handler())); },
    foregroundHandlers
  };
}

describe('useRequestMovie', () => {
  // Only Matt is ever shown the lever, and pressing it puts the one extra
  // field in the row the Mac mini is watching for.
  it('offers forcing to Matt alone, and writes the field when he uses it', async () => {
    const theirs = harness();
    expect(theirs.forceable.value).toBe(false);

    const h = harness({ email: 'mattgrosso@gmail.com' });
    expect(h.forceable.value).toBe(true);

    await h.request({ tmdbId: 12101, title: 'Soylent Green', force: true });
    expect(h.write).toHaveBeenCalledWith('requests/12101', expect.objectContaining({ status: 'pending', force: true }));
    expect(h.label.value).toBe('Forced — starting now');
    expect(h.note.value).toMatch(/VPN/);
  });

  // Report 2026-09-25: force is a SECOND tap, after the request, in the
  // request button's place — not a lever offered up front.
  it('offers forcing only once a request is waiting, then writes just the force field', async () => {
    const h = harness({ email: 'mattgrosso@gmail.com' });
    expect(h.canForceNow.value).toBe(false); // nothing requested yet

    await h.request({ tmdbId: 12101, title: 'Soylent Green' });
    expect(h.canForceNow.value).toBe(true);

    await h.force(12101);
    expect(h.write).toHaveBeenLastCalledWith('requests/12101/force', true);
    expect(h.label.value).toBe('Forced — starting now');
    expect(h.canForceNow.value).toBe(false); // already forced
  });

  it('never offers the late force to anyone else, or once the Mac mini has the row', async () => {
    const theirs = harness();
    await theirs.request({ tmdbId: 12101, title: 'Soylent Green' });
    expect(theirs.canForceNow.value).toBe(false);
    await theirs.force(12101);
    expect(theirs.write).toHaveBeenCalledTimes(1); // the request, nothing more

    const h = harness({ email: 'mattgrosso@gmail.com', rows: { 'requests/12101': { tmdbId: 12101, status: 'processing' } } });
    await h.load(12101);
    expect(h.canForceNow.value).toBe(false);
  });

  it('shows where the row went when the force is refused because it moved on', async () => {
    const h = harness({ email: 'mattgrosso@gmail.com' });
    await h.request({ tmdbId: 12101, title: 'Soylent Green' });
    h.store['requests/12101'] = { tmdbId: 12101, status: 'processing' };
    h.write.mockImplementationOnce(async () => { throw Object.assign(new Error('denied'), { status: 401 }); });
    await h.force(12101);
    expect(h.error.value).toBe(null);
    expect(h.label.value).toBe('Starting the download…');
  });

  it('writes no force field when he makes an ordinary request', async () => {
    const h = harness({ email: 'mattgrosso@gmail.com' });
    await h.request({ tmdbId: 12101, title: 'Soylent Green' });
    expect(h.write.mock.calls[0][1]).not.toHaveProperty('force');
    expect(h.label.value).toMatch(/^Requested/);
  });

  it('writes a pending row and polls until the service settles it', async () => {
    const h = harness();

    await h.request({ tmdbId: 12101, title: 'Soylent Green' });

    expect(h.write).toHaveBeenCalledWith('requests/12101', expect.objectContaining({ status: 'pending' }));
    expect(h.row.value.status).toBe('pending');
    expect(h.label.value).toMatch(/^Requested/);
    expect(h.note.value).toMatch(/notification/);
    expect(h.requesting.value).toBe(false);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(POLL_INTERVAL_MS);

    // The service picks it up …
    h.store['requests/12101'] = { ...h.store['requests/12101'], status: 'processing' };
    await h.tick();
    expect(h.label.value).toMatch(/^Starting/);
    expect(h.settled.value).toBe(false);
    expect(h.timers).toHaveLength(1);

    // … Radarr takes it, which is NOT the end: the file is still coming.
    h.store['requests/12101'] = { ...h.store['requests/12101'], status: 'added', radarrId: 7 };
    await h.tick();
    expect(h.label.value).toMatch(/^Downloading/);
    expect(h.note.value).toMatch(/Still downloading/);
    expect(h.settled.value).toBe(false);
    expect(h.timers).toHaveLength(1);

    // … and the file lands.
    h.store['requests/12101'] = { ...h.store['requests/12101'], importedAt: 5 };
    await h.tick();
    expect(h.label.value).toBe('Ready to watch');
    expect(h.note.value).toBeNull();
    expect(h.settled.value).toBe(true);
    expect(h.canRequest.value).toBe(false);
    expect(h.timers).toHaveLength(0);
  });

  it('slows down after the fast window but never gives up on a row in flight', async () => {
    const h = harness();
    await h.request({ tmdbId: 12101, title: 'Soylent Green' });

    let fastPolls = 0;
    while (h.timers[0].ms === POLL_INTERVAL_MS) {
      await h.tick();
      fastPolls += 1;
    }
    expect(fastPolls).toBe(Math.ceil(POLL_FAST_WINDOW_MS / POLL_INTERVAL_MS));
    expect(h.timers[0].ms).toBe(POLL_SLOW_INTERVAL_MS);
    expect(h.label.value).toMatch(/^Requested/);

    // A film's length later, the Mac mini gets to it.
    for (let i = 0; i < 240; i += 1) await h.tick();
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(POLL_SLOW_INTERVAL_MS);

    h.store['requests/12101'] = { ...h.store['requests/12101'], status: 'added', radarrId: 7, importedAt: 9 };
    await h.tick();
    expect(h.label.value).toBe('Ready to watch');
    expect(h.timers).toHaveLength(0);
    expect(h.foregroundHandlers).toHaveLength(0);
  });

  it('goes quiet while the page is hidden and reads at once when it returns', async () => {
    const h = harness();
    await h.request({ tmdbId: 12101, title: 'Soylent Green' });
    expect(h.foregroundHandlers).toHaveLength(1);

    h.hide();
    await h.tick();
    expect(h.read).not.toHaveBeenCalled();
    expect(h.timers).toHaveLength(0);

    h.store['requests/12101'] = { ...h.store['requests/12101'], status: 'added', radarrId: 7, importedAt: 9 };
    await h.show();
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.label.value).toBe('Ready to watch');
    expect(h.timers).toHaveLength(0);
  });

  it('a return to the foreground cuts a slow tick short', async () => {
    const h = harness();
    await h.request({ tmdbId: 12101, title: 'Soylent Green' });
    h.advance(POLL_FAST_WINDOW_MS);
    await h.tick();
    expect(h.timers[0].ms).toBe(POLL_SLOW_INTERVAL_MS);
    const readsBefore = h.read.mock.calls.length;

    await h.show();

    expect(h.read.mock.calls.length).toBe(readsBefore + 1);
    expect(h.timers).toHaveLength(1);
  });

  it('shows an existing request on load and keeps watching one still in flight', async () => {
    const h = harness({ rows: { 'requests/12101': { status: 'pending', requestedBy: 'else@example.com' } } });

    await h.load(12101);

    expect(h.label.value).toMatch(/^Requested/);
    expect(h.canRequest.value).toBe(false);
    expect(h.timers).toHaveLength(1);
  });

  it('keeps watching an added row until the file lands', async () => {
    const h = harness({ rows: { 'requests/12101': { status: 'added', radarrId: 7 } } });

    await h.load(12101);

    expect(h.label.value).toMatch(/^Downloading/);
    expect(h.timers).toHaveLength(1);

    await h.load(12101, { status: 'added', radarrId: 7, importedAt: 9 });
    expect(h.label.value).toBe('Ready to watch');
    expect(h.timers).toHaveLength(0);
  });

  it('takes a preloaded row instead of reading, and still polls one in flight', async () => {
    const h = harness();

    await h.load(12101, { status: 'processing' });
    expect(h.read).not.toHaveBeenCalled();
    expect(h.label.value).toMatch(/^Starting/);
    expect(h.timers).toHaveLength(1);

    await h.load(12101, null);
    expect(h.read).not.toHaveBeenCalled();
    expect(h.row.value).toBeNull();
    expect(h.timers).toHaveLength(0);
  });

  it('does not poll a request that already settled', async () => {
    const h = harness({ rows: { 'requests/12101': { status: 'exists' } } });

    await h.load(12101);

    expect(h.label.value).toBe('Already in the library');
    expect(h.timers).toHaveLength(0);
  });

  it('shows the other request when the rules refuse a duplicate write', async () => {
    const refusal = Object.assign(new Error('Movie Hat database responded 401'), { status: 401 });
    const h = harness({ writeError: refusal });
    h.store['requests/12101'] = { status: 'processing', requestedBy: 'else@example.com' };

    await h.request({ tmdbId: 12101, title: 'Soylent Green' });

    expect(h.error.value).toBeNull();
    expect(h.label.value).toMatch(/^Starting/);
  });

  it('reports a refusal when there is no row to explain it', async () => {
    const refusal = Object.assign(new Error('Movie Hat database responded 401'), { status: 401 });
    const h = harness({ writeError: refusal });

    await h.request({ tmdbId: 12101, title: 'Soylent Green' });

    expect(h.error.value).toMatch(/signed in/);
    expect(h.row.value).toBeNull();
    expect(h.canRequest.value).toBe(true);
  });

  it('reports any other failure and lets the user try again', async () => {
    const h = harness({ writeError: new Error('offline') });
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

    await h.request({ tmdbId: 12101, title: 'Soylent Green' });

    expect(h.error.value).toMatch(/try again/i);
    expect(h.canRequest.value).toBe(true);
    quiet.mockRestore();
  });

  it('never writes for a movie without a TMDb id', async () => {
    const h = harness();

    await h.request({ tmdbId: undefined, title: 'Mystery' });

    expect(h.write).not.toHaveBeenCalled();
    expect(h.error.value).toMatch(/TMDb id/);
  });

  it('carries the source through so the service knows which app asked', async () => {
    const h = harness({ source: 'cinema-roll' });

    await h.request({ tmdbId: 12101, title: 'Soylent Green' });

    expect(h.write.mock.calls[0][1].source).toBe('cinema-roll');
  });

  it('stop() ends polling, so an unmounted button makes no more reads', async () => {
    const h = harness();
    await h.request({ tmdbId: 12101, title: 'Soylent Green' });

    h.stop();

    expect(h.timers).toHaveLength(0);
    expect(h.foregroundHandlers).toHaveLength(0);
  });
});

// Report -P1qwtjFEgBEaB4ALm_o (2026-09-18): "It would be nice if the list of
// requested movies updated live without having to reload the page." The
// /request list now re-reads on this cadence.
describe('requestsPollDelay', () => {
  const fast = { now: 1000, fastUntil: 60_000 };
  const afterWindow = { now: 120_000, fastUntil: 60_000 };
  const moving = { 1: { status: 'pending' } };
  const settled = { 1: { status: 'added', importedAt: 5 }, 2: { status: 'exists' }, 3: { status: 'error' } };

  it('reads quickly while something is moving and the window is open', () => {
    expect(requestsPollDelay(moving, fast)).toBe(POLL_INTERVAL_MS);
  });

  it('drops to the slow tick once the fast window closes, even mid-download', () => {
    // A row can sit unsettled for a whole film while Plex is in use. Polling
    // every 2.5s for an hour because a tab was left open is not "live".
    expect(requestsPollDelay(moving, afterWindow)).toBe(POLL_SLOW_INTERVAL_MS);
  });

  it('stays slow when every row has settled', () => {
    expect(requestsPollDelay(settled, fast)).toBe(POLL_SLOW_INTERVAL_MS);
  });

  it('stays slow on an empty or missing node', () => {
    expect(requestsPollDelay({}, fast)).toBe(POLL_SLOW_INTERVAL_MS);
    expect(requestsPollDelay(null, fast)).toBe(POLL_SLOW_INTERVAL_MS);
  });

  it('ignores a hole in the node rather than throwing', () => {
    expect(requestsPollDelay({ 1: null, 2: { status: 'processing' } }, fast)).toBe(POLL_INTERVAL_MS);
  });
});

// Seth, 2026-10-13: the "ready to watch" tap should end up in Plex. The push
// opens the request screen with ?ready=<tmdbId>; these decide whether that
// screen shows the "Watch in Plex" card and where its button goes.
describe('watch in Plex', () => {
  it('counts a downloaded or already-owned movie as ready, nothing else', () => {
    expect(isReadyToWatch({ status: 'added', importedAt: 1 })).toBe(true);
    expect(isReadyToWatch({ status: 'exists' })).toBe(true);
    expect(isReadyToWatch({ status: 'added' })).toBe(false);
    expect(isReadyToWatch({ status: 'pending' })).toBe(false);
    expect(isReadyToWatch({ status: 'error' })).toBe(false);
    expect(isReadyToWatch(null)).toBe(false);
  });

  it('finds the row a ?ready= link names, only once it is ready', () => {
    const rows = {
      12101: { tmdbId: 12101, status: 'added', importedAt: 5 },
      550: { tmdbId: 550, status: 'processing' }
    };
    expect(readyRequest(rows, '12101')).toBe(rows[12101]);
    expect(readyRequest(rows, '550')).toBe(null);
    expect(readyRequest(rows, '999')).toBe(null);
    expect(readyRequest(rows, 'nonsense')).toBe(null);
    expect(readyRequest(rows, undefined)).toBe(null);
    expect(readyRequest(null, '12101')).toBe(null);
  });

  it('opens the Plex app on phones and tablets, Plex on the web elsewhere', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15';
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
    expect(plexUrl({ userAgent: iphone })).toBe(PLEX_APP_URL);
    expect(plexUrl({ userAgent: android })).toBe(PLEX_APP_URL);
    // An iPad asks for the desktop site and calls itself a Mac.
    expect(plexUrl({ userAgent: mac, maxTouchPoints: 5 })).toBe(PLEX_APP_URL);
    expect(plexUrl({ userAgent: mac, maxTouchPoints: 0 })).toBe(PLEX_WEB_URL);
  });
});

describe('download progress', () => {
  const now = 1_000_000_000_000;
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const downloading = (extra) => ({ status: 'added', ...extra });

  it('has no bar until the service reports a number', () => {
    expect(downloadProgress(downloading(), { now })).toBeNull();
    expect(downloadProgress(downloading({ progress: null }), { now })).toBeNull();
    expect(downloadProgress({ status: 'pending', progress: 40 }, { now })).toBeNull();
    expect(downloadProgress(null, { now })).toBeNull();
    expect(requestLabel(downloading(), { short: true })).toBe('Downloading');
  });

  it('drops the bar once the file lands', () => {
    expect(downloadProgress(downloading({ progress: 100, importedAt: 1 }), { now })).toBeNull();
  });

  it('reports the percent, clamped and whole', () => {
    expect(downloadProgress(downloading({ progress: 42.4 }), { now }).percent).toBe(42);
    expect(downloadProgress(downloading({ progress: 140 }), { now }).percent).toBe(100);
    expect(downloadProgress(downloading({ progress: -3 }), { now }).percent).toBe(0);
    expect(requestLabel(downloading({ progress: 42 }), { short: true })).toBe('Downloading 42%');
  });

  it('gives an exact time only when it is close', () => {
    expect(timeLeftText(now + 25 * MIN, now)).toBe('about 25 min left');
    expect(timeLeftText(now + 3 * HOUR, now)).toBe('about 3 h left');
    expect(timeLeftText(now + 7 * HOUR, now)).toBe('several hours left');
    expect(timeLeftText(now + 30 * HOUR, now)).toBe('more than a day left');
    expect(timeLeftText(now - MIN, now)).toBeNull();
    expect(timeLeftText(undefined, now)).toBeNull();
    expect(downloadProgress(downloading({ progress: 10, etaAt: now + 25 * MIN }), { now }).timeLeft).toBe('about 25 min left');
  });

  it('says why a paused download is paused, and gives no time for it', () => {
    const held = (heldBy) => downloadProgress(downloading({ progress: 30, etaAt: now + 10 * MIN, heldBy }), { now });
    expect(held('plex')).toEqual({ percent: 30, heldBy: 'plex', timeLeft: null });
    expect(requestNote(downloading({ progress: 30, heldBy: 'plex' }))).toMatch(/watching Plex/);
    expect(requestNote(downloading({ progress: 30, heldBy: 'disk' }))).toMatch(/drive is nearly full/);
    expect(requestNote(downloading({ progress: 30, heldBy: 'stuck' }))).toMatch(/reconnecting/);
    expect(requestLabel(downloading({ progress: 30, heldBy: 'disk' }), { short: true })).toBe('Paused 30%');
    // An unknown reason is not passed off as one of the known ones.
    expect(held('gremlins').heldBy).toBeNull();
    expect(requestNote(downloading({ progress: 30, heldBy: 'gremlins' }))).toMatch(/Still downloading/);
  });
});

// Report of 2026-10-14: the "Watch in Plex" card never went away, because the
// app reopens on the ?ready= address it was left on.
describe('the ready card clears itself', () => {
  const memoryStorage = () => {
    const items = {};
    return { getItem: (key) => items[key] ?? null, setItem: (key, value) => { items[key] = String(value); } };
  };

  it('shows for an hour after it first appears, then stays gone', () => {
    const storage = memoryStorage();
    expect(readyCardFresh('12101', { now: 1000, storage })).toBe(true);
    expect(readyCardFresh('12101', { now: 1000 + READY_CARD_LINGER_MS - 1, storage })).toBe(true);
    expect(readyCardFresh('12101', { now: 1000 + READY_CARD_LINGER_MS, storage })).toBe(false);
  });

  it('stays gone once dealt with, while another movie still gets its card', () => {
    const storage = memoryStorage();
    expect(readyCardFresh('12101', { now: 1000, storage })).toBe(true);
    dismissReadyCard('12101', { storage });
    expect(readyCardFresh('12101', { now: 1001, storage })).toBe(false);
    expect(readyCardFresh('550', { now: 1002, storage })).toBe(true);
  });

  it('ignores nonsense, and copes with no storage or broken storage', () => {
    expect(readyCardFresh('nonsense', { storage: memoryStorage() })).toBe(false);
    expect(readyCardFresh('12101', { storage: null })).toBe(true);
    const broken = { getItem: () => '{not json', setItem: () => { throw new Error('full'); } };
    expect(readyCardFresh('12101', { storage: broken })).toBe(true);
    expect(() => dismissReadyCard('12101', { storage: broken })).not.toThrow();
  });

  it('remembers only the newest twenty, never forgetting the one just seen', () => {
    const storage = memoryStorage();
    for (let id = 1; id <= 25; id += 1) dismissReadyCard(String(id), { storage });
    expect(readyCardFresh('999', { now: 5, storage })).toBe(true);
    expect(readyCardFresh('999', { now: 6, storage })).toBe(true);
    expect(readyCardFresh('25', { now: 7, storage })).toBe(false);
  });
});
