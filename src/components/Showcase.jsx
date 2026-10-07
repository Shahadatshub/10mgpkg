import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import Loader from "./Loader.jsx";
import Ending from "./Ending.jsx";
import Exhibition from "./Exhibition.jsx";
import {
  onFrame,
  invalidate,
  attachLenis,
  detachLenis,
  lockScroll,
  unlockScroll,
} from "../lib/motion.js";

/* useLayoutEffect warns during server rendering; this quiets it without
   changing behaviour in the browser. */
const useIsoLayout =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------------------
   Inertial scrolling. The page glides and settles rather than jumping a fixed
   distance per wheel click — this is most of what makes the motion feel
   considered rather than mechanical. Lenis is driven from the shared loop in
   lib/motion.js so every effect sees the same scroll position each frame.
   --------------------------------------------------------------------------- */
function useSmoothScroll() {
  useEffect(() => {
    if (reduced()) return;
    let lenis;
    let cancelled = false;

    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        // Phones already have good native inertia; overriding it feels worse.
        syncTouch: false,
        autoRaf: false,
      });
      attachLenis(lenis);
    });

    return () => {
      cancelled = true;
      detachLenis();
      lenis?.destroy();
    };
  }, []);
}

/* ---------------------------------------------------------------------------
   The title sinks and fades as you leave the opening screen, so the handover
   to the first album feels like one movement rather than a cut.
   --------------------------------------------------------------------------- */
function useHeroRecede() {
  useEffect(() => {
    if (reduced()) return;
    const el = document.querySelector("[data-hero-center]");
    if (!el) return;
    return onFrame((y, vh) => {
      if (y > vh * 1.2) return; // long gone; nothing to update
      const p = Math.min(1, y / (vh * 0.85));
      el.style.transform = `translate3d(0, ${(y * 0.32).toFixed(1)}px, 0)`;
      el.style.opacity = String(Math.max(0, 1 - p * 1.25));
    });
  }, []);
}

/* ---------------------------------------------------------------------------
   Parallax. Each [data-para] element drifts by its own amount as it crosses
   the screen.

   Position is measured from the element's parent, which never moves, rather
   than from the drifting element itself — measuring the thing you are moving
   makes it chase its own tail. All positions are read first, then all
   transforms are written, so the browser lays the page out once per frame
   instead of once per photograph.
   --------------------------------------------------------------------------- */
function useParallax(deps) {
  useEffect(() => {
    if (reduced()) return;
    let items = [];

    const collect = () => {
      items = [...document.querySelectorAll("[data-para]")].map((el) => ({
        el,
        anchor: el.parentElement,
        amount: Number(el.dataset.para) || 0,
        last: null,
      }));
      invalidate();
    };

    const warm = setTimeout(collect, 60);
    window.addEventListener("resize", collect);

    const stop = onFrame((_, vh) => {
      const rects = items.map((it) => it.anchor.getBoundingClientRect());
      for (let i = 0; i < items.length; i++) {
        const r = rects[i];
        if (r.bottom < -300 || r.top > vh + 300) continue;
        // -1 above the fold, 0 centred, 1 below
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        const v = (p * items[i].amount).toFixed(1);
        if (v === items[i].last) continue;
        items[i].last = v;
        items[i].el.style.transform = `translate3d(0, ${v}px, 0)`;
      }
    });

    return () => {
      clearTimeout(warm);
      stop();
      window.removeEventListener("resize", collect);
    };
  }, deps);
}

/* ---------------------------------------------------------------------------
   Pauses anything it wraps while it is off screen, so nothing animates in
   parts of the page nobody is looking at.
   --------------------------------------------------------------------------- */
function useOnScreen(ref, margin = "120px") {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: margin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return visible;
}

/* ---------------------------------------------------------------------------
   Horizontal swipe for touch screens (and click-drag with a mouse). Vertical
   movement is left to the page, so a swipe never fights a scroll. While the
   finger is down the content follows it; on release `onSwipe(-1 | 1)` fires
   if it travelled far enough or fast enough.
   --------------------------------------------------------------------------- */
