<template>
  <div class="header-wrapper pb-5">
    <div class="header d-flex justify-content-center align-items-center">
      <h1 class="col-12 d-flex justify-content-center">
        <span>
          Movie Hat
        </span>
        <div class="mat"></div>
      </h1>
    </div>
    <div
      v-if="$store.state.email"
      class="user-email badge rounded-pill text-bg-dark"
    >
      <p class="text-white m-0" data-bs-toggle="modal" data-bs-target="#logOutModal">
        {{$store.state.email}}
      </p>
    </div>
    <div
      v-if="$store.state.movieHatTitle"
      class="current-hat badge rounded-pill text-bg-dark"
      @click="$router.push('/hat-list')"
    >
      <p class="text-white m-0">
        {{$store.state.movieHatTitle}}
      </p>
    </div>

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
export default {
  methods: {
    logOut () {
      window.localStorage.removeItem('movieHatEmail');
      this.$store.commit('setEmail', null);
    }
  },
}
</script>

<style lang="scss">
  .header-wrapper {
    position: relative;

    .header {
      h1 {
        background: white;
        border: 12px solid black;
        box-shadow: inset 0px 0px 9px 0px #424242;
        font-family: "Monoton", cursive;
        height: 150px;
        margin: 6px;
        overflow: hidden;
        position: relative;
        width: calc(100% - 12px);

        span {
          align-items: center;
          background: black;
          color: #6ba2dc;
          display: flex;
          font-size: 2.5rem;
          height: 100%;
          justify-content: center;
          padding: 24px 64px;
          white-space: nowrap;
          width: 100%;
        }

        .mat {
          border: 24px solid white;
          bottom: 0;
          left: 0;
          position: absolute;
          right: 0;
          top: 0;
        }
      }
    }

    .rounded-pill {
      cursor: pointer;
      position: absolute;
      bottom: calc(3rem - 24px);
    }

    .user-email {
      left: 6px;
    }

    .current-hat {
      right: 6px;
    }
  }
</style>