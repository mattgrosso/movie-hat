import { describe, it, expect } from 'vitest';
import { IGNORE_ERRORS, DENY_URLS } from '@/utils/sentryNoise.js';

const matches = (list, text) => list.some((re) => re.test(text));

describe('sentry noise filters', () => {
  it('drops the extension API error Safari reported on the home page', () => {
    expect(matches(IGNORE_ERRORS, 'Invalid call to runtime.sendMessage(). Tab not found.')).toBe(true);
  });

  it('keeps Movie Hat\'s own errors', () => {
    expect(matches(IGNORE_ERRORS, 'lookup failed for Tom Hanks')).toBe(false);
    expect(matches(IGNORE_ERRORS, 'PERMISSION_DENIED: write refused')).toBe(false);
  });

  it('drops errors thrown from extension scripts in Safari, Chrome and Firefox', () => {
    expect(matches(DENY_URLS, 'safari-web-extension://ABC/content.js')).toBe(true);
    expect(matches(DENY_URLS, 'safari-extension://com.example/script.js')).toBe(true);
    expect(matches(DENY_URLS, 'chrome-extension://abcdef/inject.js')).toBe(true);
    expect(matches(DENY_URLS, 'moz-extension://1234/content.js')).toBe(true);
  });

  it('keeps errors from the live site', () => {
    expect(matches(DENY_URLS, 'https://movie-hat.com/assets/index.js')).toBe(false);
  });
});