function useSwipe(ref, { onSwipe, onDrag, onStart, onEnd, vertical }) {
  const handlers = useRef({});
  handlers.current = { onSwipe, onDrag, onStart, onEnd, vertical };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = null;

    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      s = { x: e.clientX, y: e.clientY, t: performance.now(), axis: null, id: e.pointerId };
    };
    const move = (e) => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (s.axis === "x" || handlers.current.vertical) {
          el.setPointerCapture?.(e.pointerId);
          handlers.current.onStart?.();
        }
      }
      if (s.axis === "x") handlers.current.onDrag?.(dx, 0);
      else if (handlers.current.vertical) handlers.current.onDrag?.(0, dy);
    };
    const up = (e) => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const dt = Math.max(1, performance.now() - s.t);
      const axis = s.axis;
      s = null;
      if (!axis) return;
      // A drag is not a click: swallow the click that may follow it, but only
      // briefly, so a later real tap is never eaten.
      const swallow = (c) => {
        c.stopPropagation();
        c.preventDefault();
      };
      el.addEventListener("click", swallow, true);
      setTimeout(() => el.removeEventListener("click", swallow, true), 350);

      const fast = (axis === "x" ? Math.abs(dx) : Math.abs(dy)) / dt > 0.45;
      if (axis === "x") {
        const go = Math.abs(dx) > 60 || fast ? (dx < 0 ? 1 : -1) : 0;
        handlers.current.onEnd?.();
        if (go) handlers.current.onSwipe?.(go, "x");
      } else if (handlers.current.vertical) {
        const go = dy > 110 || (fast && dy > 30);
        handlers.current.onEnd?.();
        if (go) handlers.current.onSwipe?.(1, "y");
      }
    };
    const cancel = () => {
      if (s?.axis) handlers.current.onEnd?.();
      s = null;
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [ref]);
}

/* ===========================================================================
   OPENING SCREEN
   =========================================================================== */

// Positions are percentages of the photo field, which starts below the menu
// bar. Nothing is placed in the central band — the title and welcome line own
// that space, and a photograph drifting through it makes both hard to read.
const SLOTS = [
  { l: 5, t: 10, w: 14, small: true },
  { l: 2, t: 40, w: 11 },
  { l: 15, t: 70, w: 12, small: true },
  { l: 80, t: 9, w: 14, small: true },
  { l: 87, t: 40, w: 11 },
  { l: 73, t: 70, w: 12, small: true },
  { l: 45, t: 2, w: 10, small: true },
  { l: 44, t: 67, w: 12, small: true },
];

// Phones get fewer, larger photographs, kept clear of the "Scroll" cue at the
// bottom and of the title in the middle.
const SLOTS_SM = [
  { l: 5, t: 4, w: 36, small: true },
  { l: 58, t: 11, w: 36, small: true },
  { l: 6, t: 62, w: 36, small: true },
  { l: 57, t: 68, w: 36, small: true },
];

function HeroSlot({ pool, seed, delay, onOpen }) {
  const [pair, setPair] = useState({ cur: seed % pool.length, prev: null });

  useEffect(() => {
    if (pool.length < 2 || reduced()) return;
    let timer;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        // Don't swap photographs nobody can see (the tab is hidden, or the
        // visitor has scrolled well past the opening screen).
        if (document.hidden || window.scrollY > window.innerHeight * 1.5) return;
        setPair((p) => ({
          prev: p.cur,
          cur: (p.cur + 1 + Math.floor(Math.random() * 3)) % pool.length,
        }));
      }, 5200);
    }, delay);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [pool.length, delay]);

  const cur = pool[pair.cur];
  const prev = pair.prev !== null ? pool[pair.prev] : null;
  if (!cur) return null;

  return (
    <button
      className="slot"
      onClick={(e) => onOpen(cur, e.currentTarget.getBoundingClientRect())}
      aria-label={cur.autoTitle ? "Open photograph" : cur.title}
      tabIndex={-1}
    >
      {prev && (
        <img
          key={`p-${pair.prev}`}
          className="slot__img slot__img--out"
          src={prev.thumb.src}
          alt=""
          decoding="async"
        />
      )}
      <img
        key={`c-${pair.cur}`}
        className="slot__img slot__img--in"
        src={cur.thumb.src}
        alt=""
        loading="eager"
        decoding="async"
      />
    </button>
  );
}

