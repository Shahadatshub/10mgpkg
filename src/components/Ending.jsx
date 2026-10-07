import React from "react";

/* ---------------------------------------------------------------------------
   A destination for the scroll. Without this the page simply stops; with it,
   the sequence closes on the wordmark it opened with.
   --------------------------------------------------------------------------- */

export default function Ending({ site = {} }) {
  const links = site.links || {};
  const year = new Date().getFullYear();

  const toTop = (e) => {
    e.preventDefault();
    const lenis = typeof window !== "undefined" ? window.__lenis : null;
    if (lenis) lenis.scrollTo(0, { duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="ending">
      <div className="ending__inner">
        <p className="ending__mark display">{site.title || "10MGPKG"}</p>

        <div className="ending__links">
          {links.instagram && (
            <a
              className="label ending__link"
              href={links.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>
          )}
          {links.shop && (
            <a
              className="label ending__link"
              href={links.shop}
              target="_blank"
              rel="noopener noreferrer"
            >
              Shop
            </a>
          )}
          {links.email && (
            <a className="label ending__link" href={`mailto:${links.email}`}>
              Email
            </a>
          )}
        </div>

        <a className="label ending__top" href="#top" onClick={toTop}>
          ↑ Back to top
        </a>

        <p className="label ending__credit">
          © {year} {site.author || ""}
        </p>
      </div>
    </footer>
  );
}
