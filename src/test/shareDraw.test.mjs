import { describe, it, expect } from 'vitest';
import { drawShareText } from '../utils/shareDraw.js';

// Report -P1pIl_Lbjv_7lesfEs2 (2026-09-18): sharing a draw to Slack posted an
// image URL and "Added by: Matt", with the film's title nowhere in it.
describe('drawShareText', () => {
  const movie = { title: 'The Thing', release_date: '1982-06-25', addedBy: 'Seth', note: 'Practical effects!' };

  it('leads with the film, which is the whole point of the message', () => {
    const text = drawShareText(movie, { hatName: 'Framebridge Movie Club' });
    expect(text.split('\n')[0]).toBe('🎩 Framebridge Movie Club drew: The Thing (1982)');
  });

  it('always names the film, whatever else is missing', () => {
    expect(drawShareText({ title: 'Heat' })).toContain('Heat');
    expect(drawShareText({ title: 'Heat' })).not.toContain('(');
  });

  it('carries who added it and their note, each on its own line', () => {
    const lines = drawShareText(movie).split('\n');
    expect(lines).toEqual([
      '🎩 Drawn from the hat: The Thing (1982)',
      'Added by Seth',
      'Note: Practical effects!'
    ]);
  });

  it('drops the lines it has nothing for rather than printing empties', () => {
    // The old payload was `${addedBy}\n${note}`, which sent a bare newline
    // when a film had neither.
    expect(drawShareText({ title: 'Heat', release_date: '1995-12-15' }))
      .toBe('🎩 Drawn from the hat: Heat (1995)');
  });

  it('survives having no movie at all', () => {
    expect(drawShareText(null)).toBe('🎩 Drawn from the hat: a movie');
  });
});
