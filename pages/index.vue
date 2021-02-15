<template>
  <div class="movie-hat row">
    <div class="dev-mode-toggle-wrapper form-check form-switch">
      <input
        class="form-check-input"
        type="checkbox"
        id="flexSwitchCheckDefault"
        v-model="devMode"
      />
      <h2 v-if="devMode" class="text-white">Dev Mode On</h2>
    </div>
    <add-movie
      v-if="showAddMovie"
      :dev-mode="devMode"
      @start-adding-movie="showDrawMovie = false"
      @finish-adding-movie="showDrawMovie = true"
    />
    <p v-if="showAddMovie && showDrawMovie" class="text-white text-center m-0">
      - or -
    </p>
    <draw-movie v-if="showDrawMovie" :dev-mode="devMode" />
  </div>
</template>

<script>
import _ from 'lodash';
import AddMovie from '~/components/AddMovie.vue';
import DrawMovie from '~/components/DrawMovie.vue';

export default {
  data() {
    return {
      devMode: false,
      showAddMovie: true,
      showDrawMovie: true,
    };
  },
  components: { AddMovie, DrawMovie },
  computed: {
    loadedMovies() {
      return this.$store.state.loadedMovies;
    },
    devPrefix() {
      return this.$store.state.devMode ? 'dev-' : '';
    },
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
  padding: 64px 24px;

  .dev-mode-toggle-wrapper {
    align-items: center;
    display: flex;
    justify-content: flex-start;
    left: 10px;
    position: absolute;
    top: 10px;

    input {
      border: 2px solid white;
    }

    h2 {
      font-size: 1.2rem;
      margin: 0;
      padding: 0 12px;
    }
  }
}
</style>
