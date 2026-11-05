// The order of the request lists (report of 2026-11-04: Resident Evil was
// requested in October, landed weeks later, and sat seventy rows down
// because the list sorted by when it was asked for).
import { describe, it, expect } from 'vitest';
import { compareRequests, requestActivityAt } from '../utils/requestMovie.js';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 4);

describe('request list order', () => {
  it('puts a film that landed today above ones asked for since', () => {
    const residentEvil = { title: 'Resident Evil', status: 'added', createdAt: now - 17 * DAY, processedAt: now - 17 * DAY, importedAt: now };
    const coco = { title: 'Coco', status: 'added', createdAt: now - 4 * DAY, processedAt: now - 4 * DAY, importedAt: now - 4 * DAY };
    const mary = { title: 'Mary', status: 'exists', createdAt: now - 7 * DAY, processedAt: now - 7 * DAY };
    expect([coco, mary, residentEvil].sort(compareRequests).map((r) => r.title))
      .toEqual(['Resident Evil', 'Coco', 'Mary']);
  });

  it('still puts anything unfinished first', () => {
    const waiting = { title: 'Waiting', status: 'added', createdAt: now - 30 * DAY };
    const landed = { title: 'Landed', status: 'added', createdAt: now - DAY, importedAt: now };
    expect([landed, waiting].sort(compareRequests).map((r) => r.title)).toEqual(['Waiting', 'Landed']);
  });

  it('copes with rows missing their times', () => {
    expect(requestActivityAt(null)).toBe(0);
    expect(requestActivityAt({ status: 'pending' })).toBe(0);
    expect(requestActivityAt({ createdAt: 5, importedAt: 'soon' })).toBe(5);
  });
});
