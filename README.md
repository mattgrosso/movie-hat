# movie-hat

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn serve
```
Vite's dev server, on the old Vue CLI port 8080 and bound to every
interface (so the phone on the LAN can reach it). It restarts itself when
`.env` changes.

### Compiles and minifies for production
```
yarn build
```
`yarn build` never bumps the version — it builds whatever `VUE_APP_VERSION`
`.env` holds, so check builds are free. `yarn deploy` runs
`scripts/bump-and-build.mjs`, which bumps first and rolls the bump back if
the build fails.

Before any of that, `scripts/preflight.mjs` runs `yarn lint` and `yarn
test:run` and stops the deploy if either fails — there is no CI, so this is
the only thing standing between a red tree and the phones. `SKIP_CHECKS=1
yarn deploy` bypasses it for a hotfix when the suite itself is what's broken.
The emulator rules tests (`yarn test:emulated`) are not part of it. One of
the tests checks `database.rules.json` is exactly what
`yarn generate-hat-rules` produces, so a hand edit or a forgotten re-run
fails the deploy too.

### Previews the production build
```
yarn preview
```

### Lints and fixes files
```
yarn lint
```

### Build configuration
Vite (`vite.config.mjs`), since 2026-09-14 — it replaced Vue CLI 5/webpack
(`vue.config.js`, `babel.config.js`). That file explains each choice, but the
three worth knowing:

- Every `process.env.VUE_APP_*` / `process.env.BASE_URL` read in `src/` is
  statically replaced via Vite's `define`, exactly as webpack's DefinePlugin
  did, so the house modules stay byte-identical to Cinema Roll's.
- The entry bundle is deliberately named `js/app.<hex hash>.js`, because
  `App.vue`'s update check matches that pattern off `index.html`.
- `vite-plugin-pwa` generates `service-worker.js` (that exact name — every
  installed phone checks it for updates) and pulls in `public/push-sw.js`
  via `importScripts`. `public/manifest.json` is a committed static file: it
  is what `@vue/cli-plugin-pwa` used to generate, byte-for-byte, and the
  `<head>` tags that plugin injected are now hand-written in `index.html`
  (at the repo root, not `public/`).
- **Launch splash** (2026-10-20, same as Cinema Roll's): `index.html`
  paints the page blue inline and puts a `.launch-splash` (icon + "Movie
  Hat") inside `#app`, which Vue's mount replaces. iOS launch images live in
  `public/img/launch/` (not precached), drawn by
  `scripts/generate-launch-images.mjs` — its header has the exact commands,
  including cutting the white corners off the icon. Guarded by
  `src/test/launchSplash.test.mjs`.
- **The hat opens from the phone's copy** (2026-10-22, "loading my hat has
  been really slow"): the last read of the current hat is kept in
  localStorage (`movieHat.hatCache`, `src/assets/javascript/hatCache.js`)
  and shown from the first render while getHat reads the database. It is
  shown only when its email and hat key both match, thrown away on sign-out
  or a different account, and Draw stays disabled until the fresh read
  lands (`hatIsFresh`). Guarded by `src/test/hatCache.test.mjs`.

## Movie requests (Radarr on the Mac mini)

The drawn-movie screen has a **Request** button, shown only to the people
in `REQUESTER_EMAILS` (`src/assets/javascript/owner.mjs` — Matt, Seth and
Brian; the rules enforce the same list, so nobody else can create
a row even by hand). To add someone, add their address to that list, then
`yarn generate-hat-rules && firebase deploy --only database`. It writes
one row to this project's Realtime Database and a Node service on the Mac
mini (not in this repo) does the rest. Cinema Roll will write to the same node through
its Movie Hat sign-in, so the service only watches one place.

**Since 2026-09-18 that list is no longer the only way in.** The standalone
**Movie Requests** app (`~/code/movie-requests`, request.movie-hat.com) signs
into this project and writes to this same `requests` node, and the people it
lets in are named in the database rather than in `owner.mjs` — see
"Who else may request" below. Nothing about Movie Hat's own button changed;
`REQUESTER_EMAILS` still works exactly as it did, with no row needed.

### Both of that app's screens live here too

Matt's ask, the same day: "it can all live in that single app instead of
having a second icon on my home screen." So Movie Hat carries them:

| screen | route | who sees it |
| --- | --- | --- |
| **Movie requests** (`RequestAMovie.vue`) | `/request` | `mayRequestMovies` |
| **Who gets in** (`AccessRequests.vue`) | `/access` | `mayApproveAccess` |

