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
          <div class="card-header text-end">
            <button class="btn btn-primary" @click="goToHat(hat.title)">{{hat.title}}</button>
          </div>
          <div class="card-body p-3">
            <p class="card-subtitle text-muted">Members</p>
            <ul class="list-group list-group-flush mb-3">
              <li class="member list-group-item d-flex" v-for="(member, memberIndex) in hat.members" :key="memberIndex">
                <div class="col-8">{{member}}</div>
                <div class="col-4 d-flex justify-content-end">
                  <a class="text-decoration-none" target="_blank" :href="`mailto:${member}?subject=Join%20my%20movie%20hat&body=I've%20added%20you%20to%20my%20movie%20hat%20so%20we%20can%20decide%20what%20to%20watch%20together.%20You%20can%20visit%20movie-hat.surge.sh%20to%20see%20our%20hat%20and%20to%20add%20movies%20to%20it.`">
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
              <button class="btn btn-secondary" type="button" id="add-member-button" @click="addNewMemberTo(hat.title, hatIndex)">Add</button>
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
          <div class="modal-body" @keyup.enter="clickModalButton">
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
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data () {
    return {
      loading: false,
      newHatTitle: null,
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
    sortedMemberHats() {
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
      const allHats = await axios.get(`https://movie-hat-9c418-default-rtdb.firebaseio.com/hats.json`);

      if (!allHats.data) {
        return;
      }

      const data = allHats.data

      const allHatsAsArray = Object.keys(data).map((hat) => {
        const subKey = Object.keys(data[hat])[0];
        return {
          ...data[hat][subKey],
          subKey: Object.keys(data[hat])[0]
        };
      });

      this.memberHats = allHatsAsArray.filter((hat) => {
        if (hat.members) {
          return hat.members.includes(this.$store.state.email);
        } else {
          return false;
        }
      });
    },
    async addHat () {
      this.message = null;

      const webSafe = encodeURIComponent(this.newHatTitle);
      const newHat = {
        title: this.newHatTitle,
        members: [this.$store.state.email]
      }

      const alreadyExists = await axios.get(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${webSafe}.json`,
        newHat
      );

      if (alreadyExists.data) {
        this.showMessage("That hat title is already in use, please try another title.", 5000);
      } else {
        await axios.post(
          `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${webSafe}.json`,
          newHat
        );

        this.getMemberHats();
        this.message = null;
        this.$refs.closeNewHatModal.click();
      }

      this.newHatTitle = null;
    },
    async addNewMemberTo (title, index) {
      const hat = this.memberHats.find((hat) => hat.title === title);
      const input = this.$refs[`newMemberInput${index}`][0];

      if (!this.validateEmail(input.value)) {
        this.showMessage("Please use an email address to add members.", 10000);

        input.value = null;
        return;
      }

      const payload = {
        ...hat,
        members: [...hat.members, input.value]
      }

      await axios.patch(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${hat.title}/${hat.subKey}.json`,
        payload
      );

      input.value = null;
      this.getMemberHats();
    },
    goToHat (title) {
      this.$store.commit("setMovieHatTitle", title);
      this.$store.dispatch("getHat");

      window.scroll({
        top: top,
        behavior: 'smooth'
      });

      this.$router.push("/");
    },
    validateEmail (email) {
      const valid = String(email)
        .toLowerCase()
        .match(
          /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );

      return Boolean(valid);
    },
    clickModalButton () {
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