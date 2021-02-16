<template>
  <div class="fade-border-left-wrapper" :style="cssVars">
    <div class="fade-border-right-wrapper" :style="cssVars">
      <div v-if="movie" class="draw p-4" :style="cssVars">
        <div class="poster-wrapper">
          <img
            class="poster mb-4"
            crossorigin="anonymous"
            :src="movie.poster"
            :alt="`${movie.title} Poster`"
            :title="movie.title"
          />
          <p
            class="days-ago text-center col-12"
            :class="{ 'text-white': isDark }"
          >
            (Added to the hat {{ daysAgo }})
          </p>
        </div>
        <div class="details-wrapper p-4">
          <ul
            class="provider-list col-12"
            v-if="availableStreamingProviders.length"
          >
            <li
              v-for="(streamer, index) in availableStreamingProviders"
              :key="index"
            >
              <a :href="streamer.url">
                <img :src="streamer.iconUrl" :alt="`${streamer.name} icon`" />
              </a>
            </li>
          </ul>
          <p v-else>No Streaming Providers Found.</p>
          <button
            class="back-button btn btn-success col-12 col-sm-6 col-md-12"
            @click="$router.push('/')"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import justWatch from '@/assets/justwatch-api.mjs';
const jw = new justWatch();

import FastAverageColor from 'fast-average-color';
const fac = new FastAverageColor();

export default {
  validate(context) {
    if (context.params.movie) {
      return true;
    } else {
      context.redirect('/');
    }
  },
  data() {
    return {
      providers: null,
      movie: null,
      colorData: null,
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

      return _.uniqBy(availableStreamingProviders, 'name');
    },
    cssVars() {
      if (this.colorData) {
        return {
          '--bg-color': this.colorData.hex,
        };
      }
    },
    isDark() {
      if (this.colorData) {
        return this.colorData.isDark;
      }
    },
  },
  methods: {
    async movieData(movie) {
      const data = await jw.search(movie.title);
      const posterUrl = `https://images.justwatch.com${data.items[0].poster.replace(
        '{profile}',
        ''
      )}s718`;

      const movieData = {
        ...data.items[0],
        poster: posterUrl,
      };

      this.getColorData(posterUrl);
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
    async getColorData(image) {
      const colorData = await fac.getColorAsync(image);
      this.colorData = colorData;
      return colorData;
    },
  },
  mounted() {
    this.getProviders();
    this.movieData(this.drawnMovie);
  },
};
</script>

<style lang="scss">
.fade-border-left-wrapper,
.fade-border-right-wrapper {
  @media screen and (min-width: 1000px) {
    border-style: solid;
    max-width: 1000px;
    margin: 0 auto;
  }
}

.fade-border-left-wrapper {
  @media screen and (min-width: 1000px) {
    border-width: 0 0 0 32px;
    border-image: linear-gradient(to left, var(--bg-color), #6ba2dc) 1 100%;
  }
}

.fade-border-right-wrapper {
  @media screen and (min-width: 1000px) {
    border-width: 0 32px 0 0;
    border-image: linear-gradient(to right, var(--bg-color), #6ba2dc) 1 100%;
  }
}

.draw {
  background-color: var(--bg-color);
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: center;
  min-height: 100vh;

  @media screen and (min-width: 768px) {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-around;
  }

  .poster-wrapper {
    text-align: center;

    .poster {
      height: 300px;

      @media screen and (min-width: 768px) {
        height: 500px;
      }
    }

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

    .provider-list {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      list-style: none;
      padding: 0;

      li {
        margin: 6px;

        img {
          width: 64px;
        }
      }

      .back-button {
        height: 0%;
      }
    }
  }
}
</style>
