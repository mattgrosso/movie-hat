<template>
  <div class="movie-hat">
    <Header/>
    <Login v-if="!loggedIn"/>
    <div v-else class="content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script>
import Login from "./components/Login.vue";
import Header from "./components/Header.vue";

export default {
  name: 'Movie-Hat',
  components: {
    Header,
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
</style>
