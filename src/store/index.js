import axios from 'axios';
import { createStore } from 'vuex'

export default createStore({
  state: {
    movieHat: null,
    history: null,
    databasePrefix: "dev-",
    drawnMovie: null,
    movieChoices: null
  },
  getters: {
  },
  mutations: {
    setMovieHat (state, value) {
      state.movieHat = value;
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
      const resp = await axios.get(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/${context.state.databasePrefix}hat.json`
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
      const resp = await axios.get(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/${context.state.databasePrefix}history.json`
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
