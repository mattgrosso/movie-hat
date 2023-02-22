<template>
  <div class="movie-hat">
    <Header/>
    <router-view></router-view>
  </div>
</template>

<script>
import Header from "./components/Header.vue";

export default {
  name: 'Movie-Hat',
  components: {
    Header
  }
}
</script>

<style>
body.body {
  background-color: #6ba2dc;
}
</style>
