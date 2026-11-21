// After the upload and CloudFront refresh: is movie-hat.com serving the
// bundle this deploy just built? Reads dist/index.html for the expected
// js/app.<hash>.js, fetches the live page (cache-busted, as App.vue's update
// check does) and the bundle itself. CloudFront answers a missing file with
// index.html and a 200, so the bundle test is the content type.
//
// The invalidation can take a minute to reach every edge, so it retries for
// up to two minutes before failing. A failure here means the files are
// already up: it is a "go look", not a rollback.
//
//   node scripts/check-live.mjs [origin]

import { readFileSync } from 'fs';
import { APP_BUNDLE } from './distCheck.mjs';

const origin = process.argv[2] || 'https://movie-hat.com';
const expected = (readFileSync('dist/index.html', 'utf8').match(APP_BUNDLE) || [])[0];

async function attempt () {
  const page = await fetch(`${origin}/index.html?live-check=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const live = ((await page.text()).match(APP_BUNDLE) || [])[0];
  if (live !== expected) return `the live page names ${live || 'no bundle'}, expected ${expected}`;
  const script = await fetch(`${origin}/${expected}`, { signal: AbortSignal.timeout(15000) });
  await script.arrayBuffer();
  const type = script.headers.get('content-type') || '';
  if (!script.ok || !/javascript/.test(type)) return `${expected} answered ${script.status} ${type.split(';')[0]}`;
  return null;
}

let problem = 'not checked';
for (let tries = 0; tries < 8; tries++) {
  try {
    problem = await attempt();
  } catch (error) {
    problem = error.message;
  }
  if (!problem) break;
  await new Promise((resolve) => setTimeout(resolve, 15000));
}

if (problem) {
  console.error(`\n✗ Live check failed after two minutes: ${problem}. The upload finished; look at ${origin}.`);
  process.exit(1);
}
console.log(`✓ Live: ${origin} is serving ${expected}.`);
