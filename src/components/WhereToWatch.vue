<template>
  <a
    v-if="hasProviders"
    class="where-to-watch d-flex align-items-center justify-content-center flex-wrap"
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
</template>

<script>
// Where the drawn movie is actually watchable, from TMDB's watch-provider
// data (sourced from JustWatch — the link goes to their page, which is
// TMDB's attribution requirement). The one moment you urgently need this
// is right after the draw, which is exactly where this renders.
export default {
  props: {
    movie: { type: Object, default: null }
  },
  data () {
    return {
      providers: null,
      link: null
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
      } catch (error) {
        // No providers is a normal state; a failed lookup just means the
        // strip doesn't render.
        console.warn('Could not load watch providers', error);
      }
    }
  }
};
</script>

<style lang="scss">
.where-to-watch {
  column-gap: 1.25rem;
  row-gap: 0.5rem;
  margin-top: 0.75rem;
  text-decoration: none;

  .service {
    column-gap: 0.4rem;

    .label {
      color: white;
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
}
</style>
