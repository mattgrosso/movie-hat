<template>
  <div v-if="hasProviders || (showEmpty && loaded)" class="where-to-watch">
    <a
      v-if="hasProviders"
      class="where-to-watch-link d-flex align-items-center justify-content-center flex-wrap"
      :href="link"
      target="_blank"
      rel="noreferrer"
    >
      <span v-if="streaming.length" class="service d-flex align-items-center">
        <span class="label">Stream</span>
        <img
          v-for="provider in streaming"
          :key="`flatrate-${provider.provider_id}`"
          class="provider-logo"
          :src="`https://image.tmdb.org/t/p/w92${provider.logo_path}`"
          :alt="provider.provider_name"
          :title="provider.provider_name"
        />
      </span>
      <span v-if="rental.length" class="service d-flex align-items-center">
        <span class="label">Rent</span>
        <img
          v-for="provider in rental"
          :key="`rent-${provider.provider_id}`"
          class="provider-logo"
          :src="`https://image.tmdb.org/t/p/w92${provider.logo_path}`"
          :alt="provider.provider_name"
          :title="provider.provider_name"
        />
      </span>
    </a>
    <p v-else class="where-to-watch-empty m-0">Not streaming or renting anywhere right now</p>
  </div>
</template>

<script>
// Where the drawn movie is actually watchable, from TMDB's watch-provider
// data (sourced from JustWatch — the link goes to their page, which is
// TMDB's attribution requirement). The one moment you urgently need this
// is right after the draw, which is exactly where this renders — and,
// since 2026-09-16, behind the "i" on every drawn poster on the home page
// ("add in there also the places that it can be streamed since we're
// pulling that anyway").
export default {
  props: {
    movie: { type: Object, default: null },
    // Say so when the lookup came back with nothing. Off on the drawn-movie
    // page, where an absent strip is the quieter answer; on for the info
    // panel, where a missing row would look like the lookup never ran.
    showEmpty: { type: Boolean, default: false }
  },
  data () {
    return {
      providers: null,
      link: null,
      loaded: false
    }
  },
  computed: {
    streaming () {
      return (this.providers?.flatrate || []).slice(0, 6);
    },
    rental () {
      return (this.providers?.rent || []).slice(0, 6);
    },
    hasProviders () {
      return Boolean(this.streaming.length || this.rental.length);
    }
  },
  watch: {
    movie: {
      immediate: true,
      handler (movie) {
        this.providers = null;
        this.link = null;
        this.loaded = false;
        if (movie?.id) this.fetchProviders(movie.id);
      }
    }
  },
  methods: {
    async fetchProviders (id) {
      try {
        const response = await fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${process.env.VUE_APP_TMDB_API_KEY}`);
        const data = await response.json();
        const us = data.results?.US;

        // The movie may have changed while the request was out.
        if (this.movie?.id !== id) return;

        this.providers = us || null;
        this.link = us?.link || null;
        this.loaded = true;
      } catch (error) {
        // No providers is a normal state; a failed lookup just means the
        // strip doesn't render (and the panel doesn't claim "nowhere").
        console.warn('Could not load watch providers', error);
      }
    }
  }
};
</script>

<style lang="scss">
// Text takes the colour of wherever it sits: white on the drawn-movie
// page, black on the back of a poster card (History.vue sets it).
.where-to-watch {
  color: white;
  margin-top: 0.75rem;

  .where-to-watch-link {
    color: inherit;
    column-gap: 1.25rem;
    row-gap: 0.5rem;
    text-decoration: none;
  }

  .service {
    column-gap: 0.4rem;

    .label {
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-right: 0.15rem;
    }

    .provider-logo {
      border-radius: 6px;
      height: 28px;
      width: 28px;
    }
  }

  .where-to-watch-empty {
    font-size: 0.65rem;
    font-style: italic;
    opacity: 0.75;
  }
}
</style>
