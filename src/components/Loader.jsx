import React, { useEffect, useState } from "react";
import { lockScroll, unlockScroll } from "../lib/motion.js";

/* ---------------------------------------------------------------------------
   The loading screen is a lens finding focus: the wordmark starts blurred and
   slightly oversized, then sharpens, framed by four brackets that draw in like
   a viewfinder's focus box. It is the one moment on the site that says
   "photography" without using a photograph.
   --------------------------------------------------------------------------- */

const MIN_MS = 1100; // never flash by too fast to read
const MAX_MS = 2800; // never hold the visitor hostage to a slow image

export default function Loader({ title = "10MGPKG" }) {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // Someone who has asked for reduced motion should not sit through this.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      document.documentElement.classList.add("is-ready");
      setGone(true);
      return;
    }

    const started = Date.now();
    let outTimer;
    let doneTimer;

    let finishRef = null;
    let finished = false;
    // Fires on page load or after MAX_MS, whichever comes first — once.
    const finish = () => {
      if (finished || !finishRef) return;
      finished = true;
      finishRef();
    };

    // The page underneath should not scroll while the screen is up. The lock
    // is released the moment the screen starts fading, not after, so the
    // first scroll a visitor tries is never ignored.
    lockScroll();
    let locked = true;
    const release = () => {
      if (locked) {
        locked = false;
        unlockScroll();
      }
    };

    const startOut = () => {
      release();
      // Tells the opening screen to play its entrance as the curtain lifts.
      document.documentElement.classList.add("is-ready");
      setLeaving(true);
      doneTimer = setTimeout(() => setGone(true), 900);
    };
    finishRef = () => {
      const waited = Date.now() - started;
      outTimer = setTimeout(startOut, Math.max(0, MIN_MS - waited));
    };

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    const bail = setTimeout(finish, MAX_MS);

    return () => {
      window.removeEventListener("load", finish);
      clearTimeout(bail);
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
      release();
    };
  }, []);

  if (gone) return null;

  return (
    <div className={`loader${leaving ? " loader--out" : ""}`} aria-hidden="true">
      <div className="loader__focus">
        <span className="loader__bracket loader__bracket--tl" />
        <span className="loader__bracket loader__bracket--tr" />
        <span className="loader__bracket loader__bracket--bl" />
        <span className="loader__bracket loader__bracket--br" />
        <span className="loader__mark display">{title}</span>
      </div>
      <span className="loader__meter" />
    </div>
  );
}
