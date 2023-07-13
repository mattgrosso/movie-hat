<template>
  <div class="hat col-12 py-4">
    <AddMovie/>
    <span class="col-12 d-flex justify-content-center text-decoration-underline text-white my-3">or</span>
    <DrawMovie/>
    <p class="current-count text-white text-center m-0 p-2 col-12">
      <span v-if="moviesInHat === 1">(There is currently {{ moviesInHat }} movie in the hat.)</span>
      <span v-else>(There are currently {{ moviesInHat }} movies in the hat.)</span>
      <button class="btn btn-outline-light" @click="toggleGraph">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-graph-up" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M0 0h1v15h15v1H0V0Zm14.817 3.113a.5.5 0 0 1 .07.704l-4.5 5.5a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61 4.15-5.073a.5.5 0 0 1 .704-.07Z"/>
        </svg>
      </button>
    </p>
    <Charts class="charts col-12 px-3" ref="charts"/>
    <hr v-if="showHistory" class="mx-auto">
    <History v-if="showHistory" ref="history"/>
    <div class="back-to-top" :class="{hidden: !showBackToTop}" @click="scrollToTop">
      <span>Back to Top</span>
    </div>
  </div>
</template>

<script>
import AddMovie from "./AddMovie.vue";
import DrawMovie from "./DrawMovie.vue";
import Charts from "./Charts.vue";
import History from "./History.vue";

export default {
  components: {
    AddMovie,
    DrawMovie,
    Charts,
    History
  },
  data () {
    return {
      showBackToTop: false
    }
  },
  mounted () {
    const defaultMovieHatTitle = JSON.parse(window.localStorage.getItem('defaultMovieHatTitle'));

    if (defaultMovieHatTitle) {
      this.$store.commit("setMovieHatTitle", defaultMovieHatTitle);
    }

    if (!this.$store.state.movieHatTitle) {
      this.$router.push("/hat-list");
    }

    this.$store.dispatch('getHat');
  },
  created () {
    window.addEventListener('scroll', this.handleScroll);
  },
  unmounted () {
    window.removeEventListener('scroll', this.handleScroll);
  },
  computed: {
    showHistory () {
      return this.$store.state.history ? this.$store.state.history.length : false;
    },
    moviesInHat () {
      return this.$store.state.movieHat?.length;
    }
  },
  methods: {
    handleScroll () {
      const historyTop = this.$refs.history.$el.getBoundingClientRect().top;
      if (historyTop < -500) {
        this.showBackToTop = true;
      } else {
        this.showBackToTop = false;
      }
    },
    scrollToTop () {
      window.scroll({
        top: top,
        behavior: 'smooth'
      });
    },
    toggleGraph () {
      this.$refs.charts.$el.classList.toggle('visible');
    }
  },
}
</script>

<style lang="scss">
  .hat {
    position: relative;

    hr {
      border-top: 1px solid white;
      opacity: 1;
      width: 90%;
    }

    .current-count {
      font-size: 0.75rem;
      position: relative;

      .btn {
        --bs-btn-padding-y: 6px;
        --bs-btn-padding-x: 6px;

        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        width: 24px;
        height: 24px;
        display: inline-flex;
        justify-content: center;
        align-items: center;
      }
    }

    .charts {
      height: 0;
      overflow: hidden;
      width: 85vw;
      transition: 0.25s height ease-in-out;
      margin: 0 auto;

      &.visible {
        height: 85vw;
      }
    }

    .back-to-top {
      background: white;
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
      box-shadow: 0px 0px 6px 0px #adadad;
      cursor: pointer;
      display: flex;
      left: 50%;
      max-height: 50px;
      position: fixed;
      top: 0;
      transform: translateX(-50%);
      transition: 0.25s max-height ease-in-out;
      overflow: hidden;

      &.hidden {
        max-height: 0;
      }

      span {
        font-size: 0.75rem;
        padding: 6px 24px;
      }
    }
  }
</style>