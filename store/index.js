import Vuex from 'vuex';
import axios from 'axios';

const createStore = () => {
  return new Vuex.Store({
    state: {
      loadedMovies: [],
    },
    getters: {
      loadedMovies(state) {
        return state.loadedMovies;
      },
    },
    mutations: {
      setMovies(state, movies) {
        state.loadedMovies = movies;
      },
    },
    actions: {
      async nuxtServerInit(vuexContext, context) {
        const movies = await this.dispatch('loadMovies');
        vuexContext.commit('setMovies', movies);
      },
      async loadMovies() {
        const resp = await axios.get(
          'https://movie-hat-9c418-default-rtdb.firebaseio.com/movies.json'
        );

        if (resp.statusText == 'OK') {
          const movies = Object.keys(resp.data).map((key) => {
            return resp.data[key];
          });

          this.commit('setMovies', movies);
          return movies;
        } else {
          console.log(resp);
          return [];
        }
      },
    },
  });
};

export default createStore;
