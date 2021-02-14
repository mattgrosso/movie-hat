<template>
  <div v-if="movie" class="draw p-4">
    <img
      class="movie-poster mb-4"
      :src="movie.poster"
      :alt="`${movie.title} Poster`"
      :title="movie.title"
    />
    <p class="days-ago text-white text-center col-12">
      (Added to the hat {{ daysAgo }})
    </p>
    <ul class="provider-list col-12" v-if="availableStreamingProviders.length">
      <li v-for="(streamer, index) in availableStreamingProviders" :key="index">
        <a :href="streamer.url">
          <img :src="streamer.iconUrl" :alt="`${streamer.name} icon`" />
        </a>
      </li>
    </ul>
    <button class="btn btn-success col-12" @click="$router.push('/')">
      Back
    </button>
  </div>
</template>

<script>
import justWatch from 'justwatch-api';
const jw = new justWatch();

export default {
  data() {
    return {
      providers: null,
      movie: null,
    };
  },
  computed: {
    drawnMovie() {
      return this.$route.params.movie;
    },
    daysAgo() {
      return `${Math.floor(
        (Date.now() - this.drawnMovie.timeStamp) / 1000 / 60 / 60 / 24
      )} days ago`;
    },
    availableStreamingProviders() {
      const availableStreamingProviders = this.movie.offers
        .filter((offer) => {
          return offer.monetization_type === 'flatrate';
        })
        .map((streamer) => {
          const provider = this.providerForId(streamer.provider_id);

          return {
            name: provider.clear_name,
            iconUrl: `https://images.justwatch.com${provider.icon_url.replace(
              '{profile}',
              ''
            )}s100`,
            id: provider.id,
            slug: provider.slug,
            url: streamer.urls.standard_web,
            quality: streamer.presentation_type,
          };
        });

      return availableStreamingProviders;
    },
  },
  methods: {
    async movieData(movie) {
      const data = await jw.search(movie.title);

      const movieData = {
        ...data.items[0],
        poster: `https://images.justwatch.com${data.items[0].poster.replace(
          '{profile}',
          ''
        )}s718`,
      };

      this.movie = movieData;
    },
    async getProviders() {
      const providers = await jw.getProviders();

      this.providers = providers;
    },
    providerForId(id) {
      return this.providers.find((provider) => {
        return provider.id === id;
      });
    },
  },
  mounted() {
    this.getProviders();
    this.movieData(this.drawnMovie);
  },
};
</script>

<style lang="scss">
.draw {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;

  .movie-poster {
    height: 300px;
  }

  .days-ago {
    font-size: 0.75rem;
  }

  .provider-list {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    list-style: none;
    padding: 0;

    li {
      margin: 6px;

      img {
        width: 64px;
      }
    }
  }
}
</style>