function Hero({ hero, onOpen }) {
  const pool = hero.pool || [];
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const slots = narrow ? SLOTS_SM : SLOTS;

  return (
    <header className="hero" id="top">
      <div className="hero__field" aria-hidden="true">
        {slots.map((s, i) => (
          <div
            key={`${narrow}-${i}`}
            className={`hero__slot${s.small ? " hero__slot--small" : ""}`}
            style={{
              left: `${s.l}%`,
              top: `${s.t}%`,
              width: `${s.w}%`,
              animationDelay: `${0.15 + i * 0.09}s`,
            }}
          >
            {pool.length > 0 && (
              <span
                className="hero__para"
                data-para={[60, 110, 80, 130, 70, 120, 95, 85][i % 8]}
              >
                <HeroSlot
                  pool={pool}
                  seed={i * 3}
                  delay={i * 640}
                  onOpen={onOpen}
                />
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="hero__center" data-hero-center>
        <h1 className="hero__title display">{hero.title}</h1>
        {hero.welcome && <p className="hero__welcome display">{hero.welcome}</p>}
      </div>

      <div className="hero__scroll label" aria-hidden="true">
        <span>Scroll</span>
        <i className="hero__scroll-line" />
      </div>
    </header>
  );
}

/* ===========================================================================
   SECTION — a title with a row of photographs that advances on its own
   =========================================================================== */

const GAP = 12;

function visibleCount(w) {
  if (w < 620) return 1;
  if (w < 1000) return 2;
  return 3;
}

function Reel({ section, onOpen }) {
  const wrapRef = useRef(null);
  const windowRef = useRef(null);
  const trackRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [hover, setHover] = useState(false);
  const [held, setHeld] = useState(false); // a finger was just on it
  const onScreen = useOnScreen(wrapRef);
  const resume = useRef(0);

  const photos = section.photos;
  const n = photos.length;
  const per = visibleCount(width);
  const loops = n > per;
  // A duplicated run lets the row keep moving forward instead of rewinding.
  const strip = loops ? [...photos, ...photos] : photos;
  const slotW = width ? (width - GAP * (per - 1)) / per : 0;
  const step = slotW + GAP;
  const paused = hover || held;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const next = useCallback(() => {
    // While the duplicate run is being swapped back, ignore extra presses so
    // the row can never run past its end and show an empty gap.
    setIndex((i) => (i >= n ? i : i + 1));
  }, [n]);

  const indexRef = useRef(0);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const prev = useCallback(() => {
    if (indexRef.current > 0) {
      setIndex((i) => Math.max(0, i - 1));
      return;
    }
    // At the very start: jump invisibly to the identical spot in the
    // duplicate run, then glide back one. Without this the row would race
    // backwards across every photograph to reach the last one.
    setAnimate(false);
    setIndex(n);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true);
        setIndex(n - 1);
      })
    );
  }, [n]);

  useEffect(() => {
    if (!loops || paused || !onScreen || reduced()) return;
    const t = setInterval(next, 4600);
    return () => clearInterval(t);
  }, [loops, paused, onScreen, next]);

  // When the duplicated run has scrolled past, jump back with no animation.
  useEffect(() => {
    if (index < n || !animate) return;
    const t = setTimeout(() => {
      setAnimate(false);
      setIndex((i) => i - n);
    }, 900);
    return () => clearTimeout(t);
  }, [index, n, animate]);

  useEffect(() => {
    if (animate) return;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnimate(true))
    );
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (onScreen) setShown(true);
  }, [onScreen]);

  // Re-measure parallax once the row has faded into its final place.
  useEffect(() => {
    if (shown) invalidate();
  }, [shown]);

  const base = loops ? -index * step : 0;

  useSwipe(windowRef, {
    onStart: () => {
      clearTimeout(resume.current);
      setHeld(true);
      if (trackRef.current) trackRef.current.style.transition = "none";
    },
    onDrag: (dx) => {
      if (!loops || !trackRef.current) return;
      // The row follows the finger until it lets go.
      trackRef.current.style.transform = `translate3d(${base + dx}px, 0, 0)`;
    },
    onEnd: () => {
      if (trackRef.current) {
        trackRef.current.style.transition = "";
        trackRef.current.style.transform = "";
      }
      // Give the visitor time to look before the row moves on by itself.
      resume.current = setTimeout(() => setHeld(false), 6000);
    },
    onSwipe: (dir) => {
      if (!loops) return;
      dir > 0 ? next() : prev();
    },
  });

  useEffect(() => () => clearTimeout(resume.current), []);

  const current = ((index % n) + n) % n;
  const hasHead = Boolean(section.title || section.subtitle);

  return (
    <section
      id={section.id}
      className={`reel${shown ? " reel--shown" : ""}${hasHead ? "" : " reel--headless"}`}
      ref={wrapRef}
    >
      {hasHead && (
        <div className="reel__head">
          {section.title && (
            <h2 className="reel__title display">{section.title}</h2>
          )}
          {section.subtitle && (
            <p className="reel__sub label">{section.subtitle}</p>
          )}
        </div>
      )}

      <div
        className={`reel__window${loops ? "" : " reel__window--static"}`}
        ref={windowRef}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <div
          ref={trackRef}
          className="reel__track"
          style={{
            transform: loops ? `translate3d(${base}px, 0, 0)` : undefined,
            transition: animate
              ? "transform 900ms cubic-bezier(0.16, 1, 0.3, 1)"
              : "none",
          }}
        >
          {strip.map((p, i) => (
            <Frame
              key={`${p.slug}-${i}`}
              photo={p}
              width={slotW}
              onOpen={onOpen}
              drift={[30, 52, 38][i % 3]}
              eager={i < per + 1}
            />
          ))}
        </div>

        {loops && (
          <>
            <button
              className="reel__arrow reel__arrow--prev"
              onClick={prev}
              aria-label={`Previous in ${section.title || "section"}`}
            >
              <Chevron dir="left" />
            </button>
            <button
              className="reel__arrow reel__arrow--next"
              onClick={next}
              aria-label={`Next in ${section.title || "section"}`}
            >
              <Chevron dir="right" />
            </button>
          </>
        )}
      </div>

      {loops && (
        <div className="reel__meta">
          <div className="reel__dots" role="tablist" aria-label="Photographs">
            {photos.map((p, i) => (
              <button
                key={p.slug}
                role="tab"
                aria-selected={i === current}
                aria-label={`Photograph ${i + 1} of ${n}`}
                className={`reel__dot${i === current ? " is-on" : ""}`}
                onClick={() => {
                  setAnimate(true);
                  setIndex(i);
                }}
              />
            ))}
          </div>
          <span className="label reel__count">
            {String(current + 1).padStart(2, "0")}
            <span className="reel__countSep">/</span>
            {String(n).padStart(2, "0")}
          </span>
        </div>
      )}
    </section>
  );
}

