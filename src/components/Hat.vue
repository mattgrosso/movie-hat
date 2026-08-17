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
    <div v-if="showWrappedInvite" class="wrapped-invite col-12 d-flex justify-content-center px-3">
      <button class="btn btn-outline-light btn-sm" @click="$router.push('/wrapped')">
        See your {{ wrappedYearLabel }} Wrapped
      </button>
    </div>
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
import { isWrappedSeason, wrappedYear } from "../assets/javascript/wrapped.js";

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
  async mounted () {
    // Wait out the router's initial navigation: a push made while it is
    // still resolving gets overridden by it, which silently swallowed this
    // redirect on a cold load.
    await this.$router.isReady();

    // The remembered default hat is restored by the store itself now.
    if (!this.$store.state.movieHatTitle) {
      this.$router.push("/hat-list");
      return;
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
    },
    // The app volunteers Wrapped only around year's end — "something that
    // would show up at the end of the year." /wrapped is always reachable.
    showWrappedInvite () {
      return isWrappedSeason() && Boolean(this.$store.state.history?.length);
    },
    wrappedYearLabel () {
      return wrappedYear();
    }
  },
  methods: {
    handleScroll () {
      // History only renders when there IS history — on an empty hat this
      // ref is absent and every scroll event used to throw.
      if (!this.$refs.history) {
        this.showBackToTop = false;
        return;
      }

      const historyTop = this.$refs.history.$el.getBoundingClientRect().top;
      if (historyTop < -500) {
        this.showBackToTop = true;
      } else {
        this.showBackToTop = false;
      }
    },
    scrollToTop () {
      window.scroll({
        top: 0,
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

    .wrapped-invite {
      margin-bottom: 0.5rem;
    }

    // A stack of chart cards, so the drawer grows to whatever it holds
    // rather than being clipped to one fixed square.
    .charts {
      margin: 0 auto;
      max-height: 0;
      overflow: hidden;
      transition: 0.35s max-height ease-in-out;
      width: 90%;

      &.visible {
        max-height: 4000px;
      }

      @media (min-width: 768px) {
        width: 560px;
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