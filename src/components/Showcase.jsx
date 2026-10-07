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
   considered rather than mechanical.
   --------------------------------------------------------------------------- */
function useSmoothScroll() {
  useEffect(() => {
    if (reduced()) return;
    let lenis;
    let raf;
    let cancelled = false;

    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;

      lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        // Phones already have good native inertia; overriding it feels worse.
        syncTouch: false,
      });

      // Handed to the menu bar so a nav click glides using the same
      // scroller as the wheel, instead of fighting it with a native jump.
      window.__lenis = lenis;

      const tick = (time) => {
        lenis.raf(time);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      lenis?.destroy();
      if (typeof window !== "undefined") window.__lenis = null;
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
    let raf;
    const tick = () => {
      const el = document.querySelector("[data-hero-center]");
      if (el) {
        const vh = window.innerHeight;
        const y = window.scrollY;
        const p = Math.min(1, y / (vh * 0.85));
        el.style.transform = `translate3d(0, ${(y * 0.32).toFixed(1)}px, 0)`;
        el.style.opacity = String(Math.max(0, 1 - p * 1.25));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/* ---------------------------------------------------------------------------
   One loop drives every scroll-linked movement on the page. Running a single
   rAF and writing only transforms keeps this cheap no matter how many
   photographs are on screen.
   --------------------------------------------------------------------------- */
function useParallax(deps) {
  useEffect(() => {
    if (reduced()) return;
    let raf;
    let items = [];

    const collect = () => {
      items = [...document.querySelectorAll("[data-para]")].map((el) => ({
        el,
        amount: Number(el.dataset.para) || 0,
      }));
    };

    // Wait a frame so sections mounted in this pass are included.
    const warm = setTimeout(collect, 60);
    window.addEventListener("resize", collect);

    const tick = () => {
      const vh = window.innerHeight;
      for (const { el, amount } of items) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -300 || r.top > vh + 300) continue;
        // -1 above the fold, 0 centred, 1 below
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.transform = `translate3d(0, ${(p * amount).toFixed(2)}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      clearTimeout(warm);
      cancelAnimationFrame(raf);
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

/* ===========================================================================
   OPENING SCREEN
   =========================================================================== */

// Positions are percentages of the screen. The middle is deliberately clear
// so photographs never sit on top of the title.
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

// Phones get fewer, larger, and differently placed photographs — the desktop
// arrangement would push slots off the edge of a narrow screen.
const SLOTS_SM = [
  { l: 4, t: 8, w: 32, small: true },
  { l: 62, t: 15, w: 32, small: true },
  { l: 5, t: 70, w: 32, small: true },
  { l: 60, t: 78, w: 32, small: true },
];

function HeroSlot({ pool, seed, delay, onOpen }) {
  const [pair, setPair] = useState({ cur: seed % pool.length, prev: null });

  useEffect(() => {
    if (pool.length < 2 || reduced()) return;
    let timer;
    const start = setTimeout(() => {
      timer = setInterval(() => {
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
      aria-label={cur.title}
      tabIndex={-1}
    >
      {prev && (
        <img
          key={`p-${pair.prev}`}
          className="slot__img slot__img--out"
          src={prev.thumb.src}
          alt=""
        />
      )}
      <img
        key={`c-${pair.cur}`}
        className="slot__img slot__img--in"
        src={cur.thumb.src}
        alt=""
        loading="eager"
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
    <header className="hero">
      <div className="hero__field" aria-hidden="true">
        {slots.map((s, i) => (
          <div
            key={i}
            className={`hero__slot${s.small ? " hero__slot--small" : ""}`}
            style={{ left: `${s.l}%`, top: `${s.t}%`, width: `${s.w}%` }}
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
        Scroll
      </div>
    </header>
  );
}

/* ===========================================================================
   SECTION — a title with a row of photographs that advances on its own
   =========================================================================== */

function visibleCount(w) {
  if (w < 620) return 1;
  if (w < 1000) return 2;
  return 3;
}

function Reel({ section, onOpen }) {
  const wrapRef = useRef(null);
  const trackRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const onScreen = useOnScreen(wrapRef);

  const photos = section.photos;
  const per = visibleCount(width);
  const loops = photos.length > per;
  // A duplicated run lets the row keep moving forward instead of rewinding.
  const strip = loops ? [...photos, ...photos] : photos;
  const slotW = width ? (width - 12 * (per - 1)) / per : 0;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!loops || paused || !onScreen || reduced()) return;
    const t = setInterval(() => setIndex((i) => i + 1), 4600);
    return () => clearInterval(t);
  }, [loops, paused, onScreen]);

  // When the duplicated run has scrolled past, jump back with no animation.
  useEffect(() => {
    if (index < photos.length) return;
    const t = setTimeout(() => {
      setAnimate(false);
      setIndex((i) => i - photos.length);
    }, 900);
    return () => clearTimeout(t);
  }, [index, photos.length]);

  useEffect(() => {
    if (animate) return;
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (onScreen) setShown(true);
  }, [onScreen]);

  return (
    <section
      id={section.id}
      className={`reel${shown ? " reel--shown" : ""}`}
      ref={wrapRef}
    >
      <div className="reel__head">
        <h2 className="reel__title display">{section.title}</h2>
        {section.subtitle && (
          <p className="reel__sub label">{section.subtitle}</p>
        )}
      </div>

      <div
        className="reel__window"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div
          ref={trackRef}
          className="reel__track"
          style={{
            transform: `translate3d(-${index * (slotW + 12)}px, 0, 0)`,
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
            />
          ))}
        </div>

        {loops && (
          <>
            <button
              className="reel__arrow reel__arrow--prev"
              onClick={() =>
                setIndex((i) => (i > 0 ? i - 1 : photos.length - 1))
              }
              aria-label={`Previous in ${section.title || "section"}`}
            >
              ‹
            </button>
            <button
              className="reel__arrow reel__arrow--next"
              onClick={() => setIndex((i) => i + 1)}
              aria-label={`Next in ${section.title || "section"}`}
            >
              ›
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function Frame({ photo, width, onOpen, drift = 34 }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  // A cached image can finish before React attaches onLoad, which would
  // otherwise leave it stuck invisible.
  useEffect(() => {
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <button
      className="frame"
      style={{ width: width ? `${width}px` : undefined }}
      onClick={(e) => onOpen(photo, e.currentTarget.getBoundingClientRect())}
      aria-label={photo.title}
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
        <img
          ref={imgRef}
          className="frame__img"
          src={photo.thumb.src}
          srcSet={photo.thumb.srcset || undefined}
          sizes={photo.thumb.sizes || undefined}
          alt={photo.title}
          loading="lazy"
          decoding="async"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
        />
      </span>
      <span className="frame__caption label">{photo.title}</span>
    </button>
  );
}

/* ===========================================================================
   LIGHTBOX
   =========================================================================== */

function Lightbox({ list, index, origin, onClose, onStep }) {
  const imgRef = useRef(null);
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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onStep]);

  if (!photo) return null;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.title}
    >
      <div className="lightbox__bar">
        <span className="label">
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(list.length).padStart(2, "0")}
        </span>
        <button className="lightbox__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="lightbox__stage">
        <button
          className="lightbox__nav"
          onClick={() => onStep(-1)}
          aria-label="Previous"
        >
          ‹
        </button>
        <img
          ref={imgRef}
          className="lightbox__img"
          src={photo.full.src}
          alt={photo.title}
          width={photo.full.width}
          height={photo.full.height}
        />
        <button
          className="lightbox__nav"
          onClick={() => onStep(1)}
          aria-label="Next"
        >
          ›
        </button>
      </div>

      <div className="lightbox__meta">
        <div>
          <p className="display lightbox__title">{photo.title}</p>
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

  const open = useCallback((photo, rect, list) => {
    const within = list || [photo];
    const i = within.findIndex((p) => p.slug === photo.slug);
    setBox({ list: within, index: i < 0 ? 0 : i, origin: rect || null });
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

      <Hero hero={hero} onOpen={(p, r) => open(p, r, hero.pool)} />

      {exhibition?.poster && <Exhibition exhibition={exhibition} />}

      <main>
        {sections.map((s) => (
          <Reel key={s.id} section={s} onOpen={(p, r) => open(p, r, s.photos)} />
        ))}
      </main>

      <Ending site={site} />

      {box && (
        <Lightbox
          list={box.list}
          index={box.index}
          origin={box.origin}
          onClose={close}
          onStep={step}
        />
      )}
    </>
  );
}
