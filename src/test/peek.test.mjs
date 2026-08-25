import { describe, it, expect } from 'vitest';
import {
  OWNER_EMAIL,
  isOwner,
  movieYear,
  titleSortKey,
  filterMovies,
  sortMovies,
  visibleMovies
} from '../assets/javascript/peek.js';

const movie = (title, extra = {}) => ({ title, release_date: '2016-11-11', timeStamp: 1000, ...extra });

describe('isOwner', () => {
  it('recognises the owner regardless of case or stray spaces', () => {
    expect(isOwner(OWNER_EMAIL)).toBe(true);
    expect(isOwner('MattGrosso@Gmail.com')).toBe(true);
    expect(isOwner('  mattgrosso@gmail.com  ')).toBe(true);
  });

  it('recognises nobody else', () => {
    expect(isOwner('someone@example.com')).toBe(false);
    expect(isOwner('mattgrosso@gmail.com.evil.com')).toBe(false);
    expect(isOwner('')).toBe(false);
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
  });
});

describe('movieYear', () => {
  it('takes the year off a release date', () => {
    expect(movieYear({ release_date: '2016-11-11' })).toBe('2016');
  });

  it('gives an empty string rather than junk when there is no usable date', () => {
    expect(movieYear({ release_date: '' })).toBe('');
    expect(movieYear({ release_date: 'unknown' })).toBe('');
    expect(movieYear({})).toBe('');
    expect(movieYear(null)).toBe('');
  });
});

describe('titleSortKey', () => {
  it('ignores a leading article, so The Conversation files under C', () => {
    expect(titleSortKey({ title: 'The Conversation' })).toBe('conversation');
    expect(titleSortKey({ title: 'A Serious Man' })).toBe('serious man');
    expect(titleSortKey({ title: 'An Education' })).toBe('education');
  });

  it('leaves a title that merely starts with those letters alone', () => {
    expect(titleSortKey({ title: 'Theodora Goes Wild' })).toBe('theodora goes wild');
    expect(titleSortKey({ title: 'Anatomy of a Fall' })).toBe('anatomy of a fall');
  });

  it('survives a missing title', () => {
    expect(titleSortKey({})).toBe('');
    expect(titleSortKey(null)).toBe('');
  });
});

describe('filterMovies', () => {
  const hat = [
    movie('Arrival', { addedBy: 'matt' }),
    movie('Burning', { addedBy: 'carrie', note: 'Lee Chang-dong' }),
    movie('The Conversation', { addedBy: 'matt' })
  ];

  it('matches on title, case-insensitively', () => {
    expect(filterMovies(hat, 'arrival').map((m) => m.title)).toEqual(['Arrival']);
    expect(filterMovies(hat, 'ARRIVAL').map((m) => m.title)).toEqual(['Arrival']);
  });

  // Searching the adder and the note as well as the title is deliberate, and
  // it does mean a short query can match more than it looks like it should:
  // "arr" finds Burning, because Burning was added by cARRie.
  it('can match through a field other than the title', () => {
    expect(filterMovies(hat, 'arr').map((m) => m.title)).toEqual(['Arrival', 'Burning']);
  });

  it('matches on the note and on who added it', () => {
    expect(filterMovies(hat, 'chang-dong').map((m) => m.title)).toEqual(['Burning']);
    expect(filterMovies(hat, 'carrie').map((m) => m.title)).toEqual(['Burning']);
  });

  // The list runs to hundreds of movies; the search box is the way in, not an
  // opt-in filter, so an empty box has to mean "everything".
  it('returns everything for a blank query', () => {
    expect(filterMovies(hat, '')).toHaveLength(3);
    expect(filterMovies(hat, '   ')).toHaveLength(3);
    expect(filterMovies(hat, null)).toHaveLength(3);
  });

  it('does not mutate the list it was given', () => {
    const original = [...hat];
    filterMovies(hat, 'arr');
    expect(hat).toEqual(original);
  });

  it('survives a missing list and entries missing fields', () => {
    expect(filterMovies(null, 'x')).toEqual([]);
    expect(filterMovies([{}, { title: 'Real' }], 'real').map((m) => m.title)).toEqual(['Real']);
  });
});

describe('sortMovies', () => {
  it('sorts by title, articles ignored', () => {
    const sorted = sortMovies([movie('The Conversation'), movie('Arrival'), movie('Burning')]);
    expect(sorted.map((m) => m.title)).toEqual(['Arrival', 'Burning', 'The Conversation']);
  });

  it('sorts most-recently-added first', () => {
    const sorted = sortMovies(
      [movie('Old', { timeStamp: 1 }), movie('New', { timeStamp: 3 }), movie('Middle', { timeStamp: 2 })],
      'added'
    );
    expect(sorted.map((m) => m.title)).toEqual(['New', 'Middle', 'Old']);
  });

  it('sorts undated entries last rather than first', () => {
    const sorted = sortMovies(
      [movie('Undated', { timeStamp: undefined }), movie('Dated', { timeStamp: 5 })],
      'added'
    );
    expect(sorted.map((m) => m.title)).toEqual(['Dated', 'Undated']);
  });

  it('does not mutate the list it was given', () => {
    const hat = [movie('The Conversation'), movie('Arrival')];
    const original = [...hat];
    sortMovies(hat);
    expect(hat).toEqual(original);
  });
});

describe('visibleMovies', () => {
  const hat = [movie('The Conversation'), movie('Arrival'), movie('Burning', { note: 'Lee Chang-dong' })];

  it('searches and sorts together', () => {
    expect(visibleMovies(hat, { query: 'n', sort: 'title' }).map((m) => m.title))
      .toEqual(['Burning', 'The Conversation']);
  });

  it('defaults to everything, by title', () => {
    expect(visibleMovies(hat).map((m) => m.title)).toEqual(['Arrival', 'Burning', 'The Conversation']);
  });

  it('survives an empty hat', () => {
    expect(visibleMovies([])).toEqual([]);
    expect(visibleMovies(null)).toEqual([]);
  });
});
