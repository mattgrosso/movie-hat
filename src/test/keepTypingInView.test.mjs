// @vitest-environment jsdom
// The request screen's search box (report of 2026-11-15: "When I start to
// type ... I get pushed all the way to the very bottom of the page. I can't
// see what I'm typing.").
import { describe, it, expect, vi, afterEach } from 'vitest';
import { rescueScroll, keepTypingInView, visibleView } from '../utils/keepTypingInView.js';

describe('rescueScroll', () => {
  // A 402-wide phone, keyboard up: 409 of the page visible from the top.
  const view = { viewTop: 0, viewHeight: 409 };

  it('leaves a box that is on screen alone', () => {
    expect(rescueScroll({ ...view, top: 180, bottom: 218, scrollY: 0, startY: 0 })).toBe(null);
  });

  it('goes back to where the page was when the jump hid the box', () => {
    // Thrown 2600 down: the box is far above the top of the screen.
    expect(rescueScroll({ ...view, top: -2420, bottom: -2382, scrollY: 2600, startY: 0 })).toBe(0);
  });

  it('puts the box near the top when where it started would not show it either', () => {
    // Focused with the box half under the keyboard, then thrown to the bottom.
    expect(rescueScroll({ ...view, top: -2000, bottom: -1962, scrollY: 2600, startY: 2400 })).toBe(588);
  });

  it('measures against the visible view, not the page, when iOS has moved it', () => {
    expect(rescueScroll({ viewTop: 100, viewHeight: 400, top: 40, bottom: 78, scrollY: 300, startY: 300 })).toBe(228);
    expect(rescueScroll({ viewTop: 100, viewHeight: 400, top: 140, bottom: 178, scrollY: 300, startY: 300 })).toBe(null);
  });

  it('does nothing when the scroll it would ask for is where the page already is', () => {
    expect(rescueScroll({ ...view, top: 12, bottom: 900, scrollY: 0, startY: 0 })).toBe(null);
  });
});

// 2026-11-15, second report: "when I tap into the search button, the screen
// just like moves up and down every second by about 250 pixels." iOS said
// the visible view was -33554432 tall; the box was never "on screen".
describe('a junk visible view (the bouncing report, its own numbers)', () => {
  it('falls back to the page itself', () => {
    expect(visibleView({ vvHeight: -33554432, vvTop: 0, innerHeight: 812 })).toEqual({ viewTop: 0, viewHeight: 812 });
    expect(visibleView({ vvHeight: -33554432, vvTop: 301, innerHeight: 812 })).toEqual({ viewTop: 0, viewHeight: 812 });
    expect(visibleView({ vvHeight: undefined, vvTop: undefined, innerHeight: 812 })).toEqual({ viewTop: 0, viewHeight: 812 });
    expect(visibleView({ vvHeight: 0, vvTop: 0, innerHeight: 812 })).toEqual({ viewTop: 0, viewHeight: 812 });
  });

  it('keeps iOS\'s figures when they are real', () => {
    expect(visibleView({ vvHeight: 409, vvTop: 100, innerHeight: 812 })).toEqual({ viewTop: 100, viewHeight: 409 });
  });

  it('the box at 313 on an 812 page is on screen: no scroll', () => {
    // What it did: scrolled 0 -> 301, then kept at it.
    const view = visibleView({ vvHeight: -33554432, vvTop: 0, innerHeight: 812 });
    expect(rescueScroll({ ...view, top: 313, bottom: 351, scrollY: 0, startY: 0 })).toBe(null);
    expect(rescueScroll({ viewTop: 0, viewHeight: -33554432, top: 313, bottom: 351, scrollY: 0, startY: 0 })).toBe(301);
  });

  it('never scrolls in the browser when the view is junk', () => {
    vi.useFakeTimers();
    const box = document.createElement('input');
    document.body.appendChild(box);
    box.focus();
    box.getBoundingClientRect = () => ({ top: 313, bottom: 351 });
    const was = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const vv = new EventTarget();
    vv.height = -33554432; vv.offsetTop = 0;
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 812, configurable: true });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const stop = keepTypingInView(box);
    for (let i = 0; i < 5; i++) { vv.dispatchEvent(new Event('resize')); vi.advanceTimersByTime(1000); }
    expect(scrollTo).not.toHaveBeenCalled();
    stop();
    scrollTo.mockRestore();
    if (was) Object.defineProperty(window, 'visualViewport', was); else delete window.visualViewport;
    vi.useRealTimers();
    document.body.innerHTML = '';
  });
});

describe('keepTypingInView', () => {
  afterEach(() => { vi.useRealTimers(); delete window.__typingGuard; document.body.innerHTML = ''; });

  it('scrolls back once the page is still, records it, and stops on blur', () => {
    vi.useFakeTimers();
    const box = document.createElement('input');
    document.body.appendChild(box);
    box.focus();
    let top = 200;
    box.getBoundingClientRect = () => ({ top, bottom: top + 38 });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const stop = keepTypingInView(box);

    top = -2400; // iOS threw the page 2600 down
    Object.defineProperty(window, 'scrollY', { value: 2600, configurable: true });
    box.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(100);
    expect(scrollTo).not.toHaveBeenCalled(); // not while the page may still be moving
    vi.advanceTimersByTime(200);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(window.__typingGuard.rescues).toBe(1);

    stop();
    box.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(500);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    scrollTo.mockRestore();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });
});
