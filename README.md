# movie-hat

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn serve
```

### Compiles and minifies for production
```
yarn build
```

### Lints and fixes files
```
yarn lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

## Movie requests (Radarr on the Mac mini)

The drawn-movie screen has a **Request** button, shown only to the people
in `REQUESTER_EMAILS` (`src/assets/javascript/owner.mjs` — Matt, and Seth
since 2026-09-11; the rules enforce the same list, so nobody else can create
a row even by hand). To add someone, add their address to that list, then
`yarn generate-hat-rules && firebase deploy --only database`. It writes
one row to this project's Realtime Database and a Node service on the Mac
mini (not in this repo) does the rest. Cinema Roll will write to the same node through
its Movie Hat sign-in, so the service only watches one place.

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
  source:      'movie-hat' | 'cinema-roll'
  requestedBy: string   the signed-in email (rules check it matches the token)
  createdAt:   number   server timestamp, ms

  // Written by the service only:
  radarrId:    number
  radarrTitle: string
  year:        number
  processingAt: number  ms, when the service picked the row up
  processedAt: number   ms, when Radarr answered
  importedAt:  number   ms, when the downloaded file landed in the library
  error:       string   why it failed, shown to the user in the button's tooltip

  // Written by the push Lambda only:
  notifiedAt:  number   ms, when the requester was told the download finished
}
```

Only requesters' accounts can read or create rows. A row can only be created
with `status: 'pending'`, and only when no row exists for that id or the
existing one is `'error'` (that is the retry).
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

### "Your movie is ready" notifications

`aws-lambda/push-notify.js` also runs on an EventBridge schedule
(`movie-hat-push-sweep`, every two minutes). Each sweep reads `requests`,
and any row with an `importedAt` and no `notifiedAt` gets one push to
whoever `requestedBy` names ("Little Miss Sunshine is ready to watch"), then
a `notifiedAt` stamp. A row imported more than a day ago is stamped without
a notification, so a redeploy or an outage never announces a backlog.

Deploy rules with `yarn generate-hat-rules && firebase deploy --only database`.
