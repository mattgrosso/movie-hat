// keepTypingInView - while a text box has focus, put it back on screen if the
// page jumps away from it.
//
// 2026-11-15, Matt on the request screen: "When I start to type into the
// movie request field on my phone, I get pushed all the way to the very
// bottom of the page. I can't see what I'm typing." Nothing in Movie Hat
// scrolls on typing, and the iOS simulator would not do it (the request
// screen's layout, a long list, the bug-button pinner on and off, in Safari
// and installed: ~/code/sticky-lab, RequestTests). The likeliest cause is
// iOS itself on his phone: it scrolls to keep the caret in view, and when its
// visible view is out of step (the "phantom keyboard" screenPin.js describes)
// it can scroll somewhere useless. Whatever the cause, this undoes it.
//
// How: remember where the page was when the box got focus. Once the page has
// been still for a moment (so iOS's own scroll-into-view above the keyboard
// is left alone), look: if the box isn't inside the visible view, go back to
// where the page was, or, if that wouldn't show it either, put the box near
// the top of the visible view.
//
// 2026-11-15, the same day: iOS reported the visible view as -33554432 tall
// (junk). Measured against that, the box was never on screen, so this kept
// asking for a scroll and the page bounced. A view that is not a real
// height is ignored: the page's own height is used instead (`visibleView`).
//
// `window.__typingGuard` records each rescue, for a bug report.

const QUIET = 250 // ms the page must be still before we look
const MARGIN = 12 // px between the box and the top of the visible view when we place it

/**
 * The visible part of the page, in layout-viewport pixels. iOS's own
 * figures when they are real; the whole page when they are junk (a
 * negative, zero, huge or missing height). Pure, for the tests.
 */
export function visibleView ({ vvHeight, vvTop, innerHeight }) {
  const real = typeof vvHeight === 'number' && Number.isFinite(vvHeight) && vvHeight > 0 && vvHeight <= innerHeight * 2
  if (!real) return { viewTop: 0, viewHeight: innerHeight }
  const top = typeof vvTop === 'number' && Number.isFinite(vvTop) ? vvTop : 0
  return { viewTop: top, viewHeight: vvHeight }
}

/**
 * Where to scroll so the box is visible again, or null if it already is.
 * Rects are in layout-viewport pixels (getBoundingClientRect); the visible
 * view is `viewTop` (visualViewport.offsetTop) and `viewHeight` below it.
 * Pure, for the tests.
 */
export function rescueScroll ({ top, bottom, viewTop = 0, viewHeight, scrollY, startY }) {
  const fits = (t, b) => t >= viewTop - 1 && b <= viewTop + viewHeight + 1
  if (fits(top, bottom)) return null
  if (startY != null && startY !== scrollY) {
    const shift = scrollY - startY
    if (fits(top + shift, bottom + shift)) return startY
  }
  const target = Math.max(0, Math.round(scrollY + top - viewTop - MARGIN))
  return target === Math.round(scrollY) ? null : target
}

const record = () => {
  if (!window.__typingGuard) window.__typingGuard = { rescues: 0, last: null }
  return window.__typingGuard
}

/** Start guarding `el` (call on focus). Returns a function that stops (call on blur). */
export function keepTypingInView (el) {
  if (typeof window === 'undefined' || !el) return () => {}
  const startY = window.scrollY
  let timer = null
  const look = () => {
    timer = null
    if (document.activeElement !== el) return
    const vv = window.visualViewport
    const r = el.getBoundingClientRect()
    const to = rescueScroll({
      top: r.top,
      bottom: r.bottom,
      ...visibleView({ vvHeight: vv?.height, vvTop: vv?.offsetTop, innerHeight: window.innerHeight }),
      scrollY: window.scrollY,
      startY
    })
    if (to == null) return
    const rec = record()
    rec.rescues += 1
    rec.last = { from: Math.round(window.scrollY), to, startY: Math.round(startY), boxTop: Math.round(r.top), view: vv ? `${Math.round(vv.height)}@${Math.round(vv.offsetTop || 0)}` : null, at: new Date().toISOString() }
    window.scrollTo(window.scrollX, to)
  }
  const soon = () => { clearTimeout(timer); timer = setTimeout(look, QUIET) }
  window.addEventListener('scroll', soon, { passive: true })
  window.visualViewport?.addEventListener('resize', soon)
  window.visualViewport?.addEventListener('scroll', soon)
  el.addEventListener('input', soon)
  return () => {
    clearTimeout(timer)
    window.removeEventListener('scroll', soon)
    window.visualViewport?.removeEventListener('resize', soon)
    window.visualViewport?.removeEventListener('scroll', soon)
    el.removeEventListener('input', soon)
  }
}
