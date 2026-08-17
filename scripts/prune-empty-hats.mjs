// Removes hats that have never held a single movie.
//
//   yarn prune-empty-hats            # list what would go
//   yarn prune-empty-hats --delete   # remove them
//
// Why (Matt, 2026-08-16): "there are a bunch of hats in there that seem like
// junk or spam. How can we reduce the number of bullshit hats without
// disrupting real hats?"
//
// The answer turned out to be simple, because the junk is unambiguous: of 70
// hat records, 40 have NO movies and NO history — someone signed in, made a
// hat named "6 7" or "Hatbbbbb" or "Hay", and never came back. There is
// nothing in them to lose. Everything with any content at all is left
// completely alone, including hats nobody has touched for three years:
// "Brian's Hat" (106 entries, dormant 997 days) is somebody's real hat and
// is none of our business.
//
// So the rule here is deliberately the strictest one that still does the job:
//   DELETE  a hat record with zero movies and zero history
//   KEEP    absolutely everything else
//
// Not "few movies", not "old", not "looks like nonsense" — a hat with one
// movie in it is a hat someone used.
//
// Takes a backup first when actually deleting.

import { execFileSync } from 'child_process';
import { adminGet, adminRemove } from './hatDatabase.mjs';

const doDelete = process.argv.includes('--delete');

/**
 * Split every hat record into what may go and what must stay.
 * Exported so the rule itself can be tested without a database.
 */
export function partitionHats (hats) {
  const empty = [];
  const kept = [];

  Object.entries(hats || {}).forEach(([title, byKey]) => {
    Object.entries(byKey || {}).forEach(([dbKey, hat]) => {
      const movies = Object.keys(hat?.movies || {}).length;
      const history = Object.keys(hat?.history || {}).length;
      const members = Object.values(hat?.members || {});
      const record = { title, dbKey, movies, history, members: members.length };

      if (movies === 0 && history === 0) empty.push(record);
      else kept.push(record);
    });
  });

  return { empty, kept };
}

const hats = await adminGet('hats');
if (!hats) {
  console.error('no hats in the database');
  process.exit(1);
}
const { empty, kept } = partitionHats(hats);

console.log(`${empty.length + kept.length} hat records: ${empty.length} never used, ${kept.length} with content\n`);
console.log(doDelete ? 'Removing:' : 'Would remove:');
empty.forEach((hat) => console.log(`   ${JSON.stringify(hat.title)}  (${hat.members} member${hat.members === 1 ? '' : 's'})`));

if (!doDelete) {
  console.log('\nEverything with even one movie or one draw is untouched.');
  console.log('Dry run. Re-run with --delete to apply.');
  process.exit(0);
}

console.log('\nBacking up first…');
execFileSync('node', [new URL('./backup-hats.mjs', import.meta.url).pathname, '--quiet'], { stdio: 'inherit' });

let removed = 0;
for (const hat of empty) {
  // Delete the RECORD, not the title: a title can hold more than one record,
  // and the other one might have content.
  const siblings = Object.keys(hats[hat.title] || {}).length;
  const path = siblings > 1
    ? `hats/${hat.title}/${hat.dbKey}`
    : `hats/${hat.title}`;

  try {
    await adminRemove(path);
    removed += 1;
  } catch (error) {
    console.error(`  ! failed to remove ${JSON.stringify(hat.title)}: ${error.message}`);
  }
}

console.log(`\n✔ removed ${removed} empty hat${removed === 1 ? '' : 's'}; ${kept.length} left untouched.`);
process.exit(0);
