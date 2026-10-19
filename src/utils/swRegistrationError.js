// A blocked service worker is not a failure. Playwright can block service
// workers (`serviceWorkers: 'block'`), and then register() resolves with
// nothing, so register-service-worker crashes reading `.waiting` off it and
// emits that as a registration error. captureConsoleIntegration sends every
// console.error to Sentry, so a test run that hid navigator.webdriver (which
// isTestBrowser relies on) opened a Bug Desk card (2026-10-19). No real
// browser resolves register() empty: when it does, the error is only a note.

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
      } else {
        log.error('Error during service worker registration:', error);
      }
    }
  };
}
