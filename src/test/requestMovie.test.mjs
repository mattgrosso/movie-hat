import { describe, it, expect, vi } from 'vitest';
import {
  buildRequest,
  canRequestOver,
  isValidTmdbId,
  requestLabel,
  requestPath,
  useRequestMovie,
  POLL_INTERVAL_MS,
  POLL_FAST_WINDOW_MS,
  POLL_SLOW_INTERVAL_MS
} from '../utils/requestMovie.js';

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
    expect(requestLabel({ status: 'pending' })).toBe('Requested');
    expect(requestLabel({ status: 'processing' })).toBe('Adding…');
    expect(requestLabel({ status: 'added' })).toBe('Added to library');
    expect(requestLabel({ status: 'exists' })).toBe('Already in library');
    expect(requestLabel({ status: 'error' })).toMatch(/try again/);
  });
});

// A fake database plus fake timers, so the polling can be stepped by hand.
function harness ({ rows = {}, writeError = null, source = 'movie-hat' } = {}) {
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
    email: () => 'someone@example.com',
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
  it('writes a pending row and polls until the service settles it', async () => {
    const h = harness();

    await h.request({ tmdbId: 12101, title: 'Soylent Green' });

    expect(h.write).toHaveBeenCalledWith('requests/12101', expect.objectContaining({ status: 'pending' }));
    expect(h.row.value.status).toBe('pending');
    expect(h.label.value).toBe('Requested');
    expect(h.requesting.value).toBe(false);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(POLL_INTERVAL_MS);

    // The service picks it up …
    h.store['requests/12101'] = { ...h.store['requests/12101'], status: 'processing' };
    await h.tick();
    expect(h.label.value).toBe('Adding…');
    expect(h.settled.value).toBe(false);
    expect(h.timers).toHaveLength(1);

    // … and finishes.
    h.store['requests/12101'] = { ...h.store['requests/12101'], status: 'added', radarrId: 7 };
    await h.tick();
    expect(h.label.value).toBe('Added to library');
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
    expect(h.label.value).toBe('Requested');

    // A film's length later, the Mac mini gets to it.
    for (let i = 0; i < 240; i += 1) await h.tick();
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(POLL_SLOW_INTERVAL_MS);

    h.store['requests/12101'] = { ...h.store['requests/12101'], status: 'added', radarrId: 7 };
    await h.tick();
    expect(h.label.value).toBe('Added to library');
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

    h.store['requests/12101'] = { ...h.store['requests/12101'], status: 'added', radarrId: 7 };
    await h.show();
    expect(h.read).toHaveBeenCalledTimes(1);
    expect(h.label.value).toBe('Added to library');
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

    expect(h.label.value).toBe('Requested');
    expect(h.canRequest.value).toBe(false);
    expect(h.timers).toHaveLength(1);
  });

  it('takes a preloaded row instead of reading, and still polls one in flight', async () => {
    const h = harness();

    await h.load(12101, { status: 'processing' });
    expect(h.read).not.toHaveBeenCalled();
    expect(h.label.value).toBe('Adding…');
    expect(h.timers).toHaveLength(1);

    await h.load(12101, null);
    expect(h.read).not.toHaveBeenCalled();
    expect(h.row.value).toBeNull();
    expect(h.timers).toHaveLength(0);
  });

  it('does not poll a request that already settled', async () => {
    const h = harness({ rows: { 'requests/12101': { status: 'exists' } } });

    await h.load(12101);

    expect(h.label.value).toBe('Already in library');
    expect(h.timers).toHaveLength(0);
  });

  it('shows the other request when the rules refuse a duplicate write', async () => {
    const refusal = Object.assign(new Error('Movie Hat database responded 401'), { status: 401 });
    const h = harness({ writeError: refusal });
    h.store['requests/12101'] = { status: 'processing', requestedBy: 'else@example.com' };

    await h.request({ tmdbId: 12101, title: 'Soylent Green' });

    expect(h.error.value).toBeNull();
    expect(h.label.value).toBe('Adding…');
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
