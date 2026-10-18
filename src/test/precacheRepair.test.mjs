// The phone's saved copy of the app, refilled after a hard reload emptied it
// (2026-10-17 black-screen report). Wrong keys would mean a "repair" the
// worker never reads; a repair for the wrong version would cache files this
// page doesn't run.
import { describe, it, expect, vi } from 'vitest';
import { parsePrecacheManifest, precacheKey, precacheName, repairPrecacheIfEmptied } from '../utils/precacheRepair.js';

const SCOPE = 'https://movie-hat.com/';

// The shape vite-plugin-pwa's generateSW writes, as in dist/service-worker.js.
const WORKER = 'define(["./workbox-1"],function(e){"use strict";importScripts("push-sw.js"),e.setCacheNameDetails({prefix:"movie-hat"}),self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"/index.html",revision:"abc123"},{url:"/js/app.11112222.js",revision:null},{url:"/css/app.33334444.css",revision:null}],{})});';

function fakeCache (initial = []) {
  const store = new Map(initial.map((key) => [key, true]));
  return {
    store,
    match: async (key) => store.get(String(key)),
    put: async (key, value) => { store.set(String(key), value); }
  };
}

function setup ({ cached = [], registration = {}, worker = WORKER } = {}) {
  const cache = fakeCache(cached);
  const opened = [];
  const cacheStorage = { open: async (name) => { opened.push(name); return cache; } };
  const fetched = [];
  const fetchImpl = vi.fn(async (url) => {
    fetched.push(String(url));
    if (String(url).endsWith('service-worker.js')) return { ok: true, text: async () => worker };
    return { ok: true, redirected: false, body: String(url) };
  });
  const serviceWorker = {
    controller: {},
    getRegistration: async () => ({ scope: SCOPE, active: {}, installing: null, waiting: null, ...registration })
  };
  return { cache, opened, cacheStorage, fetched, fetchImpl, serviceWorker };
}

describe('parsePrecacheManifest', () => {
  it('reads every entry of a generated worker, revisions included', () => {
    expect(parsePrecacheManifest(WORKER)).toEqual([
      { url: '/index.html', revision: 'abc123' },
      { url: '/js/app.11112222.js', revision: null },
      { url: '/css/app.33334444.css', revision: null }
    ]);
  });

  it('reads nothing from something that is not a worker', () => {
    expect(parsePrecacheManifest('<html></html>')).toEqual([]);
  });
});

describe('precacheKey and precacheName', () => {
  it('match what workbox looks up', () => {
    expect(precacheKey({ url: '/index.html', revision: 'abc123' }, SCOPE)).toBe('https://movie-hat.com/index.html?__WB_REVISION__=abc123');
    expect(precacheKey({ url: '/js/app.1.js', revision: null }, SCOPE)).toBe('https://movie-hat.com/js/app.1.js');
    expect(precacheName(SCOPE)).toBe('movie-hat-precache-v2-https://movie-hat.com/');
  });
});

describe('repairPrecacheIfEmptied', () => {
  const run = (env) => repairPrecacheIfEmptied({ runningBundle: 'js/app.11112222.js', base: '/', ...env });

  it('refills an emptied precache under workbox keys', async () => {
    const env = setup();
    expect(await run(env)).toBe('repaired');
    expect(env.opened).toEqual(['movie-hat-precache-v2-https://movie-hat.com/']);
    expect([...env.cache.store.keys()]).toEqual([
      'https://movie-hat.com/index.html?__WB_REVISION__=abc123',
      'https://movie-hat.com/js/app.11112222.js',
      'https://movie-hat.com/css/app.33334444.css'
    ]);
  });

  it('does nothing more than one lookup when the app is still saved', async () => {
    const env = setup({ cached: ['https://movie-hat.com/js/app.11112222.js'] });
    expect(await run(env)).toBe('intact');
    expect(env.fetchImpl).not.toHaveBeenCalled();
  });

  it('only fetches what is missing', async () => {
    const env = setup({ cached: ['https://movie-hat.com/index.html?__WB_REVISION__=abc123'] });
    await run(env);
    expect(env.fetched).toEqual([
      '/service-worker.js',
      'https://movie-hat.com/js/app.11112222.js',
      'https://movie-hat.com/css/app.33334444.css'
    ]);
  });

  it('leaves a worker serving another version alone', async () => {
    const env = setup({ worker: WORKER.replace('11112222', '99998888') });
    expect(await run(env)).toBe('skipped');
    expect(env.cache.store.size).toBe(0);
  });

  it('leaves it to a worker that is installing or waiting', async () => {
    for (const registration of [{ installing: {} }, { waiting: {} }]) {
      const env = setup({ registration });
      expect(await run(env)).toBe('skipped');
      expect(env.fetchImpl).not.toHaveBeenCalled();
    }
  });

  it('does nothing without a controlling worker', async () => {
    const env = setup();
    env.serviceWorker.controller = null;
    expect(await run(env)).toBe('skipped');
  });

  it('never throws', async () => {
    const env = setup();
    env.cacheStorage.open = async () => { throw new Error('quota'); };
    expect(await run(env)).toBe('skipped');
  });
});
