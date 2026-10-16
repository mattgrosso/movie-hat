import { describe, it, expect } from 'vitest';
import { isTestBrowser } from '@/utils/testBrowser.js';

describe('isTestBrowser', () => {
  const page = (hostname, webdriver) => ({ location: { hostname }, navigator: { webdriver } });

  it('is a test when the browser is automated, even on the live site', () => {
    expect(isTestBrowser(page('movie-hat.com', true))).toBe(true);
  });

  it('is a test when the build is served from this machine', () => {
    expect(isTestBrowser(page('localhost', false))).toBe(true);
    expect(isTestBrowser(page('127.0.0.1', undefined))).toBe(true);
  });

  it('is a user on the live site in an ordinary browser', () => {
    expect(isTestBrowser(page('movie-hat.com', false))).toBe(false);
    expect(isTestBrowser(page('movie-hat.com', undefined))).toBe(false);
  });
});
