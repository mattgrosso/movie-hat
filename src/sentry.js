// Crash reporting, production only. Movie Hat has had a Sentry project since
// the Vue CLI days (project movie-hat, 2023) but never called init, so it
// never sent a thing. Wired for real on 2026-10-07, when Bug Desk started
// reading Sentry: every new error here becomes a Bug Desk card with a fix
// plan on Matt's phone, and closing the card resolves it in Sentry.
//
// Uncaught errors, and since 2026-10-08 every console.error too — the
// caught failures that used to die in a console nobody reads (a refused
// write, a sync that gave up). utils/sentryHandled.js budgets and groups
// those so they cannot spend the free plan's error quota, which every app
// shares; a crash or a handled failure is what Bug Desk can act on.
// Performance tracing on a tenth of page loads (2026-10-08): Sentry's N+1
// and large-payload detectors then audit this app's database reads
// continuously, the way they caught Cinema Roll's. Every URL is scrubbed before it leaves — Firebase takes the sign-in
// token as `?auth=` and TMDB its key as `?api_key=`, and Sentry would keep
// them for 90 days (Cinema Roll's 2026-10-06 lesson, utils/scrubUrl.js).
import * as Sentry from '@sentry/vue';
import { scrubBreadcrumb, scrubEvent } from './utils/scrubUrl';
import { handledErrorFilter } from './utils/sentryHandled.js';

const DSN = 'https://00db30b8e0214b6daa3fe1054e053d12@o4504483013525504.ingest.us.sentry.io/4504483022569472';

export function setupSentry (app, { router } = {}) {
  if (!import.meta.env.PROD) return;
  // VUE_APP_VERSION is defined at build time (vite.config.mjs), the same
  // number the build stamp shows, so an error names the deploy it came from.
  const version = process.env.VUE_APP_VERSION;
  Sentry.init({
    app,
    dsn: DSN,
    release: version ? `movie-hat@${version}` : undefined,
    environment: 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    // Firebase and TMDB are cross-origin: no trace headers ride along (CORS).
    tracePropagationTargets: [/^\//],
    sampleRate: 1.0,
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ['error'] }),
      ...(router ? [Sentry.browserTracingIntegration({ router })] : [])
    ],
    attachStacktrace: true,
    maxValueLength: 8000,
    beforeSend: handledErrorFilter(scrubEvent),
    beforeBreadcrumb: scrubBreadcrumb,
  });
}
