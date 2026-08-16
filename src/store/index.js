import { createStore } from 'vuex'
import { dbGet, hatPath, resolveHatKey } from './db.js'
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";

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
    // Whether Firebase itself says we're signed in, as opposed to an email
    // remembered in localStorage. Null until onAuthStateChanged first fires.
    //
    // These were the same thing until 2026-08-16, which was the problem: the
    // app trusted `movieHatEmail` in localStorage and never checked the
    // session behind it. That works only while the database lets anyone
    // read and write. The moment the rules require a signed-in user, a
    // remembered email with no live session means the app looks logged in
    // and every request fails.
    authUser: null,
    authResolved: false,
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
    setAuthUser (state, user) {
      state.authUser = user;
      state.authResolved = true;
    },
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
    /**
     * Subscribe to the real session. Called once at start-up.
     *
     * When Firebase says there IS a user we adopt its email, so the two can
     * never disagree. When it says there is NOT, the remembered email is
     * left in place for now — the rules are still open, so the app keeps
     * working — but `authUser` stays null, which is what the sign-in gate
     * will look at once the rules are closed.
     */
    watchAuth (context) {
      onAuthStateChanged(getAuth(), (user) => {
        context.commit('setAuthUser', user || null);

        if (user?.email) {
          context.commit('setEmail', user.email);
          if (user.displayName) context.commit('setName', user.displayName);
        }
      });
    },
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
      const dbKey = await resolveHatKey(context.state.movieHatTitle, context.state.email);

      if (!dbKey) {
        return;
      }

      context.commit("setDbKeyForHatTitle", dbKey);

      const resp = { data: await dbGet(hatPath(context.state.movieHatTitle, dbKey)) };

      if (resp.data) {
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
