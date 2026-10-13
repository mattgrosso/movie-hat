// Strips the search screen's leftovers from movies already saved in hats.
//
//   yarn slim-hat-entries           # show what would change, and how much
//   yarn slim-hat-entries --apply   # back up, then strip them
//
// Why (2026-10-13): Sentry kept flagging the home page's hat read as a large
// payload after the first fix. That fix (hatEntry.js) stopped re-reading the
// hat after every add or draw and saves new entries slim, but the one read
// every visit still makes is the whole hat, and every movie saved before it
// still carried the streaming list (up to ten provider records with logos)
// plus popularity and vote_count. Nothing reads those once a movie is saved:
// Where to Watch looks providers up live, and Cinema Roll reads only title,
// poster_path, id, addedBy, note and dateDrawn.
//
// Only those three fields go (SEARCH_ONLY in hatEntry.js), from movies and
// history alike. Everything else in every entry is left exactly as it is.
// Safe to re-run: a slim hat produces no updates.

import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import { adminGet, adminUpdate } from './hatDatabase.mjs';
import { SEARCH_ONLY } from '../src/assets/javascript/hatEntry.js';

const doApply = process.argv.includes('--apply');

/**
 * Every field to null out, as one multi-path update, plus a per-hat size
 * report. Exported so it can be tested without a database.
 */
export function planSlimming (hats) {
  const updates = {};
  const report = [];

  Object.entries(hats || {}).forEach(([title, byKey]) => {
    Object.entries(byKey || {}).forEach(([dbKey, hat]) => {
      let entries = 0;
      let saved = 0;
      ['movies', 'history'].forEach((list) => {
        Object.entries(hat?.[list] || {}).forEach(([entryKey, entry]) => {
          let touched = false;
          SEARCH_ONLY.forEach((field) => {
            if (entry?.[field] === undefined) return;
            updates[`hats/${title}/${dbKey}/${list}/${entryKey}/${field}`] = null;
            saved += JSON.stringify({ [field]: entry[field] }).length;
            touched = true;
          });
          if (touched) entries += 1;
        });
      });
      if (entries) {
        report.push({ title, entries, before: JSON.stringify(hat).length, saved });
      }
    });
  });

  return { updates, report };
}

// Only run when invoked as a script — the tests import planSlimming.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await run();
}

function kb (bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

async function run () {
  const hats = await adminGet('hats');
  if (!hats) {
    console.error('no hats in the database');
    process.exit(1);
  }
  const { updates, report } = planSlimming(hats);

  report.sort((a, b) => b.saved - a.saved);
  console.log(doApply ? 'Slimming:' : 'Would slim:');
  report.forEach((hat) => console.log(
    `   ${JSON.stringify(hat.title)}  ${hat.entries} entries, ${kb(hat.before)} → ${kb(hat.before - hat.saved)}`
  ));
  const total = report.reduce((sum, hat) => sum + hat.saved, 0);
  console.log(`\n${Object.keys(updates).length} fields in ${report.length} hats, ${kb(total)} in all.`);

  if (!doApply) {
    console.log('Dry run. Re-run with --apply to strip them.');
    process.exit(0);
  }
  if (!report.length) process.exit(0);

  console.log('\nBacking up first…');
  execFileSync('node', [new URL('./backup-hats.mjs', import.meta.url).pathname, '--quiet'], { stdio: 'inherit' });

  await adminUpdate(updates);
  console.log('\n✔ done.');
  process.exit(0);
}
