<template>
  <div class="movie-hat row">
    <add-movie
      v-if="showAddMovie"
      :dev-mode="devMode"
      @start-adding-movie="showDrawMovie = false"
      @finish-adding-movie="showDrawMovie = true"
    />
    <p v-if="showAddMovie" class="text-white text-center m-0" :class="{transparent: !showDrawMovie}">
      - or -
    </p>
    <draw-movie :class="{transparent: !showDrawMovie}" :dev-mode="devMode" />
    <div class="hr mb-3"></div>
    <history />
  </div>
</template>

<script>
import _ from 'lodash';
import AddMovie from '~/components/AddMovie.vue';
import DrawMovie from '~/components/DrawMovie.vue';
import History from '~/components/History.vue';

export default {
  data() {
    return {
      devMode: false,
      showAddMovie: true,
      showDrawMovie: true,
    };
  },
  components: { AddMovie, DrawMovie, History },
  computed: {
    loadedMovies() {
      return this.$store.state.loadedMovies;
    },
    devPrefix() {
      return this.$store.state.devMode ? 'dev-' : '';
    },
  },
  mounted() {
    this.$store.dispatch('loadHat', `${this.devPrefix}hat`);
    this.$store.dispatch('loadHistory', `${this.devPrefix}history`);
  },
  watch: {
    devMode(newVal, oldVal) {
      this.$store.commit('setDevMode', newVal);
      this.$store.dispatch('loadHat', `${this.devPrefix}hat`);
      this.$store.dispatch('loadHistory', `${this.devPrefix}history`);
    },
  },
};
</script>

<style lang="scss">
.movie-hat {
  height: 100%;
  padding: 36px 24px;
  position: relative;

  .hr {
    border-top: 1px solid white;
  }

  .transparent {
    opacity: 0;
    pointer-events: none;
  }
}
</style>
