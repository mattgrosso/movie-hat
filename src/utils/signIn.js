// What a failed Google sign-in means (Sentry, 2026-10-26).
//
// Someone on an Android phone tapped "Sign in with Google" twice. The second
// tap opened a fresh Google window, Firebase cancelled the first with
// auth/cancelled-popup-request, and login's console.error filed it in Sentry
// as a bug. Closing the window or tapping again is a choice, not a failure:
// those stay quiet (Cinema Roll's list, movieHatSignIn.js). A blocked window
// gets a sentence saying what to do; anything else is still logged.

/** Firebase's own "you closed it" answers. */
const DISMISSALS = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

export function isSignInDismissal (error) {
  return DISMISSALS.includes(error?.code);
}

const MESSAGES = {
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for Movie Hat (on an iPhone: Settings, Safari, turn off Block Pop-ups) and try again.'
};

/** The sentence to show for a failure, or null when there is nothing to say. */
export function signInMessage (error) {
  return MESSAGES[error?.code] || null;
}
