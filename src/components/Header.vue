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

export default {
  computed: {
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