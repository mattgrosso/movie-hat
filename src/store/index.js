import axios from 'axios';
import { createStore } from 'vuex'

export default createStore({
  state: {
    email: null,
    movieHat: null,
    history: null,
    members: null,
    movieHatTitle: null,
    dbKeyForHatTitle: null,
    drawnMovie: null,
    movieChoices: null
  },
  getters: {
  },
  mutations: {
    setEmail (state, value) {
      window.localStorage.setItem('movieHatEmail', JSON.stringify(value));
      state.email = value;
    },
    setMovieHat (state, value) {
      state.movieHat = value;
    },
    setMovieHatTitle (state, value) {
      window.localStorage.setItem('defaultMovieHatTitle', JSON.stringify(value));
      state.movieHatTitle = value;
    },
    setDbKeyForHatTitle (state, value) {
      state.dbKeyForHatTitle = value;
    },
    setHistory (state, value) {
      state.history = value;
    },
    setMembers (state, value) {
      state.members = value;
    },
    setDrawnMovie (state, value) {
      state.drawnMovie = value;
    },
    setMovieChoices (state, value) {
      state.movieChoices = value;
    }
  },
  actions: {
    async getHat (context) {
      const respForKey = await axios.get(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${context.state.movieHatTitle}.json`
      );

      if (!respForKey.data) {
        return;
      }

      const dbKey = Object.keys(respForKey.data)[0];
      context.commit("setDbKeyForHatTitle", dbKey);

      const resp = await axios.get(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${context.state.movieHatTitle}/${dbKey}.json`
      );

      if (resp.statusText === 'OK' && resp.data) {
        let hatAsArray = [];

        if (resp.data.movies) {
          hatAsArray = Object.keys(resp.data.movies).map((key) => {
            const movie = { ...resp.data.movies[key], dbKey: key };
            return movie;
          });
        }

        let history = [];

        if (resp.data.history) {
          history = Object.keys(resp.data.history).map((key) => {
            const movie = { ...resp.data.history[key], dbKey: key };
            return movie;
          });
        }

        this.commit('setMembers', resp.data.members);
        this.commit('setMovieHat', hatAsArray);
        this.commit('setHistory', history);
      } else {
        console.log(resp);
      }
    }
  },
  modules: {
  }
})
