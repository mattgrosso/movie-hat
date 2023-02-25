import axios from 'axios';
import { createStore } from 'vuex'

export default createStore({
  state: {
    email: null,
    movieHat: null,
    history: null,
    movieHatTitle: null,
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
      state.movieHatTitle = value;
    },
    setHistory (state, value) {
      state.history = value;
    },
    setDrawnMovie (state, value) {
      state.drawnMovie = value;
    },
    setMovieChoices (state, value) {
      state.movieChoices = value;
    }
  },
  actions: {
    async getMovieHat (context) {
      const respForKey = await axios.get(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${context.state.movieHatTitle}.json`
      );

      if (!respForKey.data) {
        return;
      }

      const dbKey = Object.keys(respForKey.data)[0]

      const resp = await axios.get(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${context.state.movieHatTitle}/${dbKey}/movies.json`
      );

      if (resp.statusText === 'OK') {
        let hatAsArray = [];

        if (resp.data) {
          hatAsArray = Object.keys(resp.data).map((key) => {
            const movie = { ...resp.data[key], dbKey: key };
            return movie;
          });
        }

        this.commit('setMovieHat', hatAsArray);
      } else {
        console.log(resp);
      }
    },
    async getHistory (context) {
      const respForKey = await axios.get(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${context.state.movieHatTitle}.json`
      );

      if (!respForKey.data) {
        return;
      }

      const dbKey = Object.keys(respForKey.data)[0]

      const resp = await axios.get(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${context.state.movieHatTitle}/${dbKey}/history.json`
      );

      if (resp.statusText === 'OK' && resp.data) {
        let history = [];

        if (resp.data) {
          history = Object.keys(resp.data).map((key) => {
            const movie = { ...resp.data[key], dbKey: key };
            return movie;
          });
        }

        this.commit('setHistory', history);
      } else {
        console.log(resp);
      }
    }
  },
  modules: {
  }
})
