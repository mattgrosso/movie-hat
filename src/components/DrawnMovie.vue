<template>
  <div class="drawn-movie">
    <div v-if="drawnMovie" class="draw p-4">
      <div class="poster-wrapper">
        <img
          class="poster mb-4 col-8"
          crossorigin="anonymous"
          :src="`https://image.tmdb.org/t/p/original${drawnMovie.poster_path}`"
          :alt="`${drawnMovie.title} Poster`"
          :title="drawnMovie.title"
        />
        <p class="draw-count text-center col-12">
          We have drawn {{ history.length }} movies from the hat.
        </p>
        <p v-if="daysAgo" class="days-ago text-center col-12">
          (Added to the hat {{ daysAgo }})
        </p>
      </div>
      <div class="details-wrapper p-4">
        <button
          class="back-button btn btn-success col-12 col-sm-6 col-md-12"
          @click="$router.push('/')"
        >
          Back
        </button>
      </div>
    </div>
    <div v-else class="loading-spinner">
      <div class="spinner-border spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  computed: {
    drawnMovie() {
      return this.$store.state.drawnMovie;
    },
    history () {
      return this.$store.state.history;
    },
    daysAgo() {
      if (this.drawnMovie.timeStamp) {
        return `${Math.floor(
          (Date.now() - this.drawnMovie.timeStamp) / 1000 / 60 / 60 / 24
        )} days ago`;
      } else {
        return false;
      }
    }
  }
};
</script>

<style lang="scss">
.draw {
  background-color: var(--bg-color);
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: center;

  @media screen and (min-width: 768px) {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-around;
  }

  .poster-wrapper {
    text-align: center;

    .draw-count,
    .days-ago {
      font-size: 0.75rem;
    }
  }

  .details-wrapper {
    align-items: center;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 150px;

    @media screen and (min-width: 768px) {
      height: 250px;
    }
  }
}

.loading-spinner {
  align-items: center;
  display: flex;
  height: 50vh;
  justify-content: center;
}
</style>
