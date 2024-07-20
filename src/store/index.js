import axios from 'axios';
import { createStore } from 'vuex'
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDlfyRC1BgoQ6UCPKsX-dvFC9HumeEwGjg",
  authDomain: "movie-hat-9c418.firebaseapp.com",
  databaseURL: "https://movie-hat-9c418-default-rtdb.firebaseio.com",
  projectId: "movie-hat-9c418",
  storageBucket: "movie-hat-9c418.appspot.com",
  messagingSenderId: "1061874698443",
  appId: "1:1061874698443:web:b2326dbc709a9237c2b34e"
};

initializeApp(firebaseConfig);

export default createStore({
  state: {
    email: null,
    name: null,
    movieHat: null,
    history: null,
    members: null,
    movieHatTitle: null,
    dbKeyForHatTitle: null,
    drawnMovie: null,
    movieChoices: null
  },
  getters: {
    isDevHat: (state) => {
      return state.movieHatTitle === 'Dev Hat';
    }
  },
  mutations: {
    setEmail (state, value) {
      window.localStorage.setItem('movieHatEmail', JSON.stringify(value));
      state.email = value;
    },
    setName (state, value) {
      window.localStorage.setItem('movieHatName', JSON.stringify(value));
      state.name = value;
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
    async login (context) {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();

      try {
        const result = await signInWithPopup(auth, provider);
        // const token = result.user.stsTokenManager.accessToken; // This is the Google API access token.
        // const user = result.user; // The signed-in user info.

        // Handle the result.
        if (result) {
          const userData = result.user;
          console.log('userData: ', userData);
          context.commit('setEmail', userData.email);

          if (userData.displayName) {
            context.commit('setName', userData.displayName);
          }
        }
      } catch (error) {
        console.error(error);
      }
    },
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
