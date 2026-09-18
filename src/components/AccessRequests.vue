<template>
  <div class="access-requests">
    <h2 class="access-requests__title">Who gets in</h2>
    <p class="access-requests__blurb">
      People who signed into <a href="https://request.movie-hat.com" target="_blank" rel="noopener">request.movie-hat.com</a>
      and are waiting on you. Approving lets them ask for downloads; it gives
      them nothing in Movie Hat.
    </p>

    <p v-if="error" class="access-requests__error">{{ error }}</p>

    <section v-if="pending.length" class="access-requests__section">
      <h3 class="access-requests__heading">Waiting on you</h3>
      <ul class="access-requests__list">
        <li v-for="person in pending" :key="person.uid" class="access-requests__row">
          <img v-if="person.photoURL" :src="person.photoURL" alt="" class="access-requests__avatar" referrerpolicy="no-referrer">
          <div class="access-requests__who">
            <span class="access-requests__name">{{ person.displayName || person.email }}</span>
            <span v-if="person.displayName" class="access-requests__email">{{ person.email }}</span>
            <span class="access-requests__when">asked {{ ago(person.requestedAt) }}</span>
          </div>
          <div class="access-requests__actions">
            <button type="button" class="btn btn-sm btn-success" :disabled="busy === person.uid" @click="decide(person, 'approved')">
              Approve
            </button>
            <button type="button" class="btn btn-sm btn-outline-light" :disabled="busy === person.uid" @click="decide(person, 'denied')">
              No
            </button>
          </div>
        </li>
      </ul>
    </section>

    <p v-else-if="loaded" class="access-requests__empty">Nobody is waiting.</p>

    <section v-if="decided.length" class="access-requests__section">
      <h3 class="access-requests__heading">Decided</h3>
      <ul class="access-requests__list">
        <li v-for="person in decided" :key="person.uid" class="access-requests__row">
          <img v-if="person.photoURL" :src="person.photoURL" alt="" class="access-requests__avatar" referrerpolicy="no-referrer">
          <div class="access-requests__who">
            <span class="access-requests__name">{{ person.displayName || person.email }}</span>
            <span v-if="person.displayName" class="access-requests__email">{{ person.email }}</span>
          </div>
          <div class="access-requests__actions">
            <span class="access-requests__status" :class="`is-${person.status}`">
              {{ person.status === 'approved' ? 'In' : 'Denied' }}
            </span>
            <button
              type="button"
              class="btn btn-sm btn-outline-light"
              :disabled="busy === person.uid"
              @click="decide(person, person.status === 'approved' ? 'denied' : 'approved')"
            >{{ person.status === 'approved' ? 'Revoke' : 'Let in' }}</button>
          </div>
        </li>
      </ul>
    </section>

    <p class="access-requests__note">
      You, Seth and Brian are hard-coded in <code>owner.mjs</code> and can
      request without appearing here at all. Revoking somebody takes effect on
      their next action; a download already in flight is not cancelled.
    </p>
  </div>
</template>

<script>
// The waiting list for the standalone Movie Requests app, shown inside Movie
// Hat (2026-09-18) so Matt does not need a second icon on his phone to
// approve anybody. It is the same screen as that app's /#/admin, reading and
// writing the same `siteUsers` node.
//
// Only an admin may list `siteUsers` — the database refuses the read for
// everybody else, so this is not merely hidden. App.vue's router guard and
// the missing header pill are courtesies on top of that.
//
// Approve/deny PATCHes two fields rather than PUTting the whole row, so the
// person's name, photo and original ask survive the decision.
import { dbGet, dbPatch } from '../store/db.js';
import { pendingList, decidedList } from '../utils/siteAccess.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export default {
  name: 'AccessRequests',
  data () {
    return {
      rows: {},
      loaded: false,
      busy: null,
      error: null
    };
  },
  computed: {
    pending () {
      return pendingList(this.rows);
    },
    decided () {
      return decidedList(this.rows);
    }
  },
  methods: {
    ago (timestamp) {
      if (!timestamp) return 'a while ago';
      const elapsed = Date.now() - timestamp;
      if (elapsed < HOUR) return `${Math.max(1, Math.round(elapsed / MINUTE))} min ago`;
      if (elapsed < DAY) return `${Math.round(elapsed / HOUR)} hr ago`;
      return `${Math.round(elapsed / DAY)} days ago`;
    },
    async load () {
      try {
        this.rows = (await dbGet('siteUsers')) || {};
        this.error = null;
      } catch (error) {
        console.error('Could not read the site user list', error);
        this.error = 'Couldn’t load the list. Reload the page.';
      } finally {
        this.loaded = true;
      }
    },
    async decide (person, status) {
      if (this.busy) return;
      this.busy = person.uid;
      this.error = null;
      try {
        await dbPatch(`siteUsers/${person.uid}`, { status, decidedAt: { '.sv': 'timestamp' } });
        this.rows = { ...this.rows, [person.uid]: { ...this.rows[person.uid], status } };
      } catch (error) {
        console.error('Could not save that decision', error);
        this.error = 'That didn’t save. Try again.';
      } finally {
        this.busy = null;
      }
    }
  },
  mounted () {
    this.load();
  }
};
</script>

<style lang="scss">
.access-requests {
  margin: 0 auto;
  max-width: 640px;
  padding: 1rem 1rem 4rem;

  &__title {
    color: white;
    font-size: 1.25rem;
    margin-bottom: 0.25rem;
  }

  &__blurb {
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.8rem;
    line-height: 1.5;
    margin-bottom: 1.25rem;

    a { color: white; }
  }

  &__section { margin-bottom: 2rem; }

  &__heading {
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  &__row {
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.25);
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 0;
  }

  &__avatar {
    border-radius: 50%;
    flex: none;
    height: 36px;
    width: 36px;
  }

  &__who {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    color: white;
    font-size: 0.92rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__email,
  &__when {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.72rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    align-items: center;
    display: flex;
    flex: none;
    gap: 0.4rem;
  }

  &__status {
    color: white;
    font-size: 0.75rem;

    &.is-denied { color: rgba(255, 255, 255, 0.65); }
  }

  &__empty,
  &__note {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8rem;
    line-height: 1.5;
  }

  &__note {
    border-top: 1px solid rgba(255, 255, 255, 0.25);
    font-size: 0.72rem;
    margin-top: 2rem;
    padding-top: 1rem;

    code { color: white; }
  }

  &__error {
    color: #ffe08a;
    font-size: 0.85rem;
  }
}
</style>
