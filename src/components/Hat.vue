<template>
  <div class="hat col-12 py-4">
    <AddMovie/>
    <span class="col-12 d-flex justify-content-center text-decoration-underline text-white my-3">or</span>
    <DrawMovie/>
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
import History from "./History.vue";

export default {
  components: {
    AddMovie,
    DrawMovie,
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