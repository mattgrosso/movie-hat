<template>
  <div class="movie-hat">
    <AppHeader/>
    <UpdateAvailableBanner/>
    <div
      v-if="$store.state.appError"
      class="app-error alert alert-warning alert-dismissible mx-3 my-2"
      role="alert"
    >
      {{ $store.state.appError }}
      <button
        type="button"
        class="btn-close"
        aria-label="Dismiss"
        @click="$store.commit('setAppError', null)"
      />
    </div>
    <Login v-if="!loggedIn"/>
    <div v-else class="content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script>
import Login from "./components/Login.vue";
// Registered as AppHeader: "Header" is a reserved HTML element name.
import AppHeader from "./components/Header.vue";
import UpdateAvailableBanner from "./components/UpdateAvailableBanner.vue";
import { reloadForUpdate, isSafeMomentForReload, shouldAutoAttempt } from "./utils/appUpdate.js";

export default {
  name: 'Movie-Hat',
  components: {
    AppHeader,
    Login,
    UpdateAvailableBanner
  },
  data () {
    return {
      lastActivityAt: Date.now(),
      lastBecameVisibleAt: Date.now(),
      deployedBundleSeen: null,
      autoUpdateTimer: null
    };
  },
  watch: {
    // Auto-apply updates: immediately when spotted at a fresh moment (just
    // launched or foregrounded — nothing is in progress yet), otherwise
    // after a quiet stretch — and never while typing, mid-modal, or during
    // the draw reveal. Cinema Roll's pattern, both of its lessons included.
    '$store.state.updateAvailable' (available) {
      if (!available) return;
      this.armAutoUpdate();
    }
  },
  computed: {
    loggedIn () {
      // Was: an email remembered in localStorage, which is not a session at
      // all. With the database open that worked; with it closed the app
      // rendered as signed in, sent every request without a token and showed
      // an empty screen (outage, 2026-08-17).
      //
      // `authResolved` guards the first moment: Firebase restores a session
      // asynchronously, so until it has answered we keep showing whatever the
      // remembered email implies rather than flashing the sign-in button at
      // somebody who is signed in.
      if (!this.$store.state.authResolved) {
        return this.$store.state.email;
      }
      return Boolean(this.$store.state.authUser);
    }
  },
  methods: {
    async checkForServiceWorkerUpdate () {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.update();
          }
        } catch {
          // Best-effort — a failed check just means we try again on the
          // next trigger.
        }
      }

      await this.checkDeployedBundle();
    },
    /**
     * Notices a new deploy by comparing bundle filenames, independent of
     * any service worker state. This app builds with `skipWaiting: true`,
     * so a new worker activates itself immediately instead of waiting —
     * which makes registerServiceWorker's `updated()` hook a race this
     * check often wins where the hook loses (Cinema Roll bug report: "I
     * didn't get my refresh for new version banner").
     *
     * The cache-busting param matters: Workbox precaches index.html and
     * only strips params it is configured to ignore, so an arbitrary param
     * misses the precache and goes to the network — which is the point.
     */
    async checkDeployedBundle () {
      if (this.$store.state.updateAvailable) {
        return;
      }

      const runningBundle = this.currentBundleName();
      if (!runningBundle) {
        return;
      }

      try {
        const response = await fetch(`${process.env.BASE_URL || '/'}index.html?updateCheck=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) {
          return;
        }
        const deployedBundle = (await response.text()).match(/js\/app\.[a-z0-9]+\.js/);
        if (deployedBundle && deployedBundle[0] !== runningBundle) {
          this.deployedBundleSeen = deployedBundle[0];
          this.$store.commit('setUpdateAvailable', true);
        }
      } catch {
        // Offline, blocked, or the check simply failed — next trigger.
      }
    },
    /** The app bundle THIS page is running, read off its own script tags. */
    currentBundleName () {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      for (const script of scripts) {
        const match = (script.getAttribute('src') || '').match(/js\/app\.[a-z0-9]+\.js/);
        if (match) return match[0];
      }
      return null;
    },
    noteActivity () {
      this.lastActivityAt = Date.now();
    },
    armAutoUpdate () {
      const target = this.deployedBundleSeen || 'unknown';
      if (!shouldAutoAttempt(target)) return; // once per version; banner remains

      // Fresh moment (just launched or just foregrounded): nothing is in
      // flight yet — apply right away.
      const fresh = Date.now() - (this.lastBecameVisibleAt || 0) < 5000;
      if (fresh && isSafeMomentForReload()) {
        reloadForUpdate();
        return;
      }

      // Otherwise: poll for a quiet stretch.
      if (this.autoUpdateTimer) clearInterval(this.autoUpdateTimer);
      this.autoUpdateTimer = setInterval(() => {
        const quiet = Date.now() - this.lastActivityAt > 25000;
        if (quiet && isSafeMomentForReload()) {
          clearInterval(this.autoUpdateTimer);
          this.autoUpdateTimer = null;
          reloadForUpdate();
        }
      }, 5000);
    }
  },
  mounted () {
    // visibilitychange alone is unreliable on iOS, particularly for a
    // home-screen-installed PWA — it sometimes just doesn't fire when the
    // app comes back to the foreground. pageshow and focus are more
    // consistent there, and the interval is a backstop that doesn't depend
    // on any lifecycle event at all. Between them, an update gets noticed
    // even if any single trigger fails. (Cinema Roll's hard-won set.)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.lastBecameVisibleAt = Date.now();
        this.checkForServiceWorkerUpdate();
      }
    });
    window.addEventListener('pageshow', () => {
      this.lastBecameVisibleAt = Date.now();
      this.checkForServiceWorkerUpdate();
    });
    window.addEventListener('focus', () => {
      this.checkForServiceWorkerUpdate();
    });
    // Activity signals for the quiet-moment detector. Passive: these must
    // never delay scrolling.
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((eventName) => {
      window.addEventListener(eventName, this.noteActivity, { passive: true });
    });
    setInterval(() => {
      this.checkForServiceWorkerUpdate();
    }, 30 * 60 * 1000);
  },
}
</script>

<style>
body.body {
  background-color: #6ba2dc;
}

/* On a desktop the app used to stretch edge to edge — a 2000px-wide search
   box and a marquee like an aircraft carrier. One centered column keeps the
   phone layout intact (max-width is a no-op there) and makes every view
   sane on a big screen. */
.movie-hat {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
