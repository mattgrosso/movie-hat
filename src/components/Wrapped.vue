<template>
  <div class="wrapped col-12 px-3 pb-5">
    <div class="marquee">
      <div class="band">
        <p class="eyebrow m-0">{{ movieHatTitle }}</p>
        <h2 class="m-0">Wrapped</h2>
        <p class="year m-0">{{ stats.year }}</p>
      </div>
    </div>

    <div v-if="!stats.hasData" class="card my-4">
      <div class="card-body">
        <p class="m-0">Nothing went in or came out of this hat in {{ stats.year }}.</p>
        <p class="m-0 mt-2">Add a few movies and there'll be a story to tell next time.</p>
      </div>
    </div>

    <template v-else>
      <section class="headline">
        <p class="big m-0">{{ stats.drawnCount }}</p>
        <p class="caption m-0">
          {{ stats.drawnCount === 1 ? 'movie drawn from the hat' : 'movies drawn from the hat' }}
        </p>
        <p class="sub m-0">
          {{ stats.addedCount }} went in · {{ stats.stillWaiting }} still waiting
        </p>
      </section>

      <section v-if="stats.addedBy.length" class="panel">
        <h3>Who picked the winners</h3>
        <ul class="leaderboard p-0 m-0">
          <li v-for="person in stats.addedBy" :key="person.name">
            <span class="name">{{ person.name }}</span>
            <span class="bar" :style="`width: ${barWidth(person.count)}%`"></span>
            <span class="count">{{ person.count }}</span>
          </li>
        </ul>
        <p class="footnote m-0">Whose additions actually got drawn.</p>
      </section>

      <section v-if="stats.busiestMonth" class="panel">
        <h3>Movie nights by month</h3>
        <ul class="months p-0 m-0">
          <li v-for="(count, index) in stats.byMonth" :key="index">
            <span class="column" :style="`height: ${monthHeight(count)}%`"></span>
            <span class="month-label">{{ monthLetter(index) }}</span>
          </li>
        </ul>
        <p class="footnote m-0">
          {{ stats.busiestMonth.name }} was the busiest, with {{ stats.busiestMonth.count }}.
        </p>
      </section>

      <section v-if="stats.longestWait" class="panel poster-panel">
        <h3>The long wait</h3>
        <div class="poster-row">
          <img
            v-if="stats.longestWait.movie.poster_path"
            :src="`https://image.tmdb.org/t/p/w342${stats.longestWait.movie.poster_path}`"
            :alt="`${stats.longestWait.movie.title} poster`"
          />
          <div class="poster-copy">
            <p class="title m-0">{{ stats.longestWait.movie.title }}</p>
            <p class="m-0">sat in the hat for <strong>{{ stats.longestWait.days }}</strong> days before its night came.</p>
            <p v-if="stats.averageWaitDays !== null" class="footnote m-0">
              The average wait was {{ stats.averageWaitDays }} days.
            </p>
          </div>
        </div>
      </section>

      <section v-if="stats.oldestFilm || stats.newestFilm" class="panel">
        <h3>Across the years</h3>
        <p v-if="stats.oldestFilm" class="m-0">
          Oldest: <strong>{{ stats.oldestFilm.title }}</strong> ({{ releaseYear(stats.oldestFilm) }})
        </p>
        <p v-if="stats.newestFilm" class="m-0">
          Newest: <strong>{{ stats.newestFilm.title }}</strong> ({{ releaseYear(stats.newestFilm) }})
        </p>
        <p v-if="stats.averageReleaseYear" class="footnote m-0">
          The average film you drew came out in {{ stats.averageReleaseYear }}.
        </p>
      </section>

      <section v-if="stats.longestWaiting" class="panel">
        <h3>Still waiting</h3>
        <p class="m-0">
          <strong>{{ stats.longestWaiting.title }}</strong> has been in the hat since
          {{ addedOn(stats.longestWaiting) }}. Its turn will come.
        </p>
        <p v-if="stats.notes" class="footnote m-0">
          {{ stats.notes }} of this year's draws came with a note attached.
        </p>
      </section>
    </template>

    <div class="d-flex justify-content-center mt-4">
      <button class="btn btn-primary" @click="$router.push('/')">Back to the hat</button>
    </div>
  </div>
</template>

<script>
import { wrappedStats, wrappedYear, MONTHS } from '../assets/javascript/wrapped.js';

