import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { checkDist, versionFromEnv } from '../../scripts/distCheck.mjs';

let dir;

function build (overrides = {}) {
  const files = {
    'index.html': '<script type="module" src="/js/app.3502e705.js"></script>',
    'js/app.3502e705.js': 'const v="1.12.58";',
    'service-worker.js': 'importScripts("push-sw.js");define(["./workbox-1"],function(e){e.precacheAndRoute([{url:"/js/app.3502e705.js",revision:null},{url:"/index.html",revision:"abc"}])});',
    'push-sw.js': 'self.addEventListener("push",()=>{});',
    ...overrides
  };
  for (const [rel, text] of Object.entries(files)) {
    if (text === null) continue;
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
}

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'dist-check-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('checkDist', () => {
  it('passes a good build', () => {
    build();
    expect(checkDist(dir, '1.12.58')).toEqual({ bundle: 'js/app.3502e705.js', problems: [] });
  });

  it('fails when index.html is missing', () => {
    build({ 'index.html': null });
    expect(checkDist(dir, '1.12.58').problems.join()).toMatch(/index\.html is missing/);
  });

  it('fails when the bundle is renamed so auto-update would not see it', () => {
    build({ 'index.html': '<script src="/assets/index-AbC_12.js"></script>' });
    expect(checkDist(dir, '1.12.58').problems.join()).toMatch(/exactly one js\/app/);
  });

  it('fails when index.html names a bundle that is not there', () => {
    build({ 'index.html': '<script src="/js/app.deadbeef.js"></script>' });
    expect(checkDist(dir, '1.12.58').problems.join()).toMatch(/not in the build/);
  });

  it('fails without the worker or the push handler', () => {
    build({ 'service-worker.js': null, 'push-sw.js': null });
    const problems = checkDist(dir, '1.12.58').problems.join();
    expect(problems).toMatch(/service-worker\.js is missing/);
    expect(problems).toMatch(/push-sw\.js is missing/);
  });

  it('fails when the worker does not precache the new bundle', () => {
    build({ 'service-worker.js': 'importScripts("push-sw.js");[{url:"/js/app.11111111.js"}]' });
    expect(checkDist(dir, '1.12.58').problems.join()).toMatch(/does not precache js\/app\.3502e705\.js/);
  });

  it('fails when the worker precaches source maps', () => {
    build({ 'service-worker.js': 'importScripts("push-sw.js");[{url:"/js/app.3502e705.js"},{url:"/js/app.3502e705.js.map"}]' });
    expect(checkDist(dir, '1.12.58').problems.join()).toMatch(/precaches source maps/);
  });

  it('fails when the version is not baked in', () => {
    build();
    expect(checkDist(dir, '1.12.59').problems.join()).toMatch(/1\.12\.59 is not baked/);
  });

  it('does not take 1.12.5 for 1.12.58', () => {
    build();
    expect(checkDist(dir, '1.12.5').problems.join()).toMatch(/not baked/);
  });
});

describe('versionFromEnv', () => {
  it('reads VUE_APP_VERSION', () => {
    expect(versionFromEnv('A=1\nVUE_APP_VERSION=1.12.58\nB=2\n')).toBe('1.12.58');
    expect(versionFromEnv('A=1\n')).toBe(null);
  });
});
