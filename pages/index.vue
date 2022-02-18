<template>
  <div class="movie-hat row">
    <div class="history-button-wrapper">
      <a class="history-button" @click="toggleHistory">
        <span v-if="!showHistory">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. -->
            <path
              d="M256 0C397.4 0 512 114.6 512 256C512 397.4 397.4 512 256 512C201.7 512 151.2 495 109.7 466.1C95.2 455.1 91.64 436 101.8 421.5C111.9 407 131.8 403.5 146.3 413.6C177.4 435.3 215.2 448 256 448C362 448 448 362 448 256C448 149.1 362 64 256 64C202.1 64 155 85.46 120.2 120.2L151 151C166.1 166.1 155.4 192 134.1 192H24C10.75 192 0 181.3 0 168V57.94C0 36.56 25.85 25.85 40.97 40.97L74.98 74.98C121.3 28.69 185.3 0 255.1 0L256 0zM256 128C269.3 128 280 138.7 280 152V246.1L344.1 311C354.3 320.4 354.3 335.6 344.1 344.1C335.6 354.3 320.4 354.3 311 344.1L239 272.1C234.5 268.5 232 262.4 232 256V152C232 138.7 242.7 128 256 128V128z"
            />
          </svg>
        </span>
        <span v-if="showHistory">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
            <!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. -->
            <path
              d="M376.6 427.5c11.31 13.58 9.484 33.75-4.094 45.06c-5.984 4.984-13.25 7.422-20.47 7.422c-9.172 0-18.27-3.922-24.59-11.52L192 305.1l-135.4 162.5c-6.328 7.594-15.42 11.52-24.59 11.52c-7.219 0-14.48-2.438-20.47-7.422c-13.58-11.31-15.41-31.48-4.094-45.06l142.9-171.5L7.422 84.5C-3.891 70.92-2.063 50.75 11.52 39.44c13.56-11.34 33.73-9.516 45.06 4.094L192 206l135.4-162.5c11.3-13.58 31.48-15.42 45.06-4.094c13.58 11.31 15.41 31.48 4.094 45.06l-142.9 171.5L376.6 427.5z"
            />
          </svg>
        </span>
      </a>
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
    <history v-if="showHistory" />
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
      showHistory: false,
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
  methods: {
    toggleHistory() {
      this.showAddMovie = !this.showAddMovie;
      this.showDrawMovie = !this.showDrawMovie;
      this.showHistory = !this.showHistory;
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
  padding: 36px 24px;

  .history-button-wrapper {
    display: flex;
    justify-content: flex-end;
    align-items: center;

    .history-button {
      cursor: pointer;

      svg {
        height: 24px;
        width: 24px;

        path {
          fill: white;
        }
      }
    }
  }
}
</style>
