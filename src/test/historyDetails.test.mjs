import { describe, it, expect } from 'vitest';
import { historyDetailLines, formatWhen } from '../assets/javascript/historyDetails.js';

const ADDED = Date.UTC(2026, 7, 1, 18, 30);   // Aug 1
const DRAWN = Date.UTC(2026, 7, 15, 20, 0);   // Aug 15

describe('historyDetailLines (report -P1St_2nnAa1mVCCx1lE: details behind each poster)', () => {
  it('says who added it and when, when it was drawn, and how long it waited', () => {
    const lines = historyDetailLines(
      { title: 'Heat', addedBy: 'Matt', timeStamp: ADDED, dateDrawn: DRAWN, release_date: '1995-12-15', vote_average: 8.3, note: 'a classic' },
      { rank: '3rd' }
    );
    expect(lines[0]).toBe(`Added by Matt on ${formatWhen(ADDED)}`);
    expect(lines[1]).toBe(`Drawn ${formatWhen(DRAWN)} · 3rd draw`);
    expect(lines[2]).toBe('Waited in the hat 14 days');
    expect(lines).toContain('Note: a classic');
    expect(lines).toContain('Released Dec 15, 1995');
    expect(lines).toContain('TMDB rating 8.3');
  });

  it('copes with the older records that never stored a timestamp or an adder', () => {
    expect(historyDetailLines({ title: 'Old', dateDrawn: DRAWN }, { rank: '1st' }))
      .toEqual([`Drawn ${formatWhen(DRAWN)} · 1st draw`]);
    expect(historyDetailLines({ title: 'Older', addedBy: 'Seth' })).toEqual(['Added by Seth']);
    expect(historyDetailLines({ title: 'Bare' })).toEqual([]);
  });

  it('reads a timestamp stored as a numeric string', () => {
    const lines = historyDetailLines({ timeStamp: String(ADDED), dateDrawn: DRAWN });
    expect(lines[0]).toBe(`Added ${formatWhen(ADDED)}`);
  });

  it('counts a same-day draw as 0 days and a single day without an s', () => {
    expect(historyDetailLines({ timeStamp: ADDED, dateDrawn: ADDED + 1000 })).toContain('Waited in the hat 0 days');
    expect(historyDetailLines({ timeStamp: ADDED, dateDrawn: ADDED + 24 * 3600 * 1000 })).toContain('Waited in the hat 1 day');
  });

  it('leaves out a zero or missing TMDB rating', () => {
    expect(historyDetailLines({ vote_average: 0 })).toEqual([]);
    expect(historyDetailLines({ vote_average: 'nope' })).toEqual([]);
  });
});
