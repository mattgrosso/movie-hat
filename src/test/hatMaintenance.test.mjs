// The two maintenance rules that touch real hats: what the membership
// backfill writes, and what the prune is allowed to delete.
import { describe, it, expect } from 'vitest';
import { buildIndexes } from '../../scripts/build-membership-index.mjs';
import { partitionHats } from '../../scripts/prune-empty-hats.mjs';

describe('buildIndexes', () => {
  it('writes both halves of the index for every member', () => {
    const hats = {
      'Family Hat': {
        abc123: { members: { k1: 'a.b@x.com', k2: 'c@y.org' } }
      }
    };

    const { updates, summary } = buildIndexes(hats);

    expect(updates['hats/Family Hat/abc123/memberEmails']).toEqual({
      'a-b@x-com': true,
      'c@y-org': true
    });
    expect(updates['userHats/a-b@x-com/family hat']).toEqual({ title: 'Family Hat', hatKey: 'abc123' });
    expect(updates['userHats/c@y-org/family hat']).toEqual({ title: 'Family Hat', hatKey: 'abc123' });
    expect(summary).toMatchObject({ hats: 1, members: 2 });
  });

  it('skips memberless hats but reports the ones with content', () => {
    const hats = {
      Orphaned: { k: { movies: { m: {} } } },
      Empty: { k: {} }
    };

    const { updates, summary } = buildIndexes(hats);

    expect(Object.keys(updates)).toEqual([]);
    expect(summary.skipped).toEqual([{ title: 'Orphaned', content: 1 }]);
  });
});

describe('partitionHats', () => {
  it('marks only hats with zero movies AND zero history as empty', () => {
    const hats = {
      Junk: { k1: { members: { m: 'a@x.com' } } },
      'One Movie': { k2: { movies: { m: {} } } },
      'All Drawn': { k3: { history: { h: {} } } }
    };

    const { empty, kept } = partitionHats(hats);

    expect(empty.map((hat) => hat.title)).toEqual(['Junk']);
    expect(kept.map((hat) => hat.title).sort()).toEqual(['All Drawn', 'One Movie']);
  });

  it('spares a freshly made empty hat, so someone filling one is safe', () => {
    const now = Date.parse('2026-08-17T12:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    const hats = {
      'Made Today': { k1: { createdAt: now - (2 * day) } },
      Abandoned: { k2: { createdAt: now - (30 * day) } }
    };

    const { empty, tooNew } = partitionHats(hats, { graceDays: 7, now });

    expect(tooNew.map((hat) => hat.title)).toEqual(['Made Today']);
    expect(empty.map((hat) => hat.title)).toEqual(['Abandoned']);
  });

  it('still prunes hats too old to know their own age', () => {
    // Everything without createdAt predates the field by years.
    const { empty } = partitionHats({ Legacy: { k: {} } }, { graceDays: 7 });
    expect(empty.map((hat) => hat.title)).toEqual(['Legacy']);
  });

  it('judges each record under a title separately', () => {
    const hats = {
      Doubled: {
        used: { movies: { m: {} } },
        stray: {}
      }
    };

    const { empty, kept } = partitionHats(hats);

    expect(empty).toHaveLength(1);
    expect(empty[0].dbKey).toBe('stray');
    expect(kept).toHaveLength(1);
  });
});
