<template>
  <div class="movie-hat row">
    <div class="col-12 col-md-6 p-0 text-center">
      <add-movie />
    </div>
    <div class="col-12 col-md-6 p-0 text-center">
      <draw-movie />
    </div>
  </div>
</template>

<script>
import _ from 'lodash';
import AddMovie from '~/components/AddMovie.vue';
import DrawMovie from '~/components/DrawMovie.vue';

export default {
  components: { AddMovie, DrawMovie },
  computed: {
    loadedMovies() {
      return this.$store.state.loadedMovies;
    },
  },
};
</script>

<style lang="scss">
.movie-hat {
  height: 100vh;

  > div {
    height: 50%;
    display: flex;
    justify-content: center;
    align-items: center;

    @media screen and (min-width: 768px) {
      height: 100%;
    }
  }
}
</style>
