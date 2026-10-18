// Puts the app back on the phone after a hard reload emptied it.
//
// Bug report (2026-10-17): "The last few times I've opened up movie hat from
// the added to home screen link on my phone ... it's been sitting on a black
// screen for a really long time." appUpdate.js's hardReload() deletes the
// service worker's precache on purpose - it is what breaks the 2026-10-01
// "it refreshes and then tells me there's a new version ready again" loop -
// and that stays. But nothing ever filled the precache again: a worker only
// precaches while it installs, and the one in charge had already installed.
// So until the next deploy brought a new worker, every launch fetched
// index.html, the whole app bundle and its stylesheet from the network
// before it could draw anything. On a phone signal, that is the black screen.
//
// This refills it, quietly, once the page is running the version its worker
// serves. It reads that worker's own precache list from service-worker.js
// and stores exactly what the worker's install would have, under the keys
// workbox looks up (createCacheKey: a revisioned file is stored as
// `url?__WB_REVISION__=<revision>`, a hashed one as its plain url). The
// worker is never unregistered or replaced, so push is untouched.

const PRECACHE_PREFIX = 'movie-hat';

/** The {url, revision} entries of a generated service-worker.js, in order. */
export function parsePrecacheManifest (source) {
  const entries = [];
  const pattern = /\{\s*"?url"?\s*:\s*(["'])([^"']+)\1\s*,\s*"?revision"?\s*:\s*(null|(["'])([^"']*)\4)\s*\}/g;
  let match;
  while ((match = pattern.exec(String(source || '')))) {
    entries.push({ url: match[2], revision: match[3] === 'null' ? null : match[5] });
  }
  return entries;
}

/** Workbox's cache key for an entry (workbox-precaching createCacheKey). */
export function precacheKey ({ url, revision }, base) {
  const key = new URL(url, base);
  if (revision) key.searchParams.set('__WB_REVISION__', revision);
  return key.href;
}

/** Workbox's precache name for a scope: prefix-precache-v2-scope. */
export const precacheName = (scope) => `${PRECACHE_PREFIX}-precache-v2-${scope}`;

/**
 * Refill the precache if the running bundle is missing from it.
 * Resolves what it did: 'intact', 'repaired', or 'skipped' (no worker,
 * a worker mid-install, or a worker serving some other version).
 */
export async function repairPrecacheIfEmptied ({
  runningBundle,
  serviceWorker = (typeof navigator !== 'undefined' ? navigator.serviceWorker : null),
  cacheStorage = (typeof caches !== 'undefined' ? caches : null),
  fetchImpl = (...args) => fetch(...args),
  base = (typeof process !== 'undefined' && process.env && process.env.BASE_URL) || '/'
} = {}) {
  try {
    if (!runningBundle || !serviceWorker?.controller || !cacheStorage) return 'skipped';
    const registration = await serviceWorker.getRegistration();
    // A worker installing or waiting fills the cache itself as it installs.
    if (!registration?.active || registration.installing || registration.waiting) return 'skipped';

    const scope = registration.scope;
    const cache = await cacheStorage.open(precacheName(scope));
    const bundleUrl = new URL(`${base}${runningBundle}`, scope).href;
    if (await cache.match(bundleUrl)) return 'intact';

    const response = await fetchImpl(`${base}service-worker.js`, { cache: 'no-store' });
    if (!response.ok) return 'skipped';
    const entries = parsePrecacheManifest(await response.text());
    // The deployed worker is for another version: the update machinery
    // owns that case, and these files would not be what this page runs.
    if (!entries.some((entry) => new URL(entry.url, scope).href === bundleUrl)) return 'skipped';

    // One at a time, as workbox installs (workbox issue 2528). A file that
    // fails is left for the network, as it is today; the rest still land.
    for (const entry of entries) {
      const key = precacheKey(entry, scope);
      if (await cache.match(key)) continue;
      try {
        const fresh = await fetchImpl(new URL(entry.url, scope).href, {
          cache: entry.revision ? 'reload' : 'default',
          credentials: 'same-origin'
        });
        if (fresh.ok && !fresh.redirected) await cache.put(key, fresh);
      } catch {
        // Next file.
      }
    }
    return 'repaired';
  } catch {
    return 'skipped';
  }
}