// A year in the hat. All of it is computed from data the app already has
// (see assets/javascript/wrapped.js) — nothing new is stored, and the page
// works offline off whatever the hat last loaded.
export default {
  computed: {
    movieHatTitle () {
      return this.$store.state.movieHatTitle;
    },
    stats () {
      // ?year=2025 to look back further than the season default.
      const requested = Number(this.$route?.query?.year);
      const year = Number.isFinite(requested) && requested > 2000 ? requested : wrappedYear();

      return wrappedStats(this.$store.state.history || [], this.$store.state.movieHat || [], year);
    },
    topCount () {
      return this.stats.addedBy[0]?.count || 1;
    },
    busiestCount () {
      return this.stats.busiestMonth?.count || 1;
    }
  },
  mounted () {
    // Deep-linked or refreshed: the hat may not be loaded yet.
    if (!this.$store.state.history) {
      this.$store.dispatch('getHat');
    }
  },
  methods: {
    barWidth (count) {
      return Math.max(6, Math.round((count / this.topCount) * 100));
    },
    monthHeight (count) {
      return count ? Math.max(8, Math.round((count / this.busiestCount) * 100)) : 2;
    },
    monthLetter (index) {
      return MONTHS[index].slice(0, 1);
    },
    releaseYear (movie) {
      return String(movie?.release_date || '').slice(0, 4) || '—';
    },
    addedOn (movie) {
      if (!movie?.timeStamp) return 'a while back';
      const date = new Date(movie.timeStamp);
      return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    }
  }
};
</script>

<style lang="scss">
.wrapped {
  color: white;
  margin: 0 auto;
  max-width: 640px;

  // The app's own framed-poster look, borrowed for a title card.
  .marquee {
    background: white;
    border: 12px solid black;
    box-shadow: inset 0 0 9px 0 #424242;
    margin-top: 1rem;
    padding: 18px;

    .band {
      background: black;
      padding: 1.75rem 1rem;
      text-align: center;

      .eyebrow {
        color: #9fc3e8;
        font-size: 0.7rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      h2 {
        color: #6ba2dc;
        font-family: "Monoton", cursive;
        font-size: 2.25rem;
        line-height: 1.2;
        margin-top: 0.35rem !important;
      }

      .year {
        color: white;
        font-size: 1rem;
        letter-spacing: 0.3em;
      }
    }
  }

  .headline {
    padding: 2rem 0 1rem;
    text-align: center;

    .big {
      font-family: "Monoton", cursive;
      font-size: 4rem;
      line-height: 1;
    }

    .caption {
      font-size: 1.05rem;
      margin-top: 0.5rem !important;
    }

    .sub {
      font-size: 0.8rem;
      margin-top: 0.35rem !important;
      opacity: 0.85;
    }
  }

  .panel {
    background: rgba(0, 0, 0, 0.22);
    border-radius: 8px;
    margin-top: 1rem;
    padding: 1.25rem;

    h3 {
      font-size: 0.75rem;
      letter-spacing: 0.16em;
      margin-bottom: 0.9rem;
      text-transform: uppercase;
    }

    .footnote {
      font-size: 0.75rem;
      margin-top: 0.6rem !important;
      opacity: 0.8;
    }
  }

  .leaderboard {
    list-style: none;

    li {
      align-items: center;
      column-gap: 0.6rem;
      display: grid;
      grid-template-columns: 7rem 1fr 2rem;
      margin-bottom: 0.5rem;

      .name {
        font-size: 0.85rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bar {
        background: white;
        border-radius: 2px;
        display: block;
        height: 14px;
      }

      .count {
        font-size: 0.85rem;
        text-align: right;
      }
    }
  }

  .months {
    align-items: flex-end;
    column-gap: 3px;
    display: flex;
    height: 110px;
    list-style: none;

    li {
      align-items: center;
      display: flex;
      flex: 1;
      flex-direction: column;
      height: 100%;
      justify-content: flex-end;

      .column {
        background: white;
        border-radius: 2px 2px 0 0;
        display: block;
        width: 100%;
      }

      .month-label {
        font-size: 0.6rem;
        margin-top: 4px;
        opacity: 0.8;
      }
    }
  }

  .poster-panel {
    .poster-row {
      column-gap: 1rem;
      display: flex;

      img {
        background: white;
        border: 6px solid black;
        flex-shrink: 0;
        padding: 6px;
        width: 108px;
      }

      .poster-copy {
        .title {
          font-size: 1.05rem;
          font-weight: 600;
          margin-bottom: 0.35rem !important;
        }
      }
    }
  }
}
</style>
