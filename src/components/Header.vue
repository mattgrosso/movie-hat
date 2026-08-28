<template>
  <div class="header-wrapper">
    <div class="user-and-hat-pills d-flex justify-content-between">
      <div
        v-if="$store.state.email"
        class="user-email badge rounded-pill text-bg-dark"
      >
        <p class="text-white m-0" data-bs-toggle="modal" data-bs-target="#logOutModal">
          {{$store.state.email}}
        </p>
      </div>
      <div class="right-pills d-flex">
        <!-- Draw notifications (2026-08-28). Tap subscribes THIS device to a
             push whenever someone draws from a hat you're in; tap again to
             unsubscribe. Rendered only when signed in and the push API is
             configured; on an iOS Safari tab (not installed) the tap explains
             the Home Screen requirement instead of silently failing. The tap
             IS the permission gesture — iOS requires that. -->
        <div
          v-if="showPushBell"
          class="push-bell badge rounded-pill text-bg-dark"
          :title="pushOn ? 'Draw notifications are on — tap to turn off' : 'Notify me when someone draws'"
          :aria-label="pushOn ? 'Turn off draw notifications' : 'Turn on draw notifications'"
          @click="togglePush"
        >
          <svg v-if="pushOn" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-bell-fill" viewBox="0 0 16 16">
            <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2m.995-14.901a1 1 0 1 0-1.99 0A5 5 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7a5 5 0 0 0-4.005-4.901"/>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-bell" viewBox="0 0 16 16">
            <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6"/>
          </svg>
        </div>
        <!-- The way into /peek. Rendered only for the owner, so nobody else is
             offered a button that spoils their own hat. Same caveat as the
             screen it opens: this is a client-side check in a public bundle,
             not a security boundary — see src/assets/javascript/peek.js. -->
        <div
          v-if="canPeek"
          class="peek-link badge rounded-pill text-bg-dark"
          title="Peek in the hat"
          aria-label="Peek in the hat"
          @click="$router.push('/peek')"
        >
          <!-- Inline, because bootstrap-icons is installed but its CSS is
               never imported — the same reason every other icon here is SVG. -->
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-eye-fill" viewBox="0 0 16 16">
            <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"/>
            <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7"/>
          </svg>
        </div>
        <div
          v-if="$store.state.movieHatTitle"
          class="current-hat badge rounded-pill text-bg-dark"
          @click="$router.push('/hat-list')"
        >
          <p class="text-white m-0">
            {{$store.state.movieHatTitle}}
          </p>
        </div>
      </div>
    </div>
    <div class="header d-flex justify-content-center align-items-center">
      <h1 class="col-12 d-flex justify-content-center" @click="$router.push('/');">
        <span>
          Movie Hat
        </span>
        <div class="mat"></div>
      </h1>
      <span class="build-stamp">{{buildStamp}}</span>
    </div>

    <!-- Modals -->
    <div class="modal fade" id="logOutModal" tabindex="-1" aria-labelledby="logOutModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header">
            <h1 class="modal-title fs-5" id="logOutModalLabel">Logout</h1>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            Do you want to log out?
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Nevermind</button>
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal" @click="logOut">Log Out</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getAuth, signOut } from 'firebase/auth';
import { buildStamp } from '../utils/buildStamp.js';
import { isOwner } from '../assets/javascript/peek.js';
import { pushApiConfigured, deviceSubscribed, subscribeThisDevice, unsubscribeThisDevice } from '../utils/push.js';

export default {
  data () {
    return {
      pushOn: false,
    };
  },
  async mounted () {
    this.pushOn = await deviceSubscribed();
  },
  computed: {
    showPushBell () {
      return Boolean(this.$store.state.email) && pushApiConfigured();
    },
    canPeek () {
      return isOwner(this.$store.state.email);
    },
    // The house build stamp — "v1.7.1 · built Aug 22, 1:32 AM". Was the bare
    // version number; the version alone can't tell you whether the tab in
    // front of you picked up the deploy you just did.
    buildStamp () {
      return buildStamp();
    },
  },
  methods: {
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
      padding: 6px 6px 0;
      .rounded-pill {
        cursor: pointer;
      }

      .right-pills {
        gap: 4px;
      }

      /* Icon-only, so it needs its own centring — the sibling pills get
         theirs from the <p> they wrap. */
      .peek-link {
        align-items: center;
        display: flex;
      }
    }

  }
</style>