Both are header pills, both lazy-loaded like `/peek`, and both are bounced by
a `router.beforeEach` guard in `main.js` if the URL is typed by somebody who
may not open them. The guard waits on `siteUserResolved` first — the
permission arrives asynchronously after sign-in, so without that wait a
refresh on `/request` bounces you home.

`/request` is **not** the drawn-movie Request button. That one sits beside a
movie already in a hat; this one searches all of TMDb, so a film nobody has
ever put in a hat can be asked for.

`store.getters.mayRequestMovies` and `mayApproveAccess` are the single source
for "who may do this" — the button, the pills, the screens and the guard all
ask them, so they cannot disagree.

**Movie Hat reads the `siteUsers` row; it does not create one.** In Movie
Requests, signing in IS asking to be let in. Here, signing in is just using
Movie Hat, and most people who do are family members in a hat who have never
heard of movie requests — writing each of them a pending row would fill the
waiting list with people who never asked for anything. The only exception is
Matt's own bootstrap row (`loadSiteUser`), which is how he becomes an admin
without opening the other app. `src/test/siteUserLoad.test.mjs` pins that.

The client side is `src/utils/requestMovie.js` (shared with Cinema Roll —
keep the two copies identical) and `src/components/RequestMovieButton.vue`.
The button polls the row over REST: every 2.5s for the first three minutes,
then every 30s for as long as the row is `pending`/`processing` — the
service holds a request while someone is watching Plex, which can be a whole
film. Polling pauses while the page is hidden and reads at once when it
comes back to the foreground.
The rules live in `scripts/generate-hat-rules.mjs` under `requests`.

### The row

```
requests/<tmdbId>: {
  tmdbId:      number   integer TMDb id, same as the key (the KEY is the id of record)
  title:       string
  status:      'pending' | 'processing' | 'added' | 'exists' | 'error'
  source:      'movie-hat' | 'cinema-roll' | 'movie-requests'
  requestedBy: string   the signed-in email (rules check it matches the token)
  createdAt:   number   server timestamp, ms
  force:       true     optional, Matt only — see "Forcing a request past the Plex hold"
  release:     { infoHash, title }   optional — a version picked in the panel;
                        see "Choosing a version"

  // Written by the service only:
  radarrId:    number
  radarrTitle: string
  year:        number
  processingAt: number  ms, when the service picked the row up
  processedAt: number   ms, when Radarr answered
  importedAt:  number   ms, when the downloaded file landed in the library
  error:       string   why it failed, shown to the user in the button's tooltip
  progress:    number   0–100 while downloading, from the furthest-along queued copy
  etaAt:       number   ms, that copy's estimated finish (Radarr's guess; swings a lot)
  heldBy:      'plex' | 'disk' | 'stuck'   torrent stopped on purpose; absent = unknown
                        (these three: written on the service's 60s tick only when the
                        percent or heldBy changes, removed on import or give-up —
                        see downloadProgress in src/utils/requestMovie.js)
  stage:       'searching' | 'downloading' | 'importing' | 'backorder'   on an 'added'
                        row that hasn't landed; absent reads as downloading
  backorderedAt: number ms, when the search first ran out and the row went on
                        back order. Never removed, so the ready push can say "finally"
  nextCheckAt: number   ms, when a back-ordered row is next searched for

  // Written by the push Lambda only:
  notifiedAt:      number   ms, when the requester was told the download finished
  ownerNotifiedAt: number   ms, when the admins were told the request exists
}
```

Only requesters' accounts can read or create rows. A row can only be created
with `status: 'pending'`, and only when no row exists for that id or the
existing one is `'error'` (that is the retry).

### Forcing a request past the Plex hold

Normally the Mac mini service waits: it will not bring the VPN up and start a
download while somebody is watching Plex, which is why a row can sit
`pending` for the length of a film. `force: true` on the row tells it not to
wait — the VPN comes up and the torrent starts now, over the top of whoever
is watching. The service caps how long a forced download may run
(`FORCE_MAX_HOURS` there), so it cannot hold the connection open all night.

Two rules about the field, both enforced in
`scripts/generate-hat-rules.mjs`:

- **Matt's alone.** `requests/<tmdbId>` accepts `force` only from
  `OWNER_EMAIL`. Seth, Brian and anyone approved through `siteUsers` may
  request as before, and a forced write from them is rejected outright —
  which means the request never arrives at all, not that it arrives unforced.
- **`true` or absent, never `false`.** Omitting the field behaves exactly as
  every row did before this existed, so the service never has to tell "not
  forced" from "explicitly not forced". `buildRequest` in
  `src/utils/requestMovie.js` leaves it off unless it was asked for.

