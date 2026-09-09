// Generates database.rules.json.
//
//   yarn generate-hat-rules
//
// NEVER hand-edit database.rules.json — edit this and re-run it.
//
// The rules have to turn `auth.token.email` into the same key
// `emailToMemberKey` produces, and the rules language has no regex: only
// String.replace, which replaces every occurrence. So the transform is a
// chain of replaces generated from the SAME character list the app uses,
// which is the only way the two can't drift apart. (Cinema Roll's
// generate-database-rules.mjs exists for exactly this reason.)
//
// What the rules say, in English:
//
//   - Nothing is readable or writable by default.
//   - A hat is readable only by someone listed in its `memberEmails` index.
//   - A hat is writable by a member, or by anyone CREATING one who puts
//     themselves in that index — otherwise you could make a hat you can't
//     then read.
//   - DELETING a whole hat is reserved for its creator (todo.md's ask).
//     Hats from before `createdBy` existed have no creator on record, so
//     any member may delete those — exactly the power they always had.
//   - `bugReports` is write-only: anyone — signed in OR NOT — may file one,
//     nobody may read them back or touch one that exists (triage goes
//     through `yarn fetch-bug-reports`, which bypasses rules). Signed-out
//     filing is deliberate and unlike the other apps: the bug that prompted
//     the button was a login failure, and a report box behind the login
//     cannot hear about those. Push-only with a size-capped transcript, so
//     the worst a stranger can do is leave a note.
//   - `mirrorFeed/<title>/<hatKey>/<secret>` is world-READABLE, and only at
//     that depth — the levels above it are refused, so no hat is enumerable
//     through it and no feed is findable without its secret. Only a member of
//     the hat may publish. This is how the Magic Mirror, which cannot sign
//     in, sees the latest pick without the hat being open to everyone.
//   - `userHats/<you>` is readable only by you, and yours to change freely.
//     Anyone signed in may CREATE an entry in someone else's index — that is
//     what inviting them to a hat means — but may not change or remove one
//     that exists. A junk entry planted by a stranger points at a hat its
//     victim can't read, which is exactly what getMemberHats treats as
//     stale and quietly removes.
//
// Deploying: `firebase deploy --only database` against project
// movie-hat-9c418, or paste into the console's Rules tab. Supervised, with
// `yarn restore-hats` in reach — a bad rules deploy shows every user an empty
// app.

import { writeFileSync } from 'fs';
import { UNSAFE_KEY_CHARACTERS, KEY_REPLACEMENT_CHARACTER } from '../src/store/memberKey.mjs';

// auth.token.email → the member key, in the rules language.
const memberKeyExpression = UNSAFE_KEY_CHARACTERS.reduce(
  (expression, character) => `${expression}.replace('${character}', '${KEY_REPLACEMENT_CHARACTER}')`,
  "auth.token.email.toLowerCase()"
);

const signedIn = "auth != null && auth.token.email != null";
const isMember = `data.child('memberEmails').child(${memberKeyExpression}).exists()`;
const becomesMember = `newData.child('memberEmails').child(${memberKeyExpression}).exists()`;
// Deleting a whole hat: the creator's call — except legacy hats, which have
// no creator on record and keep working the way they always did.
const mayDeleteHat = `(!data.child('createdBy').exists() || data.child('createdBy').val() === ${memberKeyExpression})`;
// Membership tested from the ROOT rather than from `data`, because the mirror
// feed sits outside the hats tree and has to reach back into it.
const isMemberOfHatAtRoot = `root.child('hats').child($title).child($hatKey).child('memberEmails').child(${memberKeyExpression}).exists()`;

