/* ===========================================================================
   Everything Astro used to do at build time, moved into the browser.

   For each file you pick, this produces:
     · a display rendition, capped at 2200px
     · a thumbnail at 900px — large enough to stay sharp on a retina grid
     · a 20px blurred placeholder, inlined as text so it costs no request
     · the real pixel dimensions, so the layout can reserve space

   Doing it here rather than on a server means the browser uploads a few
   hundred kilobytes instead of a 12MB camera file, which is also why a
   batch of ten finishes in seconds on a normal connection.
   =========================================================================== */

const FULL_EDGE = 2200;
const THUMB_EDGE = 900;
const LQIP_EDGE = 20;

/** Decode a File into something drawable, preferring the fast path. */
async function decode(file) {
  if ("createImageBitmap" in window) {
    try {
      // Honour the camera's rotation flag rather than ignoring it.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error("This file could not be read as an image."));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function sizeOf(src) {
  return {
    w: src.naturalWidth || src.width,
    h: src.naturalHeight || src.height,
  };
}

function draw(src, targetEdge) {
  const { w, h } = sizeOf(src);
  const scale = Math.min(1, targetEdge / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, cw, ch);
  return canvas;
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image."))),
      type,
      quality
    );
  });
}

/** WebP where the browser supports it, JPEG otherwise. */
function pickType() {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const webp = c.toDataURL("image/webp").startsWith("data:image/webp");
  return webp
    ? { mime: "image/webp", ext: "webp" }
    : { mime: "image/jpeg", ext: "jpg" };
}

export function slugify(name) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "photo"
  );
}

export function titleFrom(name) {
  const bare = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/**
 * Prepare one file for upload.
 * Returns the two renditions, the placeholder, and the true dimensions.
 */
export async function prepare(file) {
  const src = await decode(file);
  const { w, h } = sizeOf(src);
  const type = pickType();

  const fullCanvas = draw(src, FULL_EDGE);
  const thumbCanvas = draw(src, THUMB_EDGE);
  const lqipCanvas = draw(src, LQIP_EDGE);

  const [full, thumb, lqipBlob] = await Promise.all([
    toBlob(fullCanvas, type.mime, 0.82),
    toBlob(thumbCanvas, type.mime, 0.76),
    toBlob(lqipCanvas, type.mime, 0.5),
  ]);

  const lqip = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => resolve("");
    fr.readAsDataURL(lqipBlob);
  });

  if (src.close) src.close();

  return {
    width: w,
    height: h,
    ext: type.ext,
    mime: type.mime,
    full,
    thumb,
    lqip,
    originalName: file.name,
  };
}

/** A short, collision-resistant key so re-uploading a name never overwrites. */
export function storageKey(slug, kind, ext) {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${slug}-${stamp}${rand}-${kind}.${ext}`;
}
