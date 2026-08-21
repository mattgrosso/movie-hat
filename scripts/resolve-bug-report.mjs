// Marks one or more bug reports resolved, so fetch-bug-reports.mjs stops
// surfacing them by default.
//
//   yarn resolve-bug-report <reportId> [reportId...]
//
// Unlike Cinema Roll's resolver this one does not (yet) notify the reporter
// in-app — Movie Hat has no resolution-notice UI. If that gets ported, model
// it on cinemaroll's scripts/resolve-bug-report.mjs (--understood/--fixed,
// written for a 12-year-old, --silent for QA noise).

import { adminGet, adminUpdate } from './hatDatabase.mjs';

const reportIds = process.argv.slice(2);
if (!reportIds.length) {
  console.error('Usage: yarn resolve-bug-report <reportId> [reportId...]');
  console.error('(report ids are printed by `yarn fetch-bug-reports`)');
  process.exit(1);
}

for (const id of reportIds) {
  const report = await adminGet(`bugReports/${id}`);
  if (!report) {
    console.error(`No report found with id ${id} - skipping.`);
    continue;
  }
  await adminUpdate({ [`bugReports/${id}/resolved`]: true, [`bugReports/${id}/resolvedAt`]: Date.now() });
  console.log(`Marked ${id} resolved.`);
}

process.exit(0);
