// @vitest-environment jsdom
// The request screen's search box (report of 2026-11-15: "When I start to
// type ... I get pushed all the way to the very bottom of the page. I can't
// see what I'm typing.").
import { describe, it, expect, vi, afterEach } from 'vitest';
import { rescueScroll, keepTypingInView } from '../utils/keepTypingInView.js';

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
