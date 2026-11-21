// What a Movie Hat build must look like before `yarn deploy` uploads it. The
// upload is `s3 sync --delete`, so a broken dist/ doesn't just fail to help —
// it replaces the working site. Every rule here guards something the build
// and the test suite would both wave through:
//
//  - index.html names exactly one js/app.<hex>.js. App.vue and
//    utils/appUpdate.js find new deploys by matching that name on the live
//    index.html; if a Vite or plugin upgrade renames it, installed phones
//    silently stop noticing updates (see vite.config.mjs's header).
//  - That script file is really in dist/js.
//  - service-worker.js and push-sw.js exist, the worker imports push-sw.js
//    (no notifications otherwise) and precaches the new bundle.
//  - The version from .env is baked into the bundle (the build stamp, Sentry
//    release and bug reports all read it).
//  - No .map file is in the worker's precache list (every phone would
//    download every source map).
//
// Pure: takes a directory and the expected version, returns problems. The
// command-line wrapper is scripts/check-dist.mjs.

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// The same pattern App.vue and utils/appUpdate.js match against index.html.
export const APP_BUNDLE = /js\/app\.[a-z0-9]+\.js/g;

export function checkDist (dir, version) {
  const problems = [];
  const read = (rel) => {
    const full = join(dir, rel);
    return existsSync(full) ? readFileSync(full, 'utf8') : null;
  };

  const html = read('index.html');
  let bundle = null;
  if (html === null) {
    problems.push('index.html is missing');
  } else {
    const names = [...new Set(html.match(APP_BUNDLE) || [])];
    if (names.length !== 1) {
      problems.push(`index.html should name exactly one js/app.<hash>.js (the auto-update check looks for it), found ${names.length ? names.join(', ') : 'none'}`);
    } else {
      bundle = names[0];
    }
  }

  let bundleText = null;
  if (bundle) {
    bundleText = read(bundle);
    if (bundleText === null) problems.push(`index.html names ${bundle}, but that file is not in the build`);
  }

  const worker = read('service-worker.js');
  if (worker === null) {
    problems.push('service-worker.js is missing (installed phones check for updates at that name)');
  } else {
    if (!/push-sw\.js/.test(worker)) problems.push('service-worker.js does not import push-sw.js (notifications would stop)');
    if (bundle && !worker.includes(`/${bundle}`)) problems.push(`service-worker.js does not precache ${bundle}`);
    const precached = worker.match(/url:"[^"]*"/g) || [];
    const maps = precached.filter((entry) => /\.map"$/.test(entry));
    if (maps.length) problems.push(`service-worker.js precaches source maps: ${maps.slice(0, 3).join(', ')}`);
  }
  if (read('push-sw.js') === null) problems.push('push-sw.js is missing (notifications would stop)');

  if (!version) {
    problems.push('no VUE_APP_VERSION in .env to check the build against');
  } else if (bundleText !== null && !bundleHasVersion(dir, version, bundleText)) {
    problems.push(`version ${version} is not baked into the bundle`);
  }

  return { bundle, problems };
}

// The version string usually lands in the entry bundle; allow a lazy chunk
// too, in case the code reading it is ever split out.
function bundleHasVersion (dir, version, bundleText) {
  const quoted = new RegExp(`["'\`]${version.replace(/\./g, '\\.')}["'\`]`);
  if (quoted.test(bundleText)) return true;
  const jsDir = join(dir, 'js');
  if (!existsSync(jsDir)) return false;
  return readdirSync(jsDir)
    .filter((name) => name.endsWith('.js'))
    .some((name) => quoted.test(readFileSync(join(jsDir, name), 'utf8')));
}

export function versionFromEnv (envText) {
  return (envText.match(/^VUE_APP_VERSION=(.+)$/m) || [])[1]?.trim() || null;
}