const rules = {
  rules: {
    // Default deny. Everything below opens exactly one door.
    '.read': false,
    '.write': false,

    hats: {
      $title: {
        $hatKey: {
          '.read': `${signedIn} && ${isMember}`,
          // A member may write, though removing the WHOLE hat is reserved
          // for its creator (any member, for hats too old to know theirs).
          // Someone creating a hat that doesn't exist yet may also write,
          // provided they put themselves in the index — without that clause
          // you could create a hat you were unable to read.
          '.write': `${signedIn} && ((${isMember} && (newData.exists() || ${mayDeleteHat})) || (!data.exists() && ${becomesMember}))`,
          // A hat may never end up with nobody able to read it.
          '.validate': "!newData.exists() || newData.hasChild('memberEmails')"
        }
      }
    },

    // The Magic Mirror feed. The hallway display has no keyboard and no
    // login, so it cannot authenticate; it used to read a whole hat over
    // unauthenticated REST, which is exactly what the hats rules closed.
    // The app publishes just the latest pick here instead — see
    // src/assets/javascript/mirrorFeed.js.
    //
    // Keyed by title AND hatKey, mirroring the hats path, because that is the
    // only way a rule can reach the hat's memberEmails: rules cannot search
    // hats/*/$hatKey without knowing the title.
    //
    // Public read is granted at the $secret level ONLY. mirrorFeed.json and
    // mirrorFeed/<title>/<hatKey>.json are both refused, so no hat can be
    // enumerated through this and no feed can be found without its 128-bit
    // secret. The secret lives on the hat, readable only by its members.
    mirrorFeed: {
      '.read': false,
      $title: {
        '.read': false,
        $hatKey: {
          '.read': false,
          '.write': `${signedIn} && ${isMemberOfHatAtRoot}`,
          $secret: {
            '.read': true
          }
        }
      }
    },

    // Write-only, and open to the signed-out — see the header comment.
    bugReports: {
      $reportId: {
        '.write': '!data.exists() && newData.exists()',
        '.validate': "newData.hasChildren(['transcript', 'createdAt']) && newData.child('transcript').isString() && newData.child('transcript').val().length <= 5000"
      }
    },

    // "Which hats are mine." Yours to read and change freely. Anyone signed
    // in may CREATE an entry in someone else's index — that is what inviting
    // them means — but not alter or remove one that already exists, which
    // used to let any stranger erase anybody's whole hat list.
    userHats: {
      $memberKey: {
        '.read': `${signedIn} && $memberKey === ${memberKeyExpression}`,
        $entryKey: {
          '.write': `${signedIn} && ($memberKey === ${memberKeyExpression} || (!data.exists() && newData.exists()))`,
          '.validate': "!newData.exists() || newData.hasChildren(['title', 'hatKey'])"
        }
      }
    },

    // Push notification subscriptions (2026-08-28, Matt: "get a notification
    // when somebody draws a movie from a hat that you're in"). Each device's
    // web-push subscription, keyed by the member it belongs to; yours alone
    // to read and write. The sender (the movie-hat-push Lambda) reads these
    // with the Admin SDK, which bypasses rules entirely — nothing else ever
    // reads someone else's subscriptions.
    push: {
      $memberKey: {
        '.read': `${signedIn} && $memberKey === ${memberKeyExpression}`,
        '.write': `${signedIn} && $memberKey === ${memberKeyExpression}`
      }
    },

    // "Request this movie" (2026-09-08): a row per TMDb id asking the Mac
    // mini to add the movie to Radarr — see src/utils/requestMovie.js and
    // README.md, "Movie requests". Cinema Roll writes here too, through its
    // Movie Hat sign-in, so the service watches one node.
    //
    // Anyone signed in may read a row (the button shows what became of a
    // request, whoever made it) and may CREATE one — status 'pending', under
    // their own address, keyed by an integer TMDb id. Nobody may change a
    // row that is pending, processing, added or already in the library:
    // the key IS the duplicate check, and only the service (Admin SDK,
    // which bypasses these rules) moves `status` along. A row that ended in
    // 'error' may be written over — that is the retry — and nothing may be
    // deleted from the client.
    requests: {
      '.read': false,
      $tmdbId: {
        '.read': signedIn,
        '.write': `${signedIn} && newData.exists() && (!data.exists() || data.child('status').val() === 'error')`,
        '.validate': [
          "$tmdbId.matches(/^[1-9][0-9]{0,9}$/)",
          "newData.hasChildren(['tmdbId', 'title', 'status', 'source', 'requestedBy', 'createdAt'])",
          "newData.child('tmdbId').isNumber()",
          "newData.child('title').isString() && newData.child('title').val().length <= 300",
          "newData.child('status').val() === 'pending'",
          "(newData.child('source').val() === 'movie-hat' || newData.child('source').val() === 'cinema-roll')",
          "newData.child('requestedBy').val() === auth.token.email",
          "newData.child('createdAt').isNumber()"
        ].join(' && ')
      }
    }
  }
};

const path = new URL('../database.rules.json', import.meta.url).pathname;
writeFileSync(path, `${JSON.stringify(rules, null, 2)}\n`);

console.log(`Wrote ${path}`);
console.log('\nThe member-key transform the rules will apply:');
console.log(`  ${memberKeyExpression}`);
console.log('\nDeploy with:  firebase deploy --only database   (project movie-hat-9c418)');
console.log('Do it supervised — a bad rules deploy shows every user an empty app.');
