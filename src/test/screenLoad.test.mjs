import { describe, it, expect } from 'vitest';
import { isScreenLoadFailure, screenLoadHandlers, SCREEN_LOAD_MESSAGE } from '@/utils/screenLoad.js';
import { IGNORE_ERRORS } from '@/utils/sentryNoise.js';

function memoryStorage () {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function setup ({ online = true, storage = memoryStorage() } = {}) {
  const reloads = [];
  const messages = [];
  const handlers = screenLoadHandlers({
    isOnline: () => online,
    storage,
    reloadInto: (path) => reloads.push(path),
    showMessage: (m) => messages.push(m),
  });
  return { handlers, reloads, messages, storage };
}

const safariCss = new Error('Unable to preload CSS for /css/RequestAMovie.91f1d595.css');
const to = { fullPath: '/request' };

describe('on-demand screen that failed to download', () => {
  it('recognises each browser\'s message', () => {
    expect(isScreenLoadFailure(safariCss)).toBe(true);
    expect(isScreenLoadFailure(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isScreenLoadFailure(new TypeError('Failed to fetch dynamically imported module: https://movie-hat.com/js/RequestAMovie.js'))).toBe(true);
    expect(isScreenLoadFailure(new TypeError('error loading dynamically imported module: https://movie-hat.com/js/PeekInHat.js'))).toBe(true);
    expect(isScreenLoadFailure(new Error('PERMISSION_DENIED'))).toBe(false);
  });

  it('online: reloads once into the screen, then shows the message if it fails again', () => {
    const storage = memoryStorage();
    const first = setup({ storage });
    expect(first.handlers.onError(safariCss, to)).toBe('reloaded');
    expect(first.reloads).toEqual(['/request']);

    // The reloaded page shares sessionStorage and fails the same way.
    const second = setup({ storage });
    expect(second.handlers.onError(safariCss, to)).toBe('shown');
    expect(second.reloads).toEqual([]);
    expect(second.messages).toEqual([SCREEN_LOAD_MESSAGE]);
  });

  it('a screen that opened earns the next failure its own reload', () => {
    const { handlers, reloads } = setup();
    handlers.onError(safariCss, to);
    handlers.afterEach();
    expect(handlers.onError(safariCss, to)).toBe('reloaded');
    expect(reloads).toEqual(['/request', '/request']);
  });

  it('offline: stays put and says so', () => {
    const { handlers, reloads, messages } = setup({ online: false });
    expect(handlers.onError(safariCss, to)).toBe('shown');
    expect(reloads).toEqual([]);
    expect(messages).toEqual([SCREEN_LOAD_MESSAGE]);
  });

  it('leaves other router errors alone', () => {
    const { handlers, reloads, messages } = setup();
    expect(handlers.onError(new Error('boom'), to)).toBe(false);
    expect(reloads).toEqual([]);
    expect(messages).toEqual([]);
  });

  it('keeps the failure out of Sentry', () => {
    expect(IGNORE_ERRORS.some((re) => re.test(safariCss.message))).toBe(true);
  });
});
