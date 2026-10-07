import React, { useEffect, useState } from "react";

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
      setGone(true);
      return;
    }

    const started = Date.now();
    let outTimer;
    let doneTimer;

    const finish = () => {
      const waited = Date.now() - started;
      const hold = Math.max(0, MIN_MS - waited);
      outTimer = setTimeout(() => {
        setLeaving(true);
        doneTimer = setTimeout(() => setGone(true), 900);
      }, hold);
    };

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });

    const bail = setTimeout(finish, MAX_MS);

    // The page underneath should not scroll while the screen is up.
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("load", finish);
      clearTimeout(bail);
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (gone) document.body.style.overflow = "";
  }, [gone]);

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
