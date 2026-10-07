/* ===========================================================================
   One animation loop for the whole page.

   Every scroll-linked effect (the inertial scroll itself, parallax, the hero
   title sinking, the exhibition sequence) subscribes here instead of running
   its own requestAnimationFrame. Two reasons:

   1. Order. The smooth scroller moves the page first, then every effect reads
      that same position in the same frame. With separate loops an effect can
      run before the scroll update and draw one frame behind, which is what
      makes parallax photographs shiver.

   2. Rest. When the page is not moving, subscribers are not called at all,
      so an idle page costs nothing.
   =========================================================================== */

const subscribers = new Set();
let raf = 0;
let lenis = null;
let last = { y: -1, w: 0, h: 0 };
let forced = true;
let locks = 0;

function frame(time) {
  raf = requestAnimationFrame(frame);
  if (lenis) lenis.raf(time);

  const y = window.scrollY;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!forced && y === last.y && w === last.w && h === last.h) return;

  forced = false;
  last = { y, w, h };
  for (const fn of subscribers) fn(y, h, w);
}

function ensureRunning() {
  if (!raf && typeof window !== "undefined") raf = requestAnimationFrame(frame);
}

/** Run `fn(scrollY, viewportH, viewportW)` whenever the page moves. */
export function onFrame(fn) {
  subscribers.add(fn);
  forced = true;
  ensureRunning();
  return () => subscribers.delete(fn);
}

/** Make every subscriber recompute on the next frame (after a layout change). */
export function invalidate() {
  forced = true;
}

export function attachLenis(instance) {
  lenis = instance;
  if (lenis && locks > 0) lenis.stop();
  ensureRunning();
}

export function detachLenis() {
  lenis = null;
}

export function getLenis() {
  return lenis;
}

/* Scroll locking for overlays (the loading screen, the lightbox). Counted, so
   two overlays can lock and unlock independently. Stopping the smooth
   scroller matters: hiding body overflow alone does not stop it, and the page
   would keep scrolling underneath an open photograph. */
export function lockScroll() {
  locks += 1;
  if (locks === 1) {
    document.documentElement.classList.add("is-locked");
    lenis?.stop();
  }
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    document.documentElement.classList.remove("is-locked");
    lenis?.start();
  }
}

export function scrollToTarget(target, opts = {}) {
  if (lenis) {
    lenis.scrollTo(target, opts);
    return;
  }
  let y = 0;
  if (typeof target === "number") y = target;
  else if (target) y = target.getBoundingClientRect().top + window.scrollY + (opts.offset || 0);
  window.scrollTo({ top: y, behavior: "smooth" });
}
