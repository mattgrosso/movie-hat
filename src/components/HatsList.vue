<template>
  // Todo: Make sure hat names dont blow away older hats
  // todo: Adding someone to a het should email them. 
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
      <ul v-if="memberHats.length" class="p-0 m-0">
        <li class="card my-3" v-for="(hat, index) in memberHats" :key="index">
          <div class="card-header text-end">
            <button class="btn btn-primary" @click="goToHat(index)">{{hat.title}}</button>
          </div>
          <div class="card-body p-3">
            <p class="card-subtitle text-muted">Members</p>
            <ul class="list-group list-group-flush mb-3">
              <li class="list-group-item" v-for="(member, index) in hat.members" :key="index">
                {{member}}
              </li>
            </ul>
            <div class="input-group input-group-sm col-8">
              <input :ref="`newMemberInput${index}`" type="text" class="form-control" placeholder="Add Member" aria-label="Add Member" aria-describedby="add-member-button">
              <button class="btn btn-secondary" type="button" id="add-member-button" @click="addNewMemberTo(index)">Add</button>
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
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"/>
          </div>
          <div class="modal-body" @keyup.enter="clickModalButton">
            <input
              class="form-control"
              placeholder="Hat Title"
              type="text"
              v-model="newHatTitle"
            />
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button ref="addHatButton" type="button" class="btn btn-primary" data-bs-dismiss="modal" @click="addHat">Add Hat</button>
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
        this.showMessage("That hat title is already in use, please try another title.", 10000);
      } else {
        await axios.post(
          `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${webSafe}.json`,
          newHat
        );

        this.getMemberHats();
      }

      this.newHatTitle = null;
    },
    async addNewMemberTo (index) {
      const hat = this.memberHats[index];
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
    goToHat (index) {
      const title = this.memberHats[index].title;
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
    }
  },
}
</script>

<style lang="scss">
  ul {
    list-style: none;
  }
</style>