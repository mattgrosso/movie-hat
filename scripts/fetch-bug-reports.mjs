// Show UNRESOLVED in-app bug reports, newest first (--all for everything).
//
//   yarn fetch-bug-reports
//   yarn fetch-bug-reports --all
//
// Mark one done with `yarn resolve-bug-report <id>`.
//
// The `bugReports` node is write-only under the rules, so reading it needs
// credentials that bypass them — the same service account every other
// maintenance script here uses (MOVIE_HAT_ADMIN_KEY_PATH in .env.local).

import { adminGet } from './hatDatabase.mjs';

const showAll = process.argv.includes('--all');
const reports = await adminGet('bugReports');

if (!reports) {
  console.log('No bug reports yet.');
  process.exit(0);
}

const allEntries = Object.entries(reports)
  .sort(([, a], [, b]) => (b.createdAt || b.clientCreatedAt || 0) - (a.createdAt || a.clientCreatedAt || 0));
const all = showAll ? allEntries : allEntries.filter(([, report]) => !report.resolved);
const resolvedCount = allEntries.length - allEntries.filter(([, r]) => !r.resolved).length;

if (!all.length) {
  console.log(`No unresolved bug reports (${resolvedCount} resolved — rerun with --all to see them).`);
  process.exit(0);
}

console.log(`${all.length} report${all.length === 1 ? '' : 's'}\n`);

for (const [id, report] of all) {
  const when = new Date(report.createdAt || report.clientCreatedAt || 0).toLocaleString();
  console.log(`── ${id}`);
  console.log(`   ${when} · ${report.reporterEmail || 'signed out'}`);
  console.log(`   ${report.transcript}`);
  if (report.appState) {
    try {
      console.log(`   state: ${JSON.stringify(JSON.parse(report.appState))}`);
    } catch {
      console.log(`   state: ${report.appState}`);
    }
  }
  console.log(`   ${report.userAgent || ''} ${report.screenSize || ''}`);
  console.log('');
}

process.exit(0);
