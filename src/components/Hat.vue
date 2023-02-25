<template>
  <div class="hat col-12">
    <AddMovie/>
    <span class="col-12 d-flex justify-content-center text-decoration-underline text-white my-3">or</span>
    <DrawMovie/>
    <hr>
    <History ref="history"/>
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
  created () {
    window.addEventListener('scroll', this.handleScroll);
  },
  unmounted () {
    window.removeEventListener('scroll', this.handleScroll);
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

<style>

</style>