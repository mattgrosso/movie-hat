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
//   - `siteUsers/<uid>` is the Movie Requests gate: sign in anywhere and you
//     get a 'pending' row you cannot then edit into 'approved'. An admin
//     decides. An approved row is what lets `requests` accept a write, and
//     it is the ONLY thing besides the three hard-coded addresses that does.
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
import { OWNER_EMAIL, REQUESTER_EMAILS } from '../src/assets/javascript/owner.mjs';

// auth.token.email → the member key, in the rules language.
const memberKeyExpression = UNSAFE_KEY_CHARACTERS.reduce(
  (expression, character) => `${expression}.replace('${character}', '${KEY_REPLACEMENT_CHARACTER}')`,
  "auth.token.email.toLowerCase()"
);

const signedIn = "auth != null && auth.token.email != null";
// Matt, and only Matt. Google emails arrive in the token as the account has
// them (his is all lowercase), but lowercasing costs nothing.
const isOwner = `auth != null && auth.token.email != null && auth.token.email.toLowerCase() === '${OWNER_EMAIL}'`;
// The people allowed to ask the Mac mini for a download — the same list the
// button shows itself to.
const isRequester = `auth != null && auth.token.email != null && (${REQUESTER_EMAILS.map((email) => `auth.token.email.toLowerCase() === '${email}'`).join(' || ')})`;
// The OTHER way in, added 2026-09-18 for the standalone Movie Requests app
// (request.movie-hat.com): somebody Matt has approved by hand. The hard-coded
// list above is the three people who predate that app and stays as the
// belt-and-braces path; this one is a row in the database, so letting a new
// person in is a tap on Matt's phone rather than a rules deploy.
//
// `siteUsers` is not a name invented here. It is the Around Table Round
// games' gate, byte-for-byte the same shape (camel-up/src/store/siteAccess.js
// and its database.rules.json): `siteUsers/<uid>` holding email, displayName,
// status and isAdmin, a roster only an admin may list, and a push Lambda
// that watches for pending rows. That hub lives in a different Firebase
// project, so the node itself cannot be shared — but the vocabulary is, and
// anyone who has read one of these now knows the other.
const isApproved = "auth != null && root.child('siteUsers').child(auth.uid).child('status').val() === 'approved'";
// Who may see the waiting list and decide. A flag on the row, so Matt can
// hand it to somebody else without a rules deploy — he bootstraps himself
// below on first sign-in.
const isSiteAdmin = "auth != null && root.child('siteUsers').child(auth.uid).child('isAdmin').val() === true";
// Anyone who may ask the Mac mini for a download, by either route.
const mayRequest = `(${isRequester} || ${isApproved})`;
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

    // The reply to a bug report (2026-09-21, ported from Cinema Roll):
    // `yarn resolve-bug-report` writes a plain-language notice here under the
    // reporter's member key, and BugResolutionNotice (Movie Hat and Movie
    // Requests both) shows it on their next launch; each notice names its
    // app. Only the reporter can read their own; the only client write is
    // flipping `seen`. The text is written by the Admin SDK, never a client.
    bugReportResolutions: {
      $memberKey: {
        '.read': `${signedIn} && $memberKey === ${memberKeyExpression}`,
        $reportId: {
          seen: {
            '.write': `${signedIn} && $memberKey === ${memberKeyExpression} && newData.isBoolean()`
          }
        }
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

    // Who may use the standalone Movie Requests app (2026-09-18,
    // request.movie-hat.com). Anyone can sign in with Google there; signing
    // in only writes a row HERE, asking to be let in. Matt approves or
    // denies it from the app's admin screen, and `isApproved` above is what
    // turns an approved row into the right to ask for a download.
    //
    // The shape is the Around Table Round hub's `siteUsers`, deliberately —
    // see the comment on isApproved.
    //
    // Keyed by auth.uid rather than email: the row IS the permission, so it
    // has to be keyed by something the token carries verbatim and nobody can
    // choose. An email has to be mangled into a Firebase key, and two
    // different manglings colliding would hand one person another's access.
    //
    // The four ways a write is allowed, in order below:
    //   1. Matt's first sign-in writes himself in as an approved admin.
    //      Bootstrapping the first admin needs SOME door, and a verified
    //      Google address is the only thing available before any row exists.
    //      It is `auth.token.email`, which Google signs — not a claim the
    //      client makes.
    //   2. A newcomer creates their OWN row, once, as pending and not admin.
    //   3. That same person may keep their own row's details fresh — a
    //      changed display name, say — provided status and isAdmin come out
    //      exactly as they went in. That last clause is the whole gate:
    //      without it anyone could sign in and write themselves 'approved'.
    //   4. An admin may write anything, which is what approving is.
    siteUsers: {
      // Listing everyone is the admin screen. `isOwner` rides alongside so
      // Matt can open it on a device whose row hasn't been written yet.
      '.read': `${isSiteAdmin} || ${isOwner}`,
      $uid: {
        // You may always read your own row — that is how the app knows to
        // show you "waiting on Matt" rather than the search screen.
        '.read': `${isSiteAdmin} || ${isOwner} || (auth != null && auth.uid === $uid)`,
        '.write': [
          `(auth != null && auth.uid === $uid && !data.exists() && ${isOwner} && newData.child('status').val() === 'approved' && newData.child('isAdmin').val() === true)`,
          "(auth != null && auth.uid === $uid && !data.exists() && newData.child('status').val() === 'pending' && newData.child('isAdmin').val() === false)",
          "(auth != null && auth.uid === $uid && data.exists() && newData.exists() && newData.child('status').val() === data.child('status').val() && newData.child('isAdmin').val() === data.child('isAdmin').val())",
          isSiteAdmin
        ].join(' || '),
        '.validate': [
          "!newData.exists()",
          `(${[
            "newData.hasChildren(['email', 'status', 'isAdmin', 'requestedAt'])",
            "newData.child('email').isString() && newData.child('email').val().length <= 200",
            "(newData.child('status').val() === 'pending' || newData.child('status').val() === 'approved' || newData.child('status').val() === 'denied')",
            "newData.child('isAdmin').isBoolean()",
            "newData.child('requestedAt').isNumber()",
            // A row must name the address on its owner's own token. An admin
            // writing somebody else's row is exempt — they are not the owner.
            `(${isSiteAdmin} || auth.uid !== $uid || newData.child('email').val() === auth.token.email)`
          ].join(' && ')})`
        ].join(' || ')
      }
    },

    // "Request this movie" (2026-09-08): a row per TMDb id asking the Mac
    // mini to add the movie to Radarr — see src/utils/requestMovie.js and
    // README.md, "Movie requests". Cinema Roll writes here too, through its
    // Movie Hat sign-in, so the service watches one node.
    //
    // MATT ONLY (his call, 2026-09-09: "I only want this button available
    // to me"). A request fills the disk on his Mac mini, so the owner's
    // address — hard-coded in owner.mjs, the same constant the app hides
    // the button behind — is the only one that may read (or list) or
    // create a row — Matt, and anyone he has added to REQUESTER_EMAILS.
    // Creating means status 'pending', under their own address, keyed by an
    // integer TMDb id. Nothing may change a row that is pending,
    // processing, added or already in the library: the key IS the
    // duplicate check, and only the service (Admin SDK, which bypasses
    // these rules) moves `status` along. A row that ended in 'error' may
    // be written over — that is the retry — and nothing may be deleted
    // from the client.
    //
    // One optional extra field: `force: true`, which only the owner may
    // write. See README.md, "Forcing a request past the Plex hold".
    requests: {
      // The home page reads the whole node once to label every drawn
      // movie, rather than one read per movie.
      '.read': mayRequest,
      $tmdbId: {
        '.write': `${mayRequest} && newData.exists() && (!data.exists() || data.child('status').val() === 'error')`,
        '.validate': [
          "$tmdbId.matches(/^[1-9][0-9]{0,9}$/)",
          "newData.hasChildren(['tmdbId', 'title', 'status', 'source', 'requestedBy', 'createdAt'])",
          "newData.child('tmdbId').isNumber()",
          "newData.child('title').isString() && newData.child('title').val().length <= 300",
          "newData.child('status').val() === 'pending'",
          "(newData.child('source').val() === 'movie-hat' || newData.child('source').val() === 'cinema-roll' || newData.child('source').val() === 'movie-requests')",
          "newData.child('requestedBy').val() === auth.token.email",
          "newData.child('createdAt').isNumber()",
          // `force: true` (2026-09-18) tells the service to bring the VPN up
          // and start the download even while somebody is watching Plex, so
          // it is the owner's alone. The field is optional: a row without it
          // behaves exactly as every row did before. `false` is not a value —
          // leave it off instead, so the service never has to tell the two
          // apart.
          `(!newData.hasChild('force') || (newData.child('force').isBoolean() && newData.child('force').val() === true && ${isOwner}))`
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
