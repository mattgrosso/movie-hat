<template>
  <div class="header-wrapper">
    <!-- The top row: one menu on the left, the hat on the right (swapped
         from hat-left on request, 2026-10-11). It used to
         be a row of separate icon pills (account, bell, access, request,
         peek) beside the hat name, which on a phone read as lopsided once
         the email pill shrank to an icon (bug report, 2026-10-09). Every
         one of those now lives in this menu, each shown to exactly the
         people who saw its pill. -->
    <div class="user-and-hat-pills d-flex justify-content-between align-items-center">
      <div v-if="$store.state.email" class="header-menu dropdown">
        <button
          type="button"
          class="header-menu__toggle badge rounded-pill text-bg-dark border-0"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          :aria-label="pendingAccessCount ? `Menu, ${pendingAccessCount} waiting to be let in` : 'Menu'"
        >
          <!-- Inline, because bootstrap-icons is installed but its CSS is
               never imported. -->
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-list" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
          </svg>
          <!-- Somebody is waiting on Movie Requests: the alert the access
               pill's count used to carry, now that the pill is folded away. -->
          <span v-if="pendingAccessCount" class="header-menu__dot"></span>
        </button>
        <ul class="dropdown-menu">
          <li>
            <span class="dropdown-item-text small text-body-secondary text-break">Signed in as {{ $store.state.email }}</span>
          </li>
          <li><hr class="dropdown-divider"></li>
          <!-- Draw notifications (2026-08-28). Subscribes THIS device to a
               push whenever someone draws from a hat you're in; tap again to
               unsubscribe. Shown only when the push API is configured; on an
               iOS Safari tab (not installed) the tap explains the Home Screen
               requirement instead of silently failing. The tap IS the
               permission gesture — iOS requires that.

               This is the device switch, and it stayed that: since 2026-09-20
               each hat has its own switch on the hat list, which narrows what
               this delivers rather than replacing it. -->
          <li v-if="showPushBell">
            <button type="button" class="dropdown-item" @click="togglePush">
              <svg v-if="pushOn" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-bell-fill" viewBox="0 0 16 16">
                <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2m.995-14.901a1 1 0 1 0-1.99 0A5 5 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7a5 5 0 0 0-4.005-4.901"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-bell" viewBox="0 0 16 16">
                <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6"/>
              </svg>
              {{ pushOn ? 'Draw notifications: on' : 'Draw notifications: off' }}
            </button>
          </li>
          <!-- "Request a movie": search all of TMDb and ask for a download,
               without going near a hat. Shown to whoever may request — the
               hard-coded three, or anyone Matt has approved. -->
          <li v-if="canRequestMovies">
            <button type="button" class="dropdown-item" @click="$router.push('/request')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
              </svg>
              Request a movie
            </button>
          </li>
          <!-- The waiting list for the standalone Movie Requests app
               (2026-09-18). Admins only — everybody else never learns the
               screen exists, and the database refuses the read regardless. The
               count is people waiting on a decision; no badge when nobody is. -->
          <li v-if="canApproveAccess">
            <button type="button" class="dropdown-item" @click="$router.push('/access')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-person-check-fill" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M15.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 0 1 .708-.708L12.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0"/>
                <path d="M1 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/>
              </svg>
              Who gets movie requests
              <span v-if="pendingAccessCount" class="badge rounded-pill text-bg-danger ms-1">{{ pendingAccessCount }}</span>
            </button>
          </li>
          <!-- The way into /peek. Rendered only for the owner, so nobody else is
               offered a button that spoils their own hat. Same caveat as the
               screen it opens: this is a client-side check in a public bundle,
               not a security boundary — see src/assets/javascript/peek.js. -->
          <li v-if="canPeek">
            <button type="button" class="dropdown-item" @click="$router.push('/peek')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-eye-fill" viewBox="0 0 16 16">
                <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"/>
                <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7"/>
              </svg>
              Peek in the hat
            </button>
          </li>
          <li><hr class="dropdown-divider"></li>
          <!-- Straight out, no "are you sure" box: it's two taps deep in a
               menu now, which is confirmation enough. -->
          <li>
            <button type="button" class="dropdown-item" @click="logOut">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-box-arrow-right" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"/>
                <path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/>
              </svg>
              Log out
            </button>
          </li>
        </ul>
      </div>
      <div
        v-if="$store.state.movieHatTitle"
        class="current-hat badge rounded-pill text-bg-dark"
        :title="$store.state.movieHatTitle"
        @click="$router.push('/hat-list')"
      >
        <p class="text-white m-0">
          {{$store.state.movieHatTitle}}
        </p>
      </div>
      <span v-else></span>
    </div>
    <div class="header d-flex justify-content-center align-items-center">
      <h1 class="col-12 d-flex justify-content-center" @click="$router.push('/');">
        <span>
          Movie Hat
        </span>
        <div class="mat"></div>
      </h1>
      <span class="build-stamp" role="button" title="Tap to reload" @click="reloadApp">{{ refreshing ? 'reloading…' : buildStamp }}</span>
    </div>

  </div>
</template>

<script>
import { getAuth, signOut } from 'firebase/auth';
import { buildStamp, forceRefresh } from '../utils/buildStamp.js';
import { isOwner } from '../assets/javascript/peek.js';
import { pushApiConfigured, deviceSubscribed, subscribeThisDevice, unsubscribeThisDevice } from '../utils/push.js';
import { pendingList } from '../utils/siteAccess.js';
import { dbGet } from '../store/db.js';

