<template>
  <div class="movie-hat">
    <AppHeader/>
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

export default {
  name: 'Movie-Hat',
  components: {
    AppHeader,
    Login
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