`canForce(email)` is the client-side half, and `useRequestMovie` exposes it
as `forceable` — that is what decides whether the option is drawn at all.
Hiding a button is not a permission, so the rules are the thing that
actually holds; `src/test/emulated/siteUsersRules.test.js` pins both halves.

Matt, 2026-09-18: "I won't use it all the time, and it's only for me, but I
want a way to force it."

**Force comes AFTER the request** (2026-09-25: "the force through button
should only show up after I've clicked the request button and should replace
it"). The button offers only Request; once the row is `pending` (held for
Plex), the spent "Requested" button becomes "Force it through", which writes
just `requests/<tmdbId>/force: true` onto the waiting row. The rules grant
that one write to the owner while the row is still `pending` and unforced —
on anybody's request, leaving it theirs. **The Mac mini service must honour a
force that arrives after the row was created**: re-read `force` whenever it
re-checks a held row (or listen for `child_changed`), not only at pickup.

### Choosing a version

2026-10-15, after Dawn of the Dead arrived as the 154-minute cut when Matt
wanted the 127-minute theatrical one: "when I request a movie here, I could
see various cuts, lengths, and versions, and choose the correct one if I
wanted to." Under the Request button sits **Choose a version** (or **Get a
different version** on a film already in the library). Opening it asks the
Mac mini what exists, before anything is requested:

```
versionQueries/<tmdbId>: {
  requestedBy: string   the asker's email   } written by the client, and
  requestedAt: number   server timestamp    } nothing else may be
  // Written by the service only:
  status:    'searching' | 'ready' | 'error'
  updatedAt: number   ms; an answer counts only if it is newer than the ask
  error, title, year, runtime
  indexers:  { complete, pending, searched, missing }   complete: false while a slow
                                          indexer is still to answer
  releases/<infoHash>: { title, size, seeders, quality, indexer, cut?, blocked? }
}
```

The service answers each new `requestedAt` once (a search hits real
indexers), publishing the fast indexers first and the stragglers after.
`blocked` names what the quality profile would refuse; the panel still
offers those, dimmed, under "Other versions", because a deliberate pick may
override the profile. Run time isn't in most release names, so the panel
shows TMDb's runtime and lets file size hint at a longer cut.

The pick goes on the request row as `release`, and the service grabs exactly
that release instead of letting Radarr search. On a film already in the
library a request is allowed again only with `release` — that is the
replacement, and the new file takes the old one's place when it arrives.
Picking is optional: close the panel and Request works as it always did.
Helpers and shapes: the versions section of `src/utils/requestMovie.js`;
rules: `versionQueries` in `scripts/generate-hat-rules.mjs`.

### Who else may request (`siteUsers`)

`requests` accepts a write from one of `REQUESTER_EMAILS` **or** from anyone
whose `siteUsers/<uid>` row says `status: 'approved'`. That node is the gate
behind the standalone Movie Requests app:

```
siteUsers/<uid>: {
  email:       string   the signed-in address (rules check it matches the token)
  displayName: string   optional, whatever Google reported
  photoURL:    string   optional
  status:      'pending' | 'approved' | 'denied'
  isAdmin:     boolean  may list the roster and decide
  requestedAt: number   server timestamp, ms
  decidedAt:   number   ms, when an admin answered
  notifiedAt:  number   ms, when the admins were told (push Lambda only)
}
```

A stranger may create their OWN row, once, as `pending` and not admin, and
may afterwards only edit fields that are not `status` or `isAdmin`. An admin
may write anything. Matt's first sign-in may write himself in approved and
admin — bootstrapping the first admin needs some door, and his
Google-verified address is the only thing available before any row exists.

The node name, fields and `isAdmin` flag are the Around Table Round games'
`siteUsers` (`camel-up/src/store/siteAccess.js`), reused deliberately; that
hub is a different Firebase project so the node itself is not shared.

`src/test/emulated/siteUsersRules.test.js` is where this is actually pinned —
twenty cases against a real emulator. Run them with `yarn test:emulated`.
The rules refuse everything else, which is what makes the key a duplicate
check. Clients cannot delete rows.

### What the service must do

1. Watch `requests` with the Admin SDK (a service account for
   `movie-hat-9c418`; it bypasses the rules) — `orderByChild('status').equalTo('pending')`
   with a `child_added` listener picks up new rows and, on restart, any it
   missed.
