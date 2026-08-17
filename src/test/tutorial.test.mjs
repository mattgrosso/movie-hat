// When the app volunteers the tutorial. Getting this wrong either nags
// existing users on every visit or never explains itself to the newcomers
// whose confusion filled the database with empty hats.
import { describe, it, expect } from 'vitest';
import { shouldOfferTutorial, hasSeenTutorial, markTutorialSeen } from '../assets/javascript/tutorial.js';

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); }
  };
};

describe('shouldOfferTutorial', () => {
  it('offers it to somebody with no hats who has never seen it', () => {
    expect(shouldOfferTutorial({ hatCount: 0, seen: false })).toBe(true);
  });

  it('never offers it twice', () => {
    expect(shouldOfferTutorial({ hatCount: 0, seen: true })).toBe(false);
  });

  it('leaves people with hats alone — they already know', () => {
    expect(shouldOfferTutorial({ hatCount: 3, seen: false })).toBe(false);
  });
});

describe('hasSeenTutorial / markTutorialSeen', () => {
  it('remembers once marked', () => {
    const storage = fakeStorage();
    expect(hasSeenTutorial(storage)).toBe(false);
    markTutorialSeen(storage);
    expect(hasSeenTutorial(storage)).toBe(true);
  });

  it('treats unusable storage as not-yet-seen rather than throwing', () => {
    const broken = {
      getItem: () => { throw new Error('nope'); },
      setItem: () => { throw new Error('nope'); }
    };
    expect(hasSeenTutorial(broken)).toBe(false);
    expect(() => markTutorialSeen(broken)).not.toThrow();
  });
});
