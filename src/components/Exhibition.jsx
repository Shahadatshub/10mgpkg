import React, { useRef, useEffect } from "react";

/* ---------------------------------------------------------------------------
   A scroll-pinned sequence for the current exhibition.

   The section is tall; the stage inside it sticks to the viewport while you
   scroll through that height. Scroll position — not a timer — drives three
   phases, so the visitor is in control the whole way and can stop, reverse,
   or sit on any frame:

     1. the poster arrives, out of focus and undersized, and settles
     2. the wording morphs in around it, each line from its own direction
     3. poster and wording part and leave in opposite directions

   Everything is written straight to style in one animation loop rather than
   through React state, so no frame costs a re-render.
   --------------------------------------------------------------------------- */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// Local progress within a window of the overall scroll, eased.
const seg = (p, from, to) => clamp((p - from) / (to - from));
const outExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const inOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Each line of type enters from its own direction, which is what gives the
// group the feeling of assembling rather than simply appearing.
const LINES = [
  { key: "dates", from: [-70, 0], at: 0.30 },
  { key: "title", from: [0, -60], at: 0.34 },
  { key: "kind", from: [70, 0], at: 0.38 },
  { key: "venue", from: [0, 60], at: 0.48 },
];

export default function Exhibition({ exhibition = {} }) {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const posterRef = useRef(null);
  const lineRefs = useRef({});

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      // Show the finished frame and animate nothing.
      if (posterRef.current) {
        posterRef.current.style.opacity = "1";
        posterRef.current.style.transform = "none";
        posterRef.current.style.filter = "none";
      }
      Object.values(lineRefs.current).forEach((el) => {
        if (el) {
          el.style.opacity = "1";
          el.style.transform = "none";
        }
      });
      return;
    }

    let raf;
    const tick = () => {
      const r = wrap.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = travel > 0 ? clamp(-r.top / travel) : 0;

      // 1 — the poster finds focus, the way the loading screen does
      const enter = outExpo(seg(p, 0.02, 0.26));
      // 3 — the parting
      const leave = inOut(seg(p, 0.74, 0.97));

      const poster = posterRef.current;
      if (poster) {
        const scale = 0.86 + 0.14 * enter - 0.06 * leave;
        const x = -180 * leave;
        const blur = (1 - enter) * 14;
        poster.style.transform = `translate3d(${x}px, 0, 0) scale(${scale.toFixed(4)})`;
        poster.style.opacity = String(clamp(enter - leave));
        poster.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : "none";
      }

      // 2 — the wording assembles, each line on its own beat
      for (const line of LINES) {
        const el = lineRefs.current[line.key];
        if (!el) continue;
        const a = outExpo(seg(p, line.at, line.at + 0.16));
        const [fx, fy] = line.from;
        const x = fx * (1 - a) + 200 * leave;
        const y = fy * (1 - a);
        const s = 0.94 + 0.06 * a;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(
          1
        )}px, 0) scale(${s.toFixed(4)})`;
        el.style.opacity = String(clamp(a - leave));
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const set = (key) => (el) => {
    lineRefs.current[key] = el;
  };

  if (!exhibition.poster) return null;

  return (
    <section className="exhibit" ref={wrapRef} aria-label="Current exhibition">
      <div className="exhibit__stage" ref={stageRef}>
        <div className="exhibit__grid">
          {exhibition.dates && (
            <p className="exhibit__dates label" ref={set("dates")}>
              {exhibition.dates}
            </p>
          )}

          <div className="exhibit__middle">
            {exhibition.title && (
              <h2 className="exhibit__title display" ref={set("title")}>
                {exhibition.title}
              </h2>
            )}

            <figure className="exhibit__poster" ref={posterRef}>
              <img src={exhibition.poster} alt={exhibition.alt || "Exhibition poster"} />
            </figure>

            <div className="exhibit__venue" ref={set("venue")}>
              <span className="display exhibit__venueName">{exhibition.venue}</span>
              {exhibition.place && (
                <span className="label exhibit__place">{exhibition.place}</span>
              )}
              {exhibition.link && (
                <a
                  className="label exhibit__cta"
                  href={exhibition.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Details ↗
                </a>
              )}
            </div>
          </div>

          {exhibition.kind && (
            <p className="exhibit__kind label" ref={set("kind")}>
              {exhibition.kind}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
