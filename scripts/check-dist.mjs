// Run by `yarn deploy` between the build and the S3 upload; see distCheck.mjs
// for what it checks and why. Exit 1 stops the deploy before `s3 sync
// --delete` can replace the working site.
//
//   node scripts/check-dist.mjs [dir]   (default dist)

import { readFileSync } from 'fs';
import { checkDist, versionFromEnv } from './distCheck.mjs';

const dir = process.argv[2] || 'dist';
const version = versionFromEnv(readFileSync('.env', 'utf8'));
const { bundle, problems } = checkDist(dir, version);

if (problems.length) {
  console.error('\n✗ The build is not fit to ship — nothing was uploaded:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`✓ Build checked: ${bundle}, version ${version}, worker and push handler in place.`);
