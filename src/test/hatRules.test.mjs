import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';
import { rulesFileText } from '../../scripts/generate-hat-rules.mjs';

// database.rules.json is generated, never hand-edited (the member-key
// transform has to match emailToMemberKey character for character). This
// catches a hand edit, or a generator change nobody re-ran, before `yarn
// deploy` ships a build that disagrees with the rules.
describe('database.rules.json', () => {
  it('is exactly what scripts/generate-hat-rules.mjs produces', () => {
    const committed = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8');
    expect(committed, 'Run `yarn generate-hat-rules` and commit the result').toBe(rulesFileText);
  });
});
