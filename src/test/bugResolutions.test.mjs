import { describe, it, expect } from 'vitest';
import { unseenResolutions } from '../utils/bugResolutions.js';

// The reply half of the bug button (2026-09-21): the node is shared with
// Movie Requests, so this shows only Movie Hat's, only the unseen ones,
// oldest first.
describe('unseenResolutions', () => {
  const entries = {
    a: { app: 'movie-hat', understood: 'x', fixed: 'y', resolvedAt: 300, seen: false },
    b: { app: 'movie-hat', understood: 'x', fixed: 'y', resolvedAt: 100, seen: true },
    c: { app: 'movie-requests', understood: 'x', fixed: 'y', resolvedAt: 200, seen: false },
    d: { understood: 'legacy', fixed: 'no app named', resolvedAt: 50, seen: false },
    e: null
  };

  it("keeps this app's unseen notices, oldest first, and carries the id", () => {
    expect(unseenResolutions(entries).map((n) => n.id)).toEqual(['d', 'a']);
  });

  it("never shows Movie Requests' notice here", () => {
    expect(unseenResolutions(entries, 'movie-requests').map((n) => n.id)).toEqual(['d', 'c']);
  });

  it('is empty for nothing', () => {
    expect(unseenResolutions(null)).toEqual([]);
  });
});
