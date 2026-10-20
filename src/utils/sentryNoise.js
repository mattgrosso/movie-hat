// Errors that belong to the visitor's browser extensions, not Movie Hat
// (2026-10-20). An iPhone Safari extension threw "Invalid call to
// runtime.sendMessage(). Tab not found." on the home page and Sentry filed
// it as ours. Nothing here calls the extension API, so a message naming it,
// or a stack frame from an extension's own script, is someone else's bug.

/** Sentry `ignoreErrors`: matched against the error message. */
export const IGNORE_ERRORS = [
  /\bruntime\.sendMessage\b/,
  /Extension context invalidated/,
];

/** Sentry `denyUrls`: an error thrown from an extension's script. */
export const DENY_URLS = [
  /^safari-(web-)?extension:\/\//i,
  /^(chrome|moz|ms-browser)-extension:\/\//i,
];