function Chevron({ dir }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={dir === "left" ? "M14.5 5.5 8 12l6.5 6.5" : "M9.5 5.5 16 12l-6.5 6.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Frame({ photo, width, onOpen, drift = 34, eager = false }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  // A cached image can finish before React attaches onLoad, which would
  // otherwise leave it stuck invisible.
  useEffect(() => {
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  // Wide photographs in a tall card would lose most of the picture to the
  // crop. Show them whole instead, floating on a soft, darkened copy of
  // themselves.
  const wide = photo.width / photo.height > 1.05;

  return (
    <button
      className={`frame${wide ? " frame--wide" : ""}${loaded ? " is-loaded" : ""}`}
      style={{ width: width ? `${width}px` : undefined }}
      onClick={(e) => onOpen(photo, e.currentTarget.getBoundingClientRect())}
      aria-label={photo.autoTitle ? "Open photograph" : photo.title}
    >
      <span className="frame__para" data-para={drift}>
        {photo.lqip && (
          <img
            className="frame__blur"
            src={photo.lqip}
            alt=""
            aria-hidden="true"
          />
        )}
        {wide && (
          // The same file as the photograph below (same srcset, so the
          // browser downloads it once), blown up and darkened to fill the card.
          <img
            className="frame__fill"
            src={photo.thumb.src}
            srcSet={photo.thumb.srcset || undefined}
            sizes={photo.thumb.sizes || undefined}
            alt=""
            aria-hidden="true"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
          />
        )}
        <img
          ref={imgRef}
          className="frame__img"
          src={photo.thumb.src}
          srcSet={photo.thumb.srcset || undefined}
          sizes={photo.thumb.sizes || undefined}
          alt={photo.autoTitle ? "" : photo.title}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
        />
      </span>
      {!photo.autoTitle && (
        <span className="frame__caption label">{photo.title}</span>
      )}
    </button>
  );
}

/* ===========================================================================
   LIGHTBOX
   =========================================================================== */

function Lightbox({ list, index, origin, label, onClose, onStep }) {
  const imgRef = useRef(null);
  const stageRef = useRef(null);
  const [closing, setClosing] = useState(false);
  const photo = list[index];

  useIsoLayout(() => {
    if (!origin || !imgRef.current || reduced()) return;
    const el = imgRef.current;
    const to = el.getBoundingClientRect();
    if (!to.width || !to.height) return;

    const dx = origin.left + origin.width / 2 - (to.left + to.width / 2);
    const dy = origin.top + origin.height / 2 - (to.top + to.height / 2);
    const sx = origin.width / to.width;
    const sy = origin.height / to.height;

    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.style.opacity = "0.55";

    const raf = requestAnimationFrame(() => {
      el.style.transition =
        "transform 460ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms ease-out";
      el.style.transform = "none";
      el.style.opacity = "1";
    });
    return () => cancelAnimationFrame(raf);
  }, [index, origin]);

  const close = useCallback(() => {
    if (reduced()) return onClose();
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    lockScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [close, onStep]);

  // Fetch the neighbours now, so stepping through is instant.
  useEffect(() => {
    for (const d of [1, -1]) {
      const p = list[(index + d + list.length) % list.length];
      if (p) new Image().src = p.full.src;
    }
  }, [index, list]);

  useSwipe(stageRef, {
    vertical: true,
    onStart: () => {
      if (imgRef.current) imgRef.current.style.transition = "none";
    },
    onDrag: (dx, dy) => {
      const el = imgRef.current;
      if (!el) return;
      if (dy) {
        const d = Math.max(0, dy);
        el.style.transform = `translate3d(0, ${d}px, 0) scale(${1 - Math.min(d / 1600, 0.12)})`;
        el.style.opacity = String(1 - Math.min(d / 500, 0.6));
      } else {
        el.style.transform = `translate3d(${dx}px, 0, 0)`;
      }
    },
    onEnd: () => {
      const el = imgRef.current;
      if (!el) return;
      el.style.transition = "transform 360ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms ease";
      el.style.transform = "none";
      el.style.opacity = "1";
    },
    onSwipe: (dir, axis) => {
      if (axis === "y") close();
      else onStep(dir);
    },
  });

  if (!photo) return null;
  const heading = photo.autoTitle ? label : photo.title;

  return (
    <div
      className={`lightbox${closing ? " lightbox--out" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={heading || "Photograph"}
      data-lenis-prevent
    >
      <div className="lightbox__bar">
        <span className="label">
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(list.length).padStart(2, "0")}
        </span>
        <button className="lightbox__close" onClick={close} aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="lightbox__stage" ref={stageRef}>
        <button
          className="lightbox__nav lightbox__nav--prev"
          onClick={() => onStep(-1)}
          aria-label="Previous"
        >
          <Chevron dir="left" />
        </button>
        <img
          key={photo.slug}
          ref={imgRef}
          className="lightbox__img"
          src={photo.full.src}
          alt={photo.autoTitle ? "" : photo.title}
          width={photo.full.width}
          height={photo.full.height}
          draggable={false}
          // The small version is already in the browser's cache, so it shows
          // instantly while the sharp one downloads on top of it.
          style={{ backgroundImage: `url(${photo.thumb.src})` }}
        />
        <button
          className="lightbox__nav lightbox__nav--next"
          onClick={() => onStep(1)}
          aria-label="Next"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="lightbox__meta">
        <div>
          {heading && <p className="display lightbox__title">{heading}</p>}
          {photo.caption && <p className="lightbox__caption">{photo.caption}</p>}
        </div>
        <a className="label lightbox__permalink" href={`/i/${photo.slug}/`}>
          Open page ↗
        </a>
      </div>
    </div>
  );
}

/* ===========================================================================
   PAGE
   =========================================================================== */

export default function Showcase({ hero, sections, site, exhibition }) {
  const [box, setBox] = useState(null);

  useSmoothScroll();
  useParallax([sections]);
  useHeroRecede();

  const open = useCallback((photo, rect, list, label) => {
    const within = list || [photo];
    const i = within.findIndex((p) => p.slug === photo.slug);
    setBox({ list: within, index: i < 0 ? 0 : i, origin: rect || null, label: label || "" });
  }, []);

  const step = useCallback((delta) => {
    setBox((b) =>
      b
        ? {
            ...b,
            origin: null,
            index: (b.index + delta + b.list.length) % b.list.length,
          }
        : b
    );
  }, []);

  const close = useCallback(() => setBox(null), []);

  if (!hero.pool?.length) {
    return (
      <div className="empty">
        <p className="display empty__line">
          No photographs yet. Drop image files into <code>src/photos/</code>.
        </p>
      </div>
    );
  }

  return (
    <>
      <Loader title={site?.title} />

      <Hero hero={hero} onOpen={(p, r) => open(p, r, hero.pool, site?.title)} />

      {exhibition?.poster && <Exhibition exhibition={exhibition} />}

      <main>
        {sections.map((s) => (
          <Reel
            key={s.id}
            section={s}
            onOpen={(p, r) => open(p, r, s.photos, s.title || site?.title)}
          />
        ))}
      </main>

      <Ending site={site} />

      {box && (
        <Lightbox
          list={box.list}
          index={box.index}
          origin={box.origin}
          label={box.label}
          onClose={close}
          onStep={step}
        />
      )}
    </>
  );
}
