import Vuex from 'vuex';
import axios from 'axios';

const createStore = () => {
  return new Vuex.Store({
    state: {
      hat: [],
      history: [],
    },
    getters: {
      hat(state) {
        return state.hat;
      },
    },
    mutations: {
      setHat(state, movies) {
        state.hat = movies;
      },
      setHistory(state, movies) {
        state.history = movies;
      },
    },
    actions: {
      async nuxtServerInit(vuexContext, context) {
        const movies = await this.dispatch('loadHat');
        vuexContext.commit('setHat', movies);
        const history = await this.dispatch('loadHistory');
        vuexContext.commit('setHistory', movies);
      },
      async loadHat() {
        const resp = await axios.get(
          'https://movie-hat-9c418-default-rtdb.firebaseio.com/hat.json'
        );

        if (resp.statusText == 'OK') {
          let movies = [];

          if (resp.data) {
            movies = Object.keys(resp.data).map((key) => {
              const movie = { ...resp.data[key], id: key };
              return movie;
            });
          }

          this.commit('setHat', movies);
          return movies;
        } else {
          console.log(resp);
          return [];
        }
      },
      async loadHistory() {
        const resp = await axios.get(
          'https://movie-hat-9c418-default-rtdb.firebaseio.com/history.json'
        );

        if (resp.statusText == 'OK' && resp.data) {
          let history = [];

          if (resp.data) {
            history = Object.keys(resp.data).map((key) => {
              const movie = { ...resp.data[key], id: key };
              return movie;
            });
          }

          this.commit('setHistory', history);
          return history;
        } else {
          console.log(resp);
          return [];
        }
      },
    },
  });
};

export default createStore;
