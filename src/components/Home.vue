<template>
  <div class="home px-3 py-5 d-flex justify-content-center flex-wrap">
    <div v-if="$store.state.email" class="user-email badge rounded-pill text-bg-dark">
      <p class="text-white m-0" data-bs-toggle="modal" data-bs-target="#logOutModal">
        {{$store.state.email}}
      </p>
    </div>
    <HatsList/>
    <Hat class="d-none"/>

    <!-- Modals -->
    <div class="modal fade" id="logOutModal" tabindex="-1" aria-labelledby="logOutModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header">
            <h1 class="modal-title fs-5" id="logOutModalLabel">Logout</h1>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            Do you want to log out?
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Nevermind</button>
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal" @click="logOut">Log Out</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import HatsList from "./HatsList.vue";
import Hat from "./Hat.vue";

export default {
  components: {
    HatsList,
    Hat
  },
  mounted () {
    this.$store.dispatch('getMovieHat');
    this.$store.dispatch('getHistory');
  },
  methods: {
    logOut () {
      window.localStorage.removeItem('movieHatEmail');
      this.$store.commit('setEmail', null);
    }
  },
}
</script>

<style lang="scss">
  hr {
    border-top: 1px solid white;
    opacity: 1;
    width: 90%;
  }

  .home {
    position: relative;

    .user-email {
      cursor: pointer;
      position: absolute;
      top: 0;
      left: 6px;
    }

    .back-to-top {
      background: white;
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
      box-shadow: 0px 0px 6px 0px #adadad;
      cursor: pointer;
      display: flex;
      left: 50%;
      max-height: 50px;
      position: fixed;
      top: 0;
      transform: translateX(-50%);
      transition: 0.25s max-height ease-in-out;
      overflow: hidden;

      &.hidden {
        max-height: 0;
      }

      span {
        font-size: 0.75rem;
        padding: 6px 24px;
      }
    }
  }
</style>