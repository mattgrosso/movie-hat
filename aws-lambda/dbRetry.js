// One retry for a database call that Firebase fumbled (2026-10-21).
//
// The sweep runs every two minutes and reads siteUsers, requests and alerts
// each time; once in a while Realtime Database answers a plain GET with a
// 500, and the sweep logged it to Sentry as a failure (MOVIE-HAT-T). Nothing
// was lost — the next sweep picked the work up — but a card for Firebase's
// hiccup is noise. So a 5xx or a dropped connection gets one more try after
// a short pause. A real outage fails twice and still reaches Sentry; a 4xx
// (bad auth, bad path) is ours to fix and is returned at once.
//
// Safe for every call it wraps: GET reads, PUT replaces the value, DELETE
// removes it — doing any of them twice lands in the same place.
//
// Copied beside index.js by scripts/deploy-push-lambda.sh.
const RETRY_DELAY_MS = 500;

const fetchWithRetry = async (url, options, { fetchFn = globalThis.fetch, delayMs = RETRY_DELAY_MS } = {}) => {
  let res;
  try {
    res = await fetchFn(url, options);
  } catch {
    res = null;
  }
  if (res && res.status < 500) return res;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return fetchFn(url, options);
};

module.exports = { fetchWithRetry };
