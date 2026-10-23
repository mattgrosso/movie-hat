// @vitest-environment jsdom
//
// Bug report (2026-10-22): "Loading my hat has been really slow the last
// couple of days." The hat now opens from the phone's copy of it while the
// database read happens, and that copy is only ever one account's, one hat's.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readHatCache, writeHatCache, clearHatCache, HAT_CACHE_KEY } from '../assets/javascript/hatCache.js';

const dbGet = vi.fn();
let authCallback = null;

vi.mock('../store/db.js', () => ({
  dbGet: (...args) => dbGet(...args),
  dbPut: vi.fn(),
  dbPatch: vi.fn(),
  hatPath: (title, ...rest) => ['hats', title, ...rest].join('/'),
  resolveHatKey: vi.fn()
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithCustomToken: vi.fn(),
  onAuthStateChanged: (auth, callback) => { authCallback = callback; return () => {}; }
}));

const COPY = {
  email: 'matt@example.com',
  hatKey: 'hat1',
  title: 'Just Matt',
  movies: [{ title: 'Heat', dbKey: 'm1' }],
  history: [{ title: 'Alien', dbKey: 'h1' }],
  members: ['matt@example.com'],
  mirrorFeedKey: null
};

function remember ({ email = COPY.email, hatKey = COPY.hatKey } = {}) {
  window.localStorage.setItem('movieHatEmail', JSON.stringify(email));
  window.localStorage.setItem('defaultMovieHat', JSON.stringify({ title: COPY.title, hatKey }));
}

async function freshStore () {
  vi.resetModules();
  return (await import('../store/index.js')).default;
}

beforeEach(() => {
  window.localStorage.clear();
  dbGet.mockReset();
  authCallback = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the phone\'s copy of the hat', () => {
  it('comes back only for the same account and hat', () => {
    writeHatCache(window.localStorage, COPY);
    expect(readHatCache(window.localStorage, { email: COPY.email, hatKey: 'hat1' })?.movies).toEqual(COPY.movies);
    expect(readHatCache(window.localStorage, { email: 'someone@example.com', hatKey: 'hat1' })).toBeNull();
    expect(readHatCache(window.localStorage, { email: COPY.email, hatKey: 'hat2' })).toBeNull();
    expect(readHatCache(window.localStorage, { email: null, hatKey: 'hat1' })).toBeNull();
  });

  it('treats junk as nothing', () => {
    window.localStorage.setItem(HAT_CACHE_KEY, '{not json');
    expect(readHatCache(window.localStorage, { email: COPY.email, hatKey: 'hat1' })).toBeNull();
    window.localStorage.setItem(HAT_CACHE_KEY, JSON.stringify({ email: COPY.email, hatKey: 'hat1', movies: 'nope' }));
    expect(readHatCache(window.localStorage, { email: COPY.email, hatKey: 'hat1' })).toBeNull();
  });

  it('a full phone just means no copy', () => {
    const storage = { setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: vi.fn() };
    expect(writeHatCache(storage, COPY)).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledWith(HAT_CACHE_KEY);
  });

  it('clears', () => {
    writeHatCache(window.localStorage, COPY);
    clearHatCache(window.localStorage);
    expect(window.localStorage.getItem(HAT_CACHE_KEY)).toBeNull();
  });
});

describe('the store and the copy', () => {
  it('shows the copy from the first render, but holds the draw until the read', async () => {
    remember();
    writeHatCache(window.localStorage, COPY);
    const store = await freshStore();
    expect(store.state.movieHat).toEqual(COPY.movies);
    expect(store.state.history).toEqual(COPY.history);
    expect(store.getters.hatIsFresh).toBe(false);

    dbGet.mockResolvedValue({ subKey: 'hat1', members: ['matt@example.com'], movies: { m2: { title: 'Ran' } }, history: {} });
    await store.dispatch('getHat');
    expect(store.state.movieHat.map((movie) => movie.title)).toEqual(['Ran']);
    expect(store.getters.hatIsFresh).toBe(true);
  });

  it('never shows another account\'s copy', async () => {
    remember({ email: 'brian@example.com' });
    writeHatCache(window.localStorage, COPY);
    const store = await freshStore();
    expect(store.state.movieHat).toBeNull();
  });

  it('never shows another hat\'s copy', async () => {
    remember({ hatKey: 'hat2' });
    writeHatCache(window.localStorage, COPY);
    const store = await freshStore();
    expect(store.state.movieHat).toBeNull();
  });

  it('saves what a read brought, once it knows which hat that was', async () => {
    vi.useFakeTimers();
    remember();
    const store = await freshStore();
    dbGet.mockResolvedValue({ subKey: 'hat1', members: ['matt@example.com'], movies: { m2: { title: 'Ran' } }, history: { h2: { title: 'Ikiru' } } });
    await store.dispatch('getHat');
    vi.advanceTimersByTime(1000);
    const saved = readHatCache(window.localStorage, { email: COPY.email, hatKey: 'hat1' });
    expect(saved.movies.map((movie) => movie.title)).toEqual(['Ran']);
    expect(saved.history.map((movie) => movie.title)).toEqual(['Ikiru']);
  });

  it('does not save the old hat under a new hat\'s key mid-switch', async () => {
    vi.useFakeTimers();
    remember();
    writeHatCache(window.localStorage, COPY);
    const store = await freshStore();
    dbGet.mockResolvedValue({ subKey: 'hat1', movies: { m1: { title: 'Heat' } }, history: {} });
    await store.dispatch('getHat');
    vi.advanceTimersByTime(1000);

    store.commit('setCurrentHat', { title: 'Family', hatKey: 'hat2' });
    store.commit('setMovieHat', [{ title: 'Heat', dbKey: 'm1' }]);
    vi.advanceTimersByTime(1000);
    expect(readHatCache(window.localStorage, { email: COPY.email, hatKey: 'hat2' })).toBeNull();
  });

  it('throws the copy away when somebody else signs in, or nobody is', async () => {
    remember();
    writeHatCache(window.localStorage, COPY);
    const store = await freshStore();
    store.dispatch('watchAuth');
    authCallback({ email: 'brian@example.com' });
    expect(window.localStorage.getItem(HAT_CACHE_KEY)).toBeNull();
    expect(store.state.movieHat).toBeNull();

    writeHatCache(window.localStorage, COPY);
    authCallback(null);
    expect(window.localStorage.getItem(HAT_CACHE_KEY)).toBeNull();
  });

  it('keeps the copy when the same account signs in', async () => {
    remember();
    writeHatCache(window.localStorage, COPY);
    const store = await freshStore();
    store.dispatch('watchAuth');
    authCallback({ email: COPY.email });
    expect(window.localStorage.getItem(HAT_CACHE_KEY)).not.toBeNull();
    expect(store.state.movieHat).toEqual(COPY.movies);
  });
});