export default {
  data () {
    return {
      refreshing: false,
      pushOn: false,
      pendingAccessCount: 0,
    };
  },
  async mounted () {
    this.pushOn = await deviceSubscribed();
    this.countPendingAccess();
  },
  watch: {
    // The row arrives asynchronously after sign-in, so the count has to wait
    // for it rather than being read once on mount.
    canApproveAccess (may) {
      if (may) this.countPendingAccess();
      else this.pendingAccessCount = 0;
    }
  },
  computed: {
    showPushBell () {
      return Boolean(this.$store.state.email) && pushApiConfigured();
    },
    canPeek () {
      return isOwner(this.$store.state.email);
    },
    canRequestMovies () {
      return this.$store.getters.mayRequestMovies;
    },
    canApproveAccess () {
      return this.$store.getters.mayApproveAccess;
    },
    // The house build stamp — "v1.7.1 · built Aug 22, 1:32 AM". Was the bare
    // version number; the version alone can't tell you whether the tab in
    // front of you picked up the deploy you just did.
    buildStamp () {
      return buildStamp();
    },
  },
  methods: {
    // The stamp is the reload button: an installed PWA has no other one.
    reloadApp () {
      this.refreshing = true;
      forceRefresh();
    },
    /**
     * How many people are waiting to be let into Movie Requests. Silent on
     * failure: a refused read means the pill simply carries no badge, which
     * is exactly what "nobody is waiting" looks like — and the only people
     * who can read it are the ones the badge is for.
     */
    async countPendingAccess () {
      if (!this.canApproveAccess) {
        this.pendingAccessCount = 0;
        return;
      }
      try {
        this.pendingAccessCount = pendingList(await dbGet('siteUsers')).length;
      } catch {
        this.pendingAccessCount = 0;
      }
    },
    async togglePush () {
      try {
        if (this.pushOn) {
          await unsubscribeThisDevice();
          this.pushOn = false;
        } else {
          await subscribeThisDevice();
          this.pushOn = true;
        }
      } catch (error) {
        // subscribeThisDevice throws human-readable messages by contract
        // (install hint, blocked permission); the app's error banner is the
        // one message channel every screen already has.
        this.$store.commit('setAppError', error.message);
      }
    },
    async logOut () {
      this.$store.commit('setEmail', null);
      this.$store.commit('setName', null);

      // The part that was missing: without this, Firebase still had a live
      // session, the sign-in gate still saw a user, and "Log Out" closed the
      // modal and did nothing at all.
      try {
        await signOut(getAuth());
      } catch (error) {
        console.error('Sign-out failed', error);
      }
    }
  },
}
</script>

<style lang="scss">
  .header-wrapper {
    position: relative;

    .header {
      position: relative;
      h1 {
        background: white;
        border: 12px solid black;
        box-shadow: inset 0px 0px 9px 0px #424242;
        font-family: "Monoton", cursive;
        height: 150px;
        margin: 6px;
        overflow: hidden;
        position: relative;
        width: calc(100% - 12px);

        span {
          align-items: center;
          background: black;
          color: #6ba2dc;
          display: flex;
          font-size: 2.5rem;
          height: 100%;
          justify-content: center;
          padding: 24px 64px;
          white-space: nowrap;
          width: 100%;
        }

        .mat {
          border: 24px solid white;
          bottom: 0;
          left: 0;
          position: absolute;
          right: 0;
          top: 0;
        }
      }

      /* The house build stamp: present, readable, never competing for
         attention. Sits just under the marquee on the blue page background,
         where the bare version number used to. */
      .build-stamp {
        bottom: 0px;
        color: white;
        font-size: 0.5rem;
        font-variant-numeric: tabular-nums;
        opacity: 0.85;
        position: absolute;
        right: 8px;
        transform: translateY(6px);
        white-space: nowrap;
      }
    }

    .user-and-hat-pills {
      /* iOS 26+ paints a Liquid Glass blur band over the top edge of an
         installed web app, regardless of the 'black' status-bar style. The
         pills used to sit at 6px from pixel 0, i.e. inside that band, which
         washed them out. Clear the inset before adding our own 6px.
         --band-top's margin over the band is deliberate: a 10px lift
         (2026-10-11) put the row back in the blur, so leave it be. */
      padding: var(--band-top, 6px) 6px 0;
      .rounded-pill {
        cursor: pointer;
      }

      /* One row at any length: the menu keeps its size, and the hat name
         gives up whatever room is short, ending in "…". */
      gap: 8px;

      .header-menu {
        flex-shrink: 0;
      }

      /* Pinned right even when there is no menu beside it. */
      .current-hat {
        margin-left: auto;
        min-width: 0;

        p {
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .header-menu__toggle {
        align-items: center;
        cursor: pointer;
        display: flex;
        position: relative;
      }

      /* People waiting on Movie Requests. */
      .header-menu__dot {
        background: #dc3545;
        border: 1.5px solid #212529;
        border-radius: 50%;
        height: 9px;
        position: absolute;
        right: -2px;
        top: -2px;
        width: 9px;
      }

      /* Same shape as Cinema Roll's sort menu: as wide as its longest
         item, never wider than a phone can show. */
      ul.dropdown-menu {
        max-width: 80vw;
        width: max-content;
      }

      .dropdown-item {
        align-items: center;
        display: flex;
        gap: 8px;
      }
    }

  }
</style>