// A blocked service worker is not a failure. Playwright can block service
// workers (`serviceWorkers: 'block'`), and then register() resolves with
// nothing, so register-service-worker crashes reading `.waiting` off it and
// emits that as a registration error. captureConsoleIntegration sends every
// console.error to Sentry, so a test run that hid navigator.webdriver (which
// isTestBrowser relies on) opened a Bug Desk card (2026-10-19). No real
// browser resolves register() empty: when it does, the error is only a note.
//
// Nor is a worker script that never arrived. An iPhone on a dropped
// connection reported "Script https://movie-hat.com/service-worker.js load
// failed" while the file was being served fine (2026-10-25). The browser
// retries on the next visit and the app runs without the worker meanwhile,
// so a failed fetch of the script is a note too.

// Safari: "Script <url> load failed". Chrome: "Failed to register a
// ServiceWorker ...: An unknown error occurred when fetching the script."
// Firefox's "Load failed with status 404" is left alone: a missing worker
// is a real deploy problem, not a dropped connection.
const FETCH_FAILED = /\bload failed\b(?! with status)|error occurred when fetching the script/i;

/** True when the error only says the worker script couldn't be downloaded. */
export function isScriptFetchFailure (error) {
  return FETCH_FAILED.test(String(error?.message ?? error ?? ''));
}

/** register-service-worker hooks: `registered` remembers an empty registration, `error` reports. */
export function swRegistrationErrorHooks (log = console) {
  let blocked = false;
  return {
    registered (registration) {
      blocked = !registration;
    },
    error (error) {
      if (blocked) {
        log.warn('Service worker registration was blocked:', error);
      } else if (isScriptFetchFailure(error)) {
        log.warn('Service worker script could not be fetched:', error);
      } else {
        log.error('Error during service worker registration:', error);
      }
    }
  };
}
