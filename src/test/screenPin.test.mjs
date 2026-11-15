// The house bug-button pinner (utils/screenPin.js). Mostly the report of
// 2026-11-15: on the request screen, iOS said the visible view was
// -33554432 tall, and the pinner took that for a phantom keyboard 33 million
// pixels deep and ran its cures every second.
import { describe, it, expect } from 'vitest';
import { phantomBand, realView, slideFor } from '../utils/screenPin.js';

describe('screenPin', () => {
  it('a real phantom keyboard is still caught', () => {
    // Matt's phone, 2026-10-31: the page 812, the view 511, pushed 70 down.
    expect(phantomBand({ innerHeight: 812, vvHeight: 511, vvTop: 70 })).toBe(231);
    expect(phantomBand({ innerHeight: 812, vvHeight: 511, vvTop: 0 })).toBe(301);
  });

  it('a junk view height is no phantom (the 2026-11-15 report, its own numbers)', () => {
    // What it used to say: a band of 33555244.
    expect(phantomBand({ innerHeight: 812, vvHeight: -33554432, vvTop: 0 })).toBe(0);
    expect(phantomBand({ innerHeight: 812, vvHeight: -33554432, vvTop: 301 })).toBe(0);
    expect(phantomBand({ innerHeight: 812, vvHeight: 0 })).toBe(0);
    expect(phantomBand({ innerHeight: 812, vvHeight: NaN })).toBe(0);
    expect(phantomBand({ innerHeight: 812, vvHeight: null })).toBe(0);
  });

  it('knows a real height from junk', () => {
    expect(realView(511)).toBe(true);
    expect(realView(812)).toBe(true);
    for (const junk of [-33554432, 0, NaN, Infinity, null, undefined, 33554432]) {
      expect(realView(junk)).toBe(false);
    }
  });

  it('leaves the bug button where it is when the view is junk', () => {
    // The button's scene from the report: 417 to 461, nothing slid.
    expect(slideFor({ bottom: 461, band: 0, vvTop: 301, vvHeight: -33554432 })).toBe(0);
  });
});
