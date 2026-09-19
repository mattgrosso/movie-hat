import { describe, it, expect } from 'vitest';
import { languageName, subtitleNote } from '../utils/movieLanguage.js';

// Report -P1rN7K8Ot7V4yqgW17O (2026-09-18): "It would be nice if the
// information could tell me if the movie is subtitled."
describe('languageName', () => {
  it('names the codes a movie club actually meets', () => {
    expect(languageName('ja')).toBe('Japanese');
    expect(languageName('ko')).toBe('Korean');
    expect(languageName('fr')).toBe('French');
  });

  it('is not fussy about case or whitespace', () => {
    expect(languageName(' JA ')).toBe('Japanese');
  });

  it('has nothing to say about a silent film or a nonsense code', () => {
    expect(languageName('xx')).toBe(null);
    expect(languageName('')).toBe(null);
    expect(languageName(null)).toBe(null);
    expect(languageName('zzz')).toBe(null);
  });
});

describe('subtitleNote', () => {
  it('flags a film made in another language', () => {
    expect(subtitleNote({ original_language: 'ko' })).toEqual({
      code: 'ko',
      language: 'Korean',
      text: 'In Korean — subtitled'
    });
  });

  it('says nothing about an English-language film', () => {
    expect(subtitleNote({ original_language: 'en' })).toBe(null);
  });

  it('says nothing when the field is missing, rather than guessing', () => {
    // A caption that is wrong is worse than no caption. Old hat entries
    // predate the field entirely.
    expect(subtitleNote({})).toBe(null);
    expect(subtitleNote(null)).toBe(null);
    expect(subtitleNote({ original_language: '' })).toBe(null);
  });

  it('stays quiet on a code it cannot name', () => {
    expect(subtitleNote({ original_language: 'q7' })).toBe(null);
  });
});
