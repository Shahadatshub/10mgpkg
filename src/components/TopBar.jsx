import React, { useEffect, useState } from "react";

/* ---------------------------------------------------------------------------
   Fixed menu bar. Transparent over the opening screen so nothing competes with
   the wordmark, then turning solid once an album is on screen behind it.
   --------------------------------------------------------------------------- */

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M4 7.5h16l-1.2 12a1.6 1.6 0 0 1-1.6 1.5H6.8a1.6 1.6 0 0 1-1.6-1.5Z" />
      <path d="M8.6 10V6.6a3.4 3.4 0 0 1 6.8 0V10" strokeLinecap="round" />
    </svg>
  );
}

export default function TopBar({ site = {}, sections = [] }) {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.55);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hands the movement to the smooth scroller when it is running, so a menu
  // click glides the same way a wheel scroll does.
  const jump = (e, id) => {
    e.preventDefault();
    const el = id ? document.getElementById(id) : null;
    const lenis = typeof window !== "undefined" ? window.__lenis : null;

    if (lenis) {
      lenis.scrollTo(el || 0, { offset: -84, duration: 1.3 });
      return;
    }
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({ top: y, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const links = site.links || {};

  return (
    <nav className={`topbar${solid ? " topbar--solid" : ""}`} aria-label="Main">
      <a
        className="topbar__mark display"
        href="#top"
        onClick={(e) => jump(e, null)}
      >
        {site.title || "10MGPKG"}
      </a>

      <div className="topbar__albums">
        {sections
          .filter((s) => s.title)
          .map((s) => (
            <a
              key={s.id}
              className="label topbar__link"
              href={`#${s.id}`}
              onClick={(e) => jump(e, s.id)}
            >
              {s.title}
            </a>
          ))}
      </div>

      <div className="topbar__right">
        {links.shop && (
          <a
            className="label topbar__cta"
            href={links.shop}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ShopIcon />
            Shop
          </a>
        )}
        {links.instagram && (
          <a
            className="label topbar__cta"
            href={links.instagram}
            target="_blank"
            rel="noopener noreferrer"
          >
            <InstagramIcon />
            Instagram
          </a>
        )}
      </div>
    </nav>
  );
}
