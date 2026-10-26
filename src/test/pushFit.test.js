// Every push has to fit Matt's Apple Watch (2026-10-26): title <= 24, body <= 60.
// aws-lambda/pushFit.js is the backstop push-notify.js's buildPayload runs through.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const require = createRequire(import.meta.url);
const { clip, fitNotification, TITLE_MAX, BODY_MAX } = require('../../aws-lambda/pushFit.js');

describe('clip', () => {
  it('leaves short text alone, apart from whitespace', () => {
    expect(clip('  Ready:   Heat ', 24)).toBe('Ready: Heat');
    expect(clip('x'.repeat(24), 24)).toBe('x'.repeat(24));
  });

  it('cuts at a word, drops trailing punctuation and adds an ellipsis', () => {
    expect(clip('Ready: Once Upon a Time in Hollywood', 24)).toBe('Ready: Once Upon a…');
    expect(clip('Jaws, Heat, Alien, Tenet', 12)).toBe('Jaws, Heat…');
  });

  it('cuts mid-word when the only space is too early', () => {
    expect(clip('A Supercalifragilisticexpialidocious night', 24)).toBe('A Supercalifragilistice…');
  });

  it('copes with nothing', () => {
    expect(clip(undefined, 24)).toBe('');
  });
});

describe('fitNotification', () => {
  it('holds every title and body to the watch', () => {
    const fit = fitNotification({ title: 'Drawn: a very long film title indeed', body: 'y '.repeat(80) });
    expect(fit.title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(fit.body.length).toBeLessThanOrEqual(BODY_MAX);
  });

  it('is applied in buildPayload, which every push goes through', () => {
    const src = readFileSync(resolve(__dirname, '../../aws-lambda/push-notify.js'), 'utf8');
    const build = src.slice(src.indexOf('const buildPayload'), src.indexOf('const buildPayload') + 300);
    expect(build).toContain('fitNotification({ title, body })');
  });
});
