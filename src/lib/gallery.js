/* ===========================================================================
   Runs once, at build time. You should not need to touch this.

   For every image in src/photos/ it produces:
     - a responsive set of thumbnails for the grid
     - one large version for the lightbox
     - a tiny blurred placeholder, inlined as text, so nothing pops in
     - the real dimensions, so the grid never jumps while loading
   =========================================================================== */

import { getImage } from "astro:assets";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  photos as described,
  sections as sectionList,
  hero as heroConfig,
  site,
} from "../data/photos.js";

const sources = import.meta.glob(
  "../photos/*.{jpg,jpeg,png,webp,avif,tif,tiff,JPG,JPEG,PNG,WEBP,AVIF}",
  { eager: true }
);

// The build runs from the project root. Resolving from import.meta.url is
// unreliable here because this module gets bundled to a temporary location.
const PHOTO_DIR = (() => {
  const candidates = [
    path.join(process.cwd(), "src", "photos"),
    (() => {
      try {
        return fileURLToPath(new URL("../photos/", import.meta.url));
      } catch {
        return null;
      }
    })(),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
})();

function slugify(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleize(name) {
  const bare = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

// A 20px-wide blurred version, inlined as a data URL. This is what you see
// while the real photograph downloads.
async function placeholder(filename) {
  try {
    const buf = await sharp(path.join(PHOTO_DIR, filename))
      .resize(20, null, { fit: "inside" })
      .blur(1.2)
      .webp({ quality: 40 })
      .toBuffer();
    return `data:image/webp;base64,${buf.toString("base64")}`;
  } catch (err) {
    // Don't fail the build over a placeholder, but don't hide it either —
    // a silent failure here means photos pop in instead of fading.
    console.warn(
      `[aperture] Could not make a blur placeholder for ${filename}: ${err.message}`
    );
    return "";
  }
}

let cache = null;

export async function loadGallery() {
  if (cache) return cache;

  const entries = await Promise.all(
    Object.entries(sources).map(async ([key, mod]) => {
      const filename = key.split("/").pop();
      const image = mod.default ?? mod;
      const info = described[filename] ?? {};

      const [thumb, full, lqip] = await Promise.all([
        getImage({
          src: image,
          widths: [400, 700, 1000],
          sizes: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
          format: "webp",
          quality: 78,
        }),
        getImage({
          src: image,
          width: Math.min(image.width, 2400),
          format: "webp",
          quality: 82,
        }),
        placeholder(filename),
      ]);

      return {
        filename,
        slug: slugify(filename),
        title: info.title || titleize(filename),
        caption: info.caption || "",
        width: image.width,
        height: image.height,
        lqip,
        thumb: {
          src: thumb.src,
          srcset: thumb.srcSet?.attribute || "",
          sizes: thumb.attributes?.sizes || "",
        },
        full: {
          src: full.src,
          width: full.attributes?.width || image.width,
          height: full.attributes?.height || image.height,
        },
      };
    })
  );

  entries.sort((a, b) => a.filename.localeCompare(b.filename));

  const byName = new Map(entries.map((e) => [e.filename, e]));

  // Sections keep the order you wrote them in. A filename that doesn't match
  // a real file is skipped rather than breaking the build.
  const missing = [];
  const built = sectionList.map((s) => {
    const picked = (s.photos || [])
      .map((name) => {
        const hit = byName.get(name);
        if (!hit) missing.push(`${name} (in "${s.title}")`);
        return hit;
      })
      .filter(Boolean);
    return { ...s, photos: picked };
  });

  if (missing.length) {
    console.warn(
      `[aperture] These filenames are listed in a section but aren't in src/photos/:\n  ${missing.join(
        "\n  "
      )}`
    );
  }

  // Anything not placed in a section still gets shown, at the bottom.
  const placed = new Set(built.flatMap((s) => s.photos.map((p) => p.filename)));
  const leftover = entries.filter((e) => !placed.has(e.filename));

  const live = built.filter((s) => s.photos.length > 0);
  if (leftover.length) {
    live.push({
      id: "more",
      title: heroConfig.overflowTitle || "",
      subtitle: "",
      photos: leftover,
    });
  }

  const pool =
    heroConfig.photos?.length > 0
      ? heroConfig.photos.map((n) => byName.get(n)).filter(Boolean)
      : entries;

  cache = {
    photos: entries,
    sections: live,
    hero: { ...heroConfig, pool },
    site,
  };
  return cache;
}
