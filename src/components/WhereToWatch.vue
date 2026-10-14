<template>
  <div v-if="hasProviders || onPlex || (showEmpty && loaded)" class="where-to-watch d-flex align-items-center justify-content-center flex-wrap">
    <!-- First, because it is free and already in the house. Its own link:
         it opens Plex, and anchors can't nest inside the JustWatch one. -->
    <a
      v-if="onPlex"
      class="service on-plex d-flex align-items-center"
      :href="plexHref"
      target="_blank"
      rel="noreferrer"
      title="Already on the Plex server"
    >
      <span class="label">Watch</span>
      <span class="plex-badge">Plex</span>
    </a>
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
    <p v-else-if="!onPlex" class="where-to-watch-empty m-0">Not streaming or renting anywhere right now</p>
  </div>
</template>

<script>
// Where the drawn movie is actually watchable, from TMDB's watch-provider
// data (sourced from JustWatch — the link goes to their page, which is
// TMDB's attribution requirement). The one moment you urgently need this
// is right after the draw, which is exactly where this renders — and,
// since 2026-09-16, in the details of every drawn poster on the home page
// ("add in there also the places that it can be streamed since we're
// pulling that anyway").
//
// Since 2026-10-14 the Plex server comes first when the movie is already on
// it (see utils/plexLibrary.js). Only for the people who may request — the
// same `mayRequestMovies` that shows the Request button — since Plex is no
// place to watch for anyone else, and the rules let nobody else read the
// list anyway.
import { dbGet } from '../store/db.js';
import { plexUrl } from '../utils/requestMovie.js';
import { lookUpOnPlex } from '../utils/plexLibrary.js';

export default {
  props: {
    movie: { type: Object, default: null },
    // Say so when the lookup came back with nothing. Off on the drawn-movie
    // page, where an absent strip is the quieter answer; on for the info
    // panel, where a missing row would look like the lookup never ran.
    showEmpty: { type: Boolean, default: false },
    // The movie's `requests` row when the parent read the whole node already
    // (null for "none"), so a page of posters doesn't read it once each.
    // Leave undefined and it is read here.
    requestRow: { type: Object, default: undefined }
  },
  data () {
    return {
      providers: null,
      link: null,
      loaded: false,
      onPlex: false
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
    },
    // No store in some tests; no store means nobody to check for.
    plexAllowed () {
      return Boolean(this.$store?.getters?.mayRequestMovies);
    },
    plexHref () {
      return plexUrl();
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
        this.checkPlex();
      }
    },
    // Sign-in (and with it the right to look) can land after the movie.
    plexAllowed: 'checkPlex'
  },
  methods: {
    async checkPlex () {
      this.onPlex = false;
      const id = this.movie?.id;
      if (!id || !this.plexAllowed) return;
      const onPlex = await lookUpOnPlex(dbGet, id, this.requestRow);
      // The movie may have changed while the lookup was out.
      if (this.movie?.id === id) this.onPlex = onPlex;
    },
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
  column-gap: 1.25rem;
  margin-top: 0.75rem;
  row-gap: 0.5rem;

  .on-plex {
    color: inherit;
    text-decoration: none;
  }

  // Plex's own black and gold, as a word: no logo of theirs to borrow here
  // the way TMDB hands over the streaming services' logos.
  .plex-badge {
    background: #1f1f1f;
    border-radius: 6px;
    color: #e5a00d;
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 28px;
    padding: 0 0.5rem;
  }

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
