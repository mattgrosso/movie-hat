// The two pure decisions in the update machinery: is now a safe moment to
// reload out from under the user, and have we already auto-tried this
// version. Wrong answers mean either a July-style yanked page or an
// infinite reload loop.
import { describe, it, expect } from 'vitest';
import { isSafeMomentForReload, shouldAutoAttempt } from '../utils/appUpdate.js';

const classList = (...names) => ({ contains: (name) => names.includes(name) });

// An idle page, spelled out: every guard explicitly off, so each test below
// switches on exactly the one thing it is about.
const idle = (overrides = {}) => ({
  activeElement: { tagName: 'BODY' },
  bodyClassList: classList(),
  revealing: false,
  reporting: false,
  routePath: '/',
  ...overrides
});

describe('isSafeMomentForReload', () => {
  it('is safe on an idle page', () => {
    expect(isSafeMomentForReload(idle())).toBe(true);
  });

  it('is unsafe while typing in an input, textarea, or select', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(isSafeMomentForReload(idle({ activeElement: { tagName } }))).toBe(false);
    }
  });

  it('is unsafe while a Bootstrap modal is open', () => {
    expect(isSafeMomentForReload(idle({ bodyClassList: classList('modal-open') }))).toBe(false);
  });

  it('is unsafe during the draw reveal', () => {
    expect(isSafeMomentForReload(idle({ revealing: true }))).toBe(false);
  });

  // The bug-report panel is hand-rolled, so `modal-open` is never set, and a
  // phone user who dismisses the keyboard to re-read their report blurs the
  // textarea. Neither of the checks above can see an unsent report; this one
  // has to.
  it('is unsafe while the bug-report panel is open, even with nothing focused', () => {
    expect(isSafeMomentForReload(idle({ reporting: true }))).toBe(false);
  });

  // /pick-a-movie's search results and /tutorial's step live only in the
  // store, so a reload there loses work rather than re-rendering it.
  it('is unsafe on a screen whose whole state is in memory', () => {
    for (const routePath of ['/pick-a-movie', '/tutorial']) {
      expect(isSafeMomentForReload(idle({ routePath }))).toBe(false);
    }
  });

  it('is safe on screens that rebuild themselves after a reload', () => {
    for (const routePath of ['/', '/drawn-movie', '/hat-list', '/wrapped']) {
      expect(isSafeMomentForReload(idle({ routePath }))).toBe(true);
    }
  });

  it('tolerates a missing activeElement', () => {
    expect(isSafeMomentForReload(idle({ activeElement: null }))).toBe(true);
  });
});

describe('shouldAutoAttempt', () => {
  const fakeStorage = () => {
    const data = {};
    return {
      getItem: (key) => (key in data ? data[key] : null),
      setItem: (key, value) => { data[key] = value; }
    };
  };

  it('allows exactly one attempt per target bundle', () => {
    const storage = fakeStorage();
    expect(shouldAutoAttempt('js/app.abc.js', storage)).toBe(true);
    expect(shouldAutoAttempt('js/app.abc.js', storage)).toBe(false);
  });

  it('allows a fresh attempt when a NEW version appears', () => {
    const storage = fakeStorage();
    expect(shouldAutoAttempt('js/app.abc.js', storage)).toBe(true);
    expect(shouldAutoAttempt('js/app.def.js', storage)).toBe(true);
  });

  it('still tries once when storage is unavailable', () => {
    const broken = {
      getItem: () => { throw new Error('nope'); },
      setItem: () => { throw new Error('nope'); }
    };
    expect(shouldAutoAttempt('js/app.abc.js', broken)).toBe(true);
  });
});