2. Set `status: 'processing'` first, so two service instances don't both act.
3. Look the movie up in Radarr by TMDb id. If it's already there, set
   `status: 'exists'`; otherwise add it (monitored, search on add) and set
   `status: 'added'`. Either way write `radarrId`, `radarrTitle`, `year`,
   `processedAt`.
4. On any failure set `status: 'error'` and a short human `error`. The
   button offers a retry, which overwrites the row with a fresh `'pending'`.
5. `requestedBy` is always one of `REQUESTER_EMAILS`; the rules see to it.
6. When the file is imported, set `importedAt`. That is what the
   finished-download notification keys on.
7. **Never give up on a film nobody has a copy of — back order it**
   (Matt, 2026-10-26: "if it doesn't find it after X number of hours, then
   it puts it into a queue and then we just check every X days … when it
   does, it'll be a fun surprise for whoever requested it"). When the
   search window runs out with no copy grabbed, do NOT set `'error'` and do
   NOT raise a `request-failed` alert. Leave the film monitored in Radarr,
   keep `status: 'added'`, and write `stage: 'backorder'`,
   `backorderedAt` (first time only) and `nextCheckAt` = now + 3 days
   (`BACKORDER_RECHECK_DAYS` in `src/utils/requestMovie.js`). Past
   `nextCheckAt`, ask Radarr to search again (its MoviesSearch command) and
   push `nextCheckAt` on another 3 days. Once a copy is grabbed, set
   `stage` back to `'downloading'` and carry on as usual: `importedAt`
   brings the push, which reads "<film> is finally here!" because
   `backorderedAt` is still on the row. A film that isn't released yet
   (the `not-released` reason) is the same case and goes on back order too.
   Movie Hat and Movie Requests already show "On back order" with the next
   look date, and keep the row open; nothing on the client side needs the
   service to do anything else.

### Draw notifications, and which hats send them

The bell in the header subscribes THIS DEVICE: without it nothing arrives at
all, on that device, ever. Since 2026-09-20 there is a second, narrower dial —
a switch on every hat in the hat list (Matt's report -P20Hn9jIGLCIIRyydRL: "I
should be able to turn on or off notifications per hat, not just for the whole
app").

It is stored as a MUTE list, `push/<memberKey>/mutedHats/<hatKey>: true`, and
that direction matters: a hat nobody has had an opinion about still notifies,
the way every hat did before the setting existed, and so does a hat somebody
adds you to next week. An allow list would have gone live by silencing
everyone's hats at once.

The list sits beside the subscriptions rather than in `localStorage` because
the preference belongs to the member, not the device — mute a hat on the phone
and the iPad stops announcing it too. `aws-lambda/push-notify.js` checks the
same path in its `/push/drawn` fan-out, and that check is what actually stops
the send: the person drawing has no business knowing everyone else's settings,
let alone being trusted to honour them. The switch is hidden on a hat with one
member, which has nobody to be notified by.

Ship a change to that Lambda with `sh scripts/deploy-push-lambda.sh`.

### "Somebody asked for a movie" notifications

2026-09-18, Matt: "I just want to be notified that somebody made a request
and that the system is acting on it." The same sweep announces each new
`requests` row to every admin once, then stamps `ownerNotifiedAt`.

Purely informational — there is nothing to approve, so the notification
carries no action and simply opens `/#/request`, which is why that screen
shows an admin **everyone's** requests rather than only their own.

Two things keep it from being noise. An admin is never told about their own
request (Matt pressing the button and then being notified that Matt pressed
the button is how people learn to turn notifications off). And a row created
more than `REQUEST_NEWS_WINDOW_MS` ago is stamped without announcing, which
is what stopped the first run telling him about every request ever made — it
announced one, stamped eleven, skipped one.

The body is written from the row's status at sweep time, not at creation, so
it says what the Mac mini has actually done: waiting for Plex to be free,
Radarr picking it up, downloading, already in the library, or the error.

### When the Mac mini can't fix something

2026-10-17, Matt asked for a notification "when a request fails, so he knows
to come and sort it out". The Mac mini service writes (Admin SDK only; the
rules give readers of `plexLibrary` read access and nobody a write):

    alerts/<id>        id = request-<tmdbId> | film-<radarrMovieId>
      kind             'request-failed' | 'film-unrepairable'
      title            the film
      message          final copy, shown as the notification body
      tmdbId           or null for a library film with no request
      requestedBy      on request-failed
      reason           'not-released' when it failed only because no copy can exist yet
      at               when the failure happened
      createdAt        when it was last raised (the latest failure; the 24h guard reads it)

A write means the failure is new; the node is removed when it stops being
true. The `movie-hat-push` sweep (every 2 minutes) pushes each alert to every
admin's Movie Hat once per `at`, remembering what it sent in `alertsPushed/<id>`
(Admin only) so the alert itself stays the mini's. Alerts first seen more than a
day after they were raised are stamped, not sent.

### On Plex

2026-10-14, Matt: "one of the possible places that it could already be is on
my Plex server … include it as a first option if it's already there". The
streaming strip (drawn movie, and the details behind every drawn poster) puts
a **Watch · Plex** badge first when the movie is on the server, opening Plex
the same way the "Watch in Plex" button does. Only for whoever may request;
nobody else can watch it there.

The browser can't see Plex, so **the Mac mini service has to publish the
library** (with the Admin SDK — the rules give nobody a write):

    plexLibrary/movies/<tmdbId>: true    one per movie Plex has
    plexLibrary/updatedAt: number        ms, when it was written

Rewrite the whole `plexLibrary` node every few minutes (one PUT, so movies
removed from Plex drop out). The TMDb ids come from Plex's own GUIDs
(`tmdb://…`) or from Radarr's movie list. The app reads one movie's entry at
a time, so the list's size costs nothing per look.

Until that exists, a `requests` row that is `exists`, or `added` with an
`importedAt`, counts as on Plex — see `src/utils/plexLibrary.js`.

### "Your movie is ready" notifications

`aws-lambda/push-notify.js` also runs on an EventBridge schedule
(`movie-hat-push-sweep`, every two minutes). Each sweep does two things; the
second, "somebody wants into Movie Requests", is described in that repo's
README. The first reads `requests`,
and any row with an `importedAt` and no `notifiedAt` gets one push to
whoever `requestedBy` names ("Little Miss Sunshine is ready to watch"), then
a `notifiedAt` stamp. A row imported more than a day ago is stamped without
a notification, so a redeploy or an outage never announces a backlog.

Tapping it opens the request screen with `?ready=<tmdbId>` (`/#/request` in
Movie Hat, `/#/` in Movie Requests), which puts that movie on top with a big
"Watch in Plex" button. A notification can't open Plex itself — on iOS it
always opens the app that sent it. The button opens Plex's home screen, not
the movie: a link to one title needs the Plex server's id and the library's
key for it, and nothing here knows either.

The notification goes to the subscriptions of the app the row's `source`
names — `push/<memberKey>/subscriptions` for Movie Hat, and
`push/<memberKey>/requestsAppSubscriptions` for Movie Requests. The
"somebody wants in" notification is the other way round: it tries **Movie
Hat first** and only falls back to the standalone app's subscriptions,
because the waiting list is a screen here now and an admin should need only
the one app installed. Sending to
the wrong set is not a delivery failure; it delivers, to the wrong app, and
on iOS a notification whose URL is outside the installed app's scope opens in
an in-app browser rather than the app.

Deploy rules with `yarn generate-hat-rules && firebase deploy --only database`.

### One canonical origin (`infra/canonical-host.js`)

CloudFront distribution `EBSAAKUEVN304` answers for both `movie-hat.com` and
`www.movie-hat.com`. Until 2026-09-17 it served the app on both with no
redirect, and two origins mean two PWA scopes: installing from each gave a
separate Home Screen icon (iOS names the second one "Movie Hat 2", which is
the "hat" one bug report saw in a notification header), each with its own
storage and its own push subscription. It also broke notification taps —
`APP_URL` pointed at `www`, so a tap landed outside the installed app's scope
and iOS opened it in an in-app browser instead of the app.

**`movie-hat.com` is canonical.** It is where the app is installed from and
what the invite email in `HatsList.vue` points at. A CloudFront Function
(`movie-hat-canonical-host`, runtime `cloudfront-js-2.0`) runs on
viewer-request and 301s any `www` request to the bare domain, path and query
preserved; every other host passes through untouched.

Redeploy the function after editing:

```
aws cloudfront describe-function --name movie-hat-canonical-host --profile personal   # for the ETag
aws cloudfront update-function --name movie-hat-canonical-host --if-match <etag> \
  --function-config Comment="Redirect www.movie-hat.com to the canonical bare domain",Runtime=cloudfront-js-2.0 \
  --function-code fileb://infra/canonical-host.js --profile personal
aws cloudfront publish-function --name movie-hat-canonical-host --if-match <new etag> --profile personal
```

`aws cloudfront test-function` takes a viewer-request event object and is
worth running before publishing — the function sits in front of every request
to the site.
