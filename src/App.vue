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
      return this.$store.state.email;
    }
  },
}
</script>

<style>
body.body {
  background-color: #6ba2dc;
}
</style>
