// A test is not a user. Ported from Cinema Roll (utils/sentryBeforeSend.js).

/**
 * A page Sentry should stay out of entirely: a production build served from
 * this machine (`vite preview`, a screenshot run), or any automated browser —
 * Playwright, Puppeteer and Selenium all set `navigator.webdriver`. Those are
 * tests, not users, and their errors reached Sentry as if from the live site
 * (2026-10-16: a Playwright run on Linux against movie-hat.com blocked the
 * service worker, so register-service-worker crashed reading `.waiting` off
 * nothing — the same error Cinema Roll saw from a tester on 2026-10-14).
 */
export function isTestBrowser (win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(win.location?.hostname || '')) return true;
  return win.navigator?.webdriver === true;
}
