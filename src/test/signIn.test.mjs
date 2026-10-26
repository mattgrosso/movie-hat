// @vitest-environment jsdom
//
// Google sign-in failures (Sentry, 2026-10-26): a double tap on "Sign in
// with Google" cancelled the first window and filed a Sentry error. A
// dismissal stays quiet, a blocked window gets a sentence, anything else is
// still logged, and the button is off while a sign-in is under way.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const signInWithPopup = vi.fn();

vi.mock('firebase/auth', async (importOriginal) => ({
  ...(await importOriginal()),
  getAuth: vi.fn(() => ({})),
  signInWithPopup: (...args) => signInWithPopup(...args)
}));

vi.mock('../store/db.js', () => ({
  dbGet: vi.fn(),
  dbPut: vi.fn(),
  dbPatch: vi.fn(),
  hatPath: (title, ...rest) => ['hats', title, ...rest].join('/'),
  resolveHatKey: vi.fn()
}));

const { default: store } = await import('../store/index.js');
const { default: Login } = await import('../components/Login.vue');
const { isSignInDismissal, signInMessage } = await import('../utils/signIn.js');

const failure = (code) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });

let errorSpy;
beforeEach(() => {
  signInWithPopup.mockReset();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe('signIn helpers', () => {
  it('counts a closed window, a second tap and a cancel as dismissals', () => {
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) {
      expect(isSignInDismissal(failure(code))).toBe(true);
    }
    expect(isSignInDismissal(failure('auth/network-request-failed'))).toBe(false);
  });

  it('has a sentence for a blocked window and nothing for the rest', () => {
    expect(signInMessage(failure('auth/popup-blocked'))).toMatch(/blocked the Google sign-in window/);
    expect(signInMessage(failure('auth/internal-error'))).toBeNull();
  });
});

describe('login action', () => {
  it('stays quiet when the window was cancelled by a second tap', async () => {
    signInWithPopup.mockRejectedValue(failure('auth/cancelled-popup-request'));
    expect(await store.dispatch('login')).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('stays quiet when the window was closed', async () => {
    signInWithPopup.mockRejectedValue(failure('auth/popup-closed-by-user'));
    expect(await store.dispatch('login')).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns a sentence, without logging, when the window was blocked', async () => {
    signInWithPopup.mockRejectedValue(failure('auth/popup-blocked'));
    expect(await store.dispatch('login')).toMatch(/Allow pop-ups for Movie Hat/);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('still logs a real failure', async () => {
    const error = failure('auth/internal-error');
    signInWithPopup.mockRejectedValue(error);
    expect(await store.dispatch('login')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(error);
  });
});

describe('Login screen', () => {
  const mountLogin = () => mount(Login, { global: { plugins: [store], mocks: { $router: { replace: vi.fn() } } } });

  it('turns the button off while Google is open, so a second tap does nothing', async () => {
    let finish;
    signInWithPopup.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const wrapper = mountLogin();
    const button = wrapper.get('button');
    await button.trigger('click');
    expect(button.attributes('disabled')).toBeDefined();
    await button.trigger('click');
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    finish({ user: { email: 'a@example.com' } });
    await flushPromises();
    expect(button.attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('shows the blocked-window sentence', async () => {
    signInWithPopup.mockRejectedValue(failure('auth/popup-blocked'));
    const wrapper = mountLogin();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toMatch(/blocked the Google sign-in window/);
    wrapper.unmount();
  });
});
