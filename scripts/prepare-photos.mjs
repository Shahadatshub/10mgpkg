/* ===========================================================================
   Runs automatically before `npm run dev` and `npm run build`.
   You never need to run it yourself.

   Many exported photos carry black bars baked into the file (an Instagram
   4:5 export of a landscape shot, a thin black frame around a scan). On the
   site those bars show up as empty black boxes inside the cards. This step
   copies src/photos/ into .cache/photos/ and cuts those bars off on the way.

   Your originals in src/photos/ are never touched.

   Only bars that are pure black AND roughly equal on both sides are removed,
   so a night shot that is simply dark along one edge is left alone.
   To switch this off, set `trimBorders: false` in src/data/photos.js.
   =========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src", "photos");
const OUT = path.join(ROOT, ".cache", "photos");
const IMAGE = /\.(jpe?g|png|webp|avif|tiff?)$/i;
const VERSION = "1"; // bump to force every photo to be redone

let trimBorders = true;
try {
  // pathToFileURL keeps this working with Windows drive-letter paths
  const cfg = await import(
    pathToFileURL(path.join(ROOT, "src", "data", "photos.js")).href
  );
  if (cfg.site && cfg.site.trimBorders === false) trimBorders = false;
} catch {
  // A typo in photos.js will be reported by the build itself; trimming
  // just falls back to on.
}

fs.mkdirSync(OUT, { recursive: true });

// Remembers what was done to each file so unchanged photos are skipped.
const MANIFEST = path.join(OUT, ".manifest.json");
let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
} catch {}

const files = fs.existsSync(SRC)
  ? fs.readdirSync(SRC).filter((f) => IMAGE.test(f))
  : [];

// Bars on one axis are only trusted when both sides match closely.
const balanced = (a, b) => Math.max(a, b) <= 2 * Math.min(a, b) + 24;

async function prepare(file) {
  const from = path.join(SRC, file);
  const to = path.join(OUT, file);
  const stat = fs.statSync(from);
  const key = `${VERSION}:${trimBorders}:${stat.size}:${stat.mtimeMs}`;
  if (manifest[file]?.key === key && fs.existsSync(to)) return manifest[file];

  let result = { key, trimmed: false };

  if (trimBorders) {
    try {
      // Bake in the camera's rotation first so the bars are found on the
      // edges the visitor actually sees.
      const upright = await sharp(from).rotate().toBuffer({ resolveWithObject: true });
      const { width: W, height: H, format } = upright.info;
      const { info } = await sharp(upright.data)
        .trim({ background: "#000000", threshold: 18 })
        .toBuffer({ resolveWithObject: true });

      const left = Math.max(0, -(info.trimOffsetLeft || 0));
      const top = Math.max(0, -(info.trimOffsetTop || 0));
      const right = Math.max(0, W - info.width - left);
      const bottom = Math.max(0, H - info.height - top);

      const cutX = (left || right) && balanced(left, right);
      const cutY = (top || bottom) && balanced(top, bottom);

      if (cutX || cutY) {
        const region = {
          left: cutX ? left : 0,
          top: cutY ? top : 0,
          width: W - (cutX ? left + right : 0),
          height: H - (cutY ? top + bottom : 0),
        };
        // Never keep a sliver — if the "bars" were most of the frame,
        // something is wrong and the original is safer.
        if (region.width > W * 0.3 && region.height > H * 0.3) {
          await sharp(upright.data)
            .extract(region)
            .toFormat(format === "png" ? "png" : format === "webp" ? "webp" : "jpeg", {
              quality: 95,
            })
            .toFile(to);
          result = { key, trimmed: true, region };
        }
      }
    } catch (err) {
      console.warn(`[photos] Could not check ${file} for black bars: ${err.message}`);
    }
  }

  if (!result.trimmed) fs.copyFileSync(from, to);
  return result;
}

const next = {};
let trimmedCount = 0;
for (const file of files) {
  next[file] = await prepare(file);
  if (next[file].trimmed) trimmedCount++;
}

// Photos you deleted from src/photos/ disappear from the site too.
for (const stale of fs.readdirSync(OUT)) {
  if (stale === ".manifest.json") continue;
  if (!next[stale]) fs.rmSync(path.join(OUT, stale), { force: true });
}

fs.writeFileSync(MANIFEST, JSON.stringify(next, null, 2));
console.log(
  `[photos] ${files.length} photo(s) ready` +
    (trimBorders ? `, black bars removed from ${trimmedCount}` : ", trimming off")
);
