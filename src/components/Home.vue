<template>
  <div class="home">
    <AddMovie/>
    <span class="col-12 d-flex justify-content-center text-decoration-underline text-white">or</span>
    <DrawMovie/>
  </div>
</template>

<script>
import AddMovie from "./AddMovie.vue";
import DrawMovie from "./DrawMovie.vue";

export default {
  components: {
    AddMovie,
    DrawMovie
  },
  mounted () {
    this.$store.dispatch('getMovieHat');
    this.$store.dispatch('getHistory');
  }
}
</script>

<style lang="scss">

</style>