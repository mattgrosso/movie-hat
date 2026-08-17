<template>
  <div class="hats col-12 px-3 mb-5">
    <div v-if="message" class="message px-3 text-white">
      <p class="m-0">{{ message }}</p>
    </div>
    <div v-if="loading" class="loading d-flex justify-content-center my-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
    <div v-if="!loading" class="hats-list">
      <ul v-if="sortedMemberHats.length" class="p-0 m-0">
        <li class="card my-3" v-for="(hat, hatIndex) in sortedMemberHats" :key="hatIndex">
          <div class="card-header d-flex justify-content-between">
            <button v-if="canDelete(hat)" class="btn btn-danger ms-1" title="Delete hat" data-bs-toggle="modal" data-bs-target="#deleteHatModal" @click="deleteHatTarget = hat">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
              </svg>
            </button>
            <button v-else class="btn btn-outline-danger ms-1" title="Leave hat" data-bs-toggle="modal" data-bs-target="#leaveHatModal" @click="leaveHatTarget = hat">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-right" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"/>
                <path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/>
              </svg>
            </button>
            <button class="btn btn-primary" @click="goToHat(hat)">{{hat.title}}</button>
          </div>
          <div class="card-body p-3">
            <p class="card-subtitle text-muted">Members</p>
            <ul class="list-group list-group-flush mb-3">
              <li class="member list-group-item d-flex" v-for="(member, memberIndex) in hat.members" :key="memberIndex">
                <div class="col-8">{{member}}</div>
                <div class="col-4 d-flex justify-content-end">
                  <a class="text-decoration-none" target="_blank" :href="`mailto:${member}?subject=Join%20my%20movie%20hat&body=I've%20added%20you%20to%20my%20movie%20hat%20so%20we%20can%20decide%20what%20to%20watch%20together.%20You%20can%20visit%20movie-hat.com%20to%20see%20our%20hat%20and%20to%20add%20movies%20to%20it.`">
                    Send invite
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-envelope" viewBox="0 0 16 16">
                      <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/>
                    </svg>
                  </a>
                </div>
              </li>
            </ul>
            <div class="input-group input-group-sm col-8">
              <input :ref="`newMemberInput${hatIndex}`" type="text" class="form-control" placeholder="Add Member" aria-label="Add Member" aria-describedby="add-member-button">
              <button class="btn btn-secondary" type="button" id="add-member-button" @click="addNewMemberTo(hat, hatIndex)">Add</button>
            </div>
          </div>
        </li>
      </ul>
      <div v-else class="card mb-3">
        <div class="card-body">
          <p>It looks like you're not a member of any hats yet.</p>
          <p>You should make a new one or ask a friend to add you to theirs.</p>
        </div>
      </div>
    </div>
    <div v-if="!loading" class="button-wrapper d-flex justify-content-end">
      <button class="btn btn-primary d-flex align-items-center" data-bs-toggle="modal" data-bs-target="#newHatModal">
        Add New Hat
      </button>
    </div>

    <!-- Modals -->
    <div class="modal fade" id="newHatModal" tabindex="-1" aria-labelledby="newHatModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header">
            <h1 class="modal-title fs-5" id="newHatModalLabel">Create New Hat</h1>
            <button ref="closeNewHatModal" type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"/>
          </div>
          <div class="modal-body" @keyup.enter="clickAddHatModalButton">
            <input
              class="form-control"
              placeholder="Hat Title"
              type="text"
              v-model="newHatTitle"
            />
            <div v-if="message" class="message form-text">
              {{ message }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button ref="addHatButton" type="button" class="btn btn-primary" @click="addHat">Add Hat</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="leaveHatModal" tabindex="-1" aria-labelledby="leaveHatModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header">
            <h1 class="modal-title fs-5" id="leaveHatModalLabel">Leave {{leaveHatTarget?.title}}?</h1>
            <button ref="closeLeaveHatModal" type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"/>
          </div>
          <div class="modal-body">
            <p>The hat and its movies stay with the other members — you just won't see it anymore. A member can always add you back.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" @click="leaveHat(leaveHatTarget)">Leave {{leaveHatTarget?.title}}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="deleteHatModal" tabindex="-1" aria-labelledby="deleteHatModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header">
            <h1 class="modal-title fs-5" id="deleteHatModalLabel">Delete {{deleteHatTarget?.title}}?</h1>
            <button ref="closeDeleteHatModal" type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"/>
          </div>
          <div class="modal-body" @keyup.enter="clickDeleteHatModalButton">
            <p>Are you sure? This can't be undone.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" @click="deleteHat(deleteHatTarget)">Delete {{deleteHatTarget?.title}}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { dbDelete, dbGet, dbPatch, dbPost, dbPut, hatPath } from '../store/db.js';
import { emailToMemberKey } from '../store/memberKey.mjs';

export default {
  data () {
    return {
      loading: false,
      newHatTitle: null,
      deleteHatTarget: null,
      leaveHatTarget: null,
      memberHats: [],
      message: null
    }
  },
  async mounted () {
    this.loading = true;
    await this.getMemberHats();
    this.loading = false;
  },
  computed: {
    sortedMemberHats () {
      const sorted = [...this.memberHats];

      sorted.sort((a, b) => {
        if (this.mostRecentTimeStamp(a.history) < this.mostRecentTimeStamp(b.history)) {
          return 1;
        } else if (this.mostRecentTimeStamp(a.history) > this.mostRecentTimeStamp(b.history)) {
          return -1;
        } else {
          return 0;
        }
      });

      return sorted;
    }
  },
  methods: {
    async getMemberHats () {
      // Was: download every hat in the app and filter client-side. That stops
      // working the moment you can't read hats you don't belong to, which is
      // the whole point of the lockdown — so ask for your own index instead.
      const memberKey = emailToMemberKey(this.$store.state.email);
      if (!memberKey) return;

      let mine = null;
      try {
        mine = await dbGet(`userHats/${memberKey}`);
      } catch {
        this.$store.commit('setAppError', "Couldn't load your hats. You may need to sign in again.");
        this.memberHats = [];
        return;
      }

      if (!mine) {
        this.memberHats = [];
        return;
      }

      const hats = await Promise.all(
        Object.entries(mine).map(async ([entryKey, { title, hatKey }]) => {
          try {
            const hat = await dbGet(hatPath(title, hatKey));
            if (!hat) return null;

            // Entries used to be keyed by a safe form of the TITLE, which
            // collides the moment two hats share one. The hatKey IS the
            // identity, so a legacy entry gets re-keyed in place — our own
            // index is ours to rewrite. (Cinema Roll reads these entries by
            // VALUE, never by key, so this is invisible to it.)
            if (entryKey !== hatKey) {
              try {
                await dbPut(`userHats/${memberKey}/${hatKey}`, { title, hatKey });
                await dbDelete(`userHats/${memberKey}/${entryKey}`);
              } catch { /* still readable under the old key; retried next load */ }
            }

            return { ...hat, title, subKey: hatKey };
          } catch (error) {
            // A refusal means the hat is gone or we were removed from it —
            // either way the entry opens nothing, so clean it out of our own
            // index rather than let it break this list forever. Anything
            // else (network trouble) leaves the entry alone.
            if (error.status === 401 || error.status === 403) {
              try {
                await dbDelete(`userHats/${memberKey}/${entryKey}`);
              } catch { /* the entry survives to try again */ }
            }
            return null;
          }
        })
      );

      // A hat mid-rekey can appear under both its old and new entry for one
      // load; the key dedupes it.
      const byKey = new Map();
      hats.filter(Boolean).forEach((hat) => byKey.set(hat.subKey, hat));
      this.memberHats = [...byKey.values()];
    },
    async addHat () {
      this.message = null;

      const webSafe = encodeURIComponent(this.newHatTitle);
      const email = this.$store.state.email;
      const memberKey = emailToMemberKey(email);
      const newHat = {
        title: this.newHatTitle,
        members: [email],
        // The rules read this, not the list above. Without it the creator
        // can't read back the hat they just made.
        memberEmails: { [memberKey]: true },
        // Deleting the whole hat is the creator's call (hats from before
        // this field stay deletable by any member).
        createdBy: memberKey
      }

      // No duplicate-title check anymore: the rules deny the title-level
      // read it needed, and the hatKey is the identity now — two hats
      // sharing a title is confusing but harmless, exactly like two people
      // sharing a name.
      const created = await dbPost(`hats/${webSafe}`, newHat);

      // "Which hats are mine", the other half of the index — keyed by the
      // hat's KEY, its actual identity.
      if (created?.name) {
        await dbPut(`userHats/${memberKey}/${created.name}`, {
          title: this.newHatTitle,
          hatKey: created.name
        });
      }

      this.getMemberHats();
      this.message = null;
      this.$refs.closeNewHatModal.click();

      this.newHatTitle = null;
    },
    async addNewMemberTo (hat, index) {
      const input = this.$refs[`newMemberInput${index}`][0];

      if (!this.validateEmail(input.value)) {
        this.showMessage("Please use an email address to add members.", 10000);

        input.value = null;
        return;
      }

      const newMember = input.value;
      const newMemberKey = emailToMemberKey(newMember);
      // Hats made before the app existed as it is now store members as a
      // push-key map; newer ones as an array. Spreading the map would throw.
      const members = Array.isArray(hat.members) ? hat.members : Object.values(hat.members || {});

      if (members.some((email) => emailToMemberKey(email) === newMemberKey)) {
        this.showMessage(`${newMember} is already a member of ${hat.title}.`, 5000);
        input.value = null;
        return;
      }

      // Patch ONLY what changed. This used to send the whole hat object back,
      // which included the page-load copies of `movies` and `history` — and a
      // PATCH replaces each key it names, so anything another member had added
      // since this page loaded was silently overwritten.
      await dbPatch(hatPath(hat.title, hat.subKey), {
        members: [...members, newMember],
        memberEmails: { ...(hat.memberEmails || {}), [newMemberKey]: true }
      });

      // So the hat shows up for them without them having to find it. If this
      // half is refused, their membership above still stands.
      try {
        await dbPut(`userHats/${newMemberKey}/${hat.subKey}`, {
          title: hat.title,
          hatKey: hat.subKey
        });
      } catch (error) {
        console.warn("Couldn't write the new member's hat index", error);
      }

      input.value = null;
      this.getMemberHats();
    },
    goToHat (hat) {
      this.$store.commit("setCurrentHat", { title: hat.title, hatKey: hat.subKey });
      this.$store.dispatch("getHat");

      window.scroll({
        top: 0,
        behavior: 'smooth'
      });

      this.$router.push("/");
    },
    async deleteHat (hat) {
      if (!hat) return;

      // Delete the RECORD, not the title node. Access is granted per hat, so
      // once the rules are on, a write at `hats/<title>` sits at a level
      // nobody is allowed to write and the delete would simply be refused.
      // dbDelete throws if the database refuses, so reaching the next line
      // means it went through — the old axios status check could never fail.
      await dbDelete(hatPath(hat.title, hat.subKey));

      // Our own index entry goes now. Other members' entries clean themselves
      // up the next time they load this list and find the hat unreadable
      // (see getMemberHats) — which also means this works once the rules stop
      // letting us write other people's indexes.
      const myKey = emailToMemberKey(this.$store.state.email);
      try {
        await dbDelete(`userHats/${myKey}/${hat.subKey}`);
      } catch (error) {
        console.warn("Couldn't remove the hat from your index", error);
      }

      // A default pointing at a hat that no longer exists would error on
      // every load until it self-healed.
      if (this.$store.state.dbKeyForHatTitle === hat.subKey) {
        this.$store.commit('setCurrentHat', null);
      }

      this.getMemberHats();
      this.$refs.closeDeleteHatModal.click();
      this.deleteHatTarget = null;
    },
    // Deleting a hat is the creator's call; anyone else gets "leave". Hats
    // from before createdBy existed have no creator on record, so they keep
    // the old anyone-may-delete behavior — and the last member standing may
    // always delete, since leaving would only orphan the hat.
    canDelete (hat) {
      const myKey = emailToMemberKey(this.$store.state.email);
      const members = Array.isArray(hat.members) ? hat.members : Object.values(hat.members || {});
      return !hat.createdBy || hat.createdBy === myKey || members.length <= 1;
    },
    async leaveHat (hat) {
      if (!hat) return;

      const myKey = emailToMemberKey(this.$store.state.email);
      const members = (Array.isArray(hat.members) ? hat.members : Object.values(hat.members || {}))
        .filter((email) => emailToMemberKey(email) !== myKey);

      // One atomic write, while we are still a member and allowed to make
      // it. The memberEmails removal is path-targeted so nobody else's
      // concurrent changes ride along.
      await dbPatch(hatPath(hat.title, hat.subKey), {
        members,
        [`memberEmails/${myKey}`]: null
      });

      try {
        await dbDelete(`userHats/${myKey}/${hat.subKey}`);
      } catch (error) {
        console.warn("Couldn't remove the hat from your index", error);
      }

      if (this.$store.state.dbKeyForHatTitle === hat.subKey) {
        this.$store.commit('setCurrentHat', null);
      }

      this.getMemberHats();
      this.$refs.closeLeaveHatModal.click();
      this.leaveHatTarget = null;
    },
    validateEmail (email) {
      const valid = String(email)
        .toLowerCase()
        .match(
          /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );

      return Boolean(valid);
    },
    clickAddHatModalButton () {
      this.$refs.addHatButton.click();
    },
    showMessage (message, delay, callBack) {
      delay = delay || 30000;

      this.message = message;

      setTimeout(() => {
        this.message = null;
        if (callBack) {
          callBack();
        }
      }, delay);
    },
    mostRecentTimeStamp (historyObj) {
      if (!historyObj) {
        return Date.now();
      }

      const history = Object.keys(historyObj).map((key) => {
        return historyObj[key];
      });

      let mostRecent;

      history.forEach((item) => {
        if (!mostRecent) {
          mostRecent = item.dateDrawn;
        } else if (item.dateDrawn > mostRecent) {
          mostRecent = item.dateDrawn;
        }
      });

      return mostRecent;
    }
  },
}
</script>

<style lang="scss">
  .hats {
    // Reading a members list across a whole desktop screen is a chore;
    // phones keep the full width they always had.
    @media (min-width: 768px) {
      max-width: 720px;
      margin: 0 auto;
    }

    .hats-list {
      .member {
        a {
          font-size: 0.75rem;
        }
      }
    }
  }

  ul {
    list-style: none;
  }
</style>