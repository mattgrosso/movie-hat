// Lint + tests, run first by `yarn deploy`, so nothing red reaches the
// phones. Ported from Cinema Roll's scripts/deploy.mjs (2026-10-05), where a
// red tree had reached the live site four times in one day. Movie Hat has no
// CI at all, so here this is the only check there is.
//
// The emulator rules tests (`yarn test:emulated`) stay manual: they need
// Java and the Firebase emulator.
//
//   SKIP_CHECKS=1 yarn deploy   — for a hotfix when the suite itself is broken

import { spawnSync } from 'child_process';

if (process.env.SKIP_CHECKS) {
  console.log('SKIP_CHECKS set — shipping without lint or tests.');
  process.exit(0);
}

console.log('\nChecking before shipping (yarn lint, yarn test:run; SKIP_CHECKS=1 to bypass)...');
for (const args of [['lint'], ['test:run']]) {
  const result = spawnSync('yarn', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n✗ yarn ${args.join(' ')} failed — nothing was built or shipped.`);
    process.exit(result.status ?? 1);
  }
}
