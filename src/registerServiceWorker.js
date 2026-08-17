/* eslint-disable no-console */

import { register } from 'register-service-worker'
import store from './store'

if (process.env.NODE_ENV === 'production') {
  register(`${process.env.BASE_URL}service-worker.js`, {
    ready () {
      console.log(
        'App is being served from cache by a service worker.\n' +
          'For more details, visit https://goo.gl/AFskqB'
      )
    },
    registered () {
      console.log('Service worker has been registered.')
    },
    cached () {
      console.log('Content has been cached for offline use.')
    },
    updatefound () {
      console.log('New content is downloading.')
    },
    updated () {
      // This used to call window.location.reload() unconditionally — the
      // moment a new version finished installing, the page reloaded out
      // from under whatever the user was doing (Cinema Roll shipped that
      // exact bug and learned better in July 2026). Now it just flags it;
      // App.vue applies the update at a quiet moment, with
      // UpdateAvailableBanner as the manual fallback.
      console.log('New content is available.');
      store.commit('setUpdateAvailable', true);
    },
    offline () {
      console.log('No internet connection found. App is running in offline mode.')
    },
    error (error) {
      console.error('Error during service worker registration:', error)
    }
  })
}
