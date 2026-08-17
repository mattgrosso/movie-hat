// The two pure decisions in the update machinery: is now a safe moment to
// reload out from under the user, and have we already auto-tried this
// version. Wrong answers mean either a July-style yanked page or an
// infinite reload loop.
import { describe, it, expect } from 'vitest';
import { isSafeMomentForReload, shouldAutoAttempt } from '../utils/appUpdate.js';

const classList = (...names) => ({ contains: (name) => names.includes(name) });

describe('isSafeMomentForReload', () => {
  it('is safe on an idle page', () => {
    expect(isSafeMomentForReload({
      activeElement: { tagName: 'BODY' },
      bodyClassList: classList(),
      revealing: false
    })).toBe(true);
  });

  it('is unsafe while typing in an input, textarea, or select', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(isSafeMomentForReload({
        activeElement: { tagName },
        bodyClassList: classList(),
        revealing: false
      })).toBe(false);
    }
  });

  it('is unsafe while a Bootstrap modal is open', () => {
    expect(isSafeMomentForReload({
      activeElement: { tagName: 'BODY' },
      bodyClassList: classList('modal-open'),
      revealing: false
    })).toBe(false);
  });

  it('is unsafe during the draw reveal', () => {
    expect(isSafeMomentForReload({
      activeElement: { tagName: 'BODY' },
      bodyClassList: classList(),
      revealing: true
    })).toBe(false);
  });

  it('tolerates a missing activeElement', () => {
    expect(isSafeMomentForReload({
      activeElement: null,
      bodyClassList: classList(),
      revealing: false
    })).toBe(true);
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
