// Retries for a database call that Firebase fumbled (2026-10-21).
//
// The sweep runs every two minutes and reads siteUsers, requests and alerts
// each time; once in a while Realtime Database answers a plain GET with a
// 500, and the sweep logged it to Sentry as a failure (MOVIE-HAT-T). Nothing
// was lost — the next sweep picked the work up — but a card for Firebase's
// hiccup is noise. So a 5xx or a dropped connection gets tried again after a
// pause. A real outage fails every try and still reaches Sentry; a 4xx (bad
// auth, bad path) is ours to fix and is returned at once.
//
// One retry half a second later was not enough: Firebase's 500s came back
// in pairs (MOVIE-HAT-S). Now three retries, backing off 0.5s, 2s, 5s —
// at most ~8s of waiting, well inside the function's 30s timeout.
//
// Safe for every call it wraps: GET reads, PUT replaces the value, DELETE
// removes it — doing any of them twice lands in the same place.
//
// Copied beside index.js by scripts/deploy-push-lambda.sh.
const RETRY_DELAYS_MS = [500, 2000, 5000];

const fetchWithRetry = async (url, options, { fetchFn = globalThis.fetch, delays = RETRY_DELAYS_MS } = {}) => {
  for (const delay of delays) {
    let res;
    try {
      res = await fetchFn(url, options);
    } catch {
      res = null;
    }
    if (res && res.status < 500) return res;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return fetchFn(url, options);
};

module.exports = { fetchWithRetry };
