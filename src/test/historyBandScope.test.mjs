import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../components/History.vue'), 'utf8');

// Report -P1gchJKgU6aoUrymFOb: "The new streaming providers and the
// information panel are all at an angle. It's like there's some overlap in
// their class with the count, like the band on the top left corner of the
// posters." He had it exactly right.
//
// The corner band ("(599th drawn)") was styled as a bare `span` inside the
// poster `a`. Descendant combinators do not care WHICH anchor, so when
// WhereToWatch — which renders its own <a> wrapping <span class="service"> —
// was added to the details panel inside the same <li>, every provider logo
// was absolutely positioned and rotated -45deg into a black diagonal sliver.
//
// A source-level guard because the bug is in the SELECTOR's reach, which is
// exactly what a mounted-component test of either component would miss.
describe('the draw-count band stays keyed to itself', () => {
  const styleBlock = source.slice(source.indexOf('<style'));

  it('styles the band by class, never as a bare span', () => {
    expect(styleBlock).toContain('.draw-band {');
    // A bare `span {` rule anywhere in this file would catch WhereToWatch's
    // spans again the moment anything else in a card links out.
    expect(styleBlock).not.toMatch(/^\s*span\s*\{/m);
  });

  it('puts that class on the band in the template, with the rotation', () => {
    const template = source.slice(0, source.indexOf('<script'));
    expect(template).toMatch(/<span class="draw-band[^"]*">\(\{\{drawRank\(movie\)\}\} drawn\)<\/span>/);

    const band = styleBlock.slice(styleBlock.indexOf('.draw-band {'));
    expect(band.slice(0, band.indexOf('}'))).toContain('rotate(-45deg)');
  });
});
