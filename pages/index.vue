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
    <div class="add-movie-wrapper col-12 col-md-6 p-0 text-center">
      <add-movie :dev-mode="devMode" />
    </div>
    <div class="draw-movie-wrapper col-12 col-md-6 p-0 text-center">
      <draw-movie :dev-mode="devMode" />
    </div>
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
    };
  },
  components: { AddMovie, DrawMovie },
  computed: {
    loadedMovies() {
      return this.$store.state.loadedMovies;
    },
  },
  watch: {
    devMode(newVal, oldVal) {
      this.$store.commit('setDevMode', newVal);
    },
  },
};
</script>

<style lang="scss">
.movie-hat {
  height: 100%;

  .dev-mode-toggle-wrapper {
    left: 10px;
    position: absolute;
    top: 10px;

    input {
      border: 2px solid white;
    }
  }

  .add-movie-wrapper,
  .draw-movie-wrapper {
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
