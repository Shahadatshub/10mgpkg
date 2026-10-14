import { supabase, publicUrl } from "./supabase.js";

/* ===========================================================================
   Reads the gallery out of Supabase and hands back exactly the shape the
   site already expects, so Showcase, Exhibition and the photo pages did not
   have to change at all when the data moved out of the repo.
   =========================================================================== */

// Pages are rendered per request, so without this every visitor would cost a
// round trip to the database. Sixty seconds is short enough that a change in
// the dashboard shows up almost immediately.
const TTL_MS = 60 * 1000;
let cache = null;
let cachedAt = 0;

export function clearGalleryCache() {
  cache = null;
  cachedAt = 0;
}

function toPhoto(row) {
  const thumb = publicUrl(row.thumb_path);
  const full = publicUrl(row.full_path);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title || row.slug,
    caption: row.caption || "",
    width: row.width || 4,
    height: row.height || 3,
    lqip: row.lqip || "",
    thumb: {
      src: thumb,
      // Both renditions are offered so a high-density screen can reach for
      // the larger one in the grid instead of showing a soft thumbnail.
      srcset: `${thumb} 900w, ${full} 2200w`,
      sizes: "(max-width: 620px) 92vw, (max-width: 1000px) 46vw, 31vw",
    },
    full: { src: full, width: row.width || 1600, height: row.height || 1200 },
  };
}

export async function loadGallery({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < TTL_MS) return cache;

  const [albumsRes, photosRes, settingsRes] = await Promise.all([
    supabase
      .from("albums")
      .select("id, slug, title, subtitle, position")
      .eq("published", true)
      .order("position", { ascending: true }),
    supabase
      .from("photos")
      .select(
        "id, album_id, slug, title, caption, full_path, thumb_path, lqip, width, height, position, in_hero"
      )
      .eq("published", true)
      .order("position", { ascending: true }),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  for (const res of [albumsRes, photosRes, settingsRes]) {
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  }

  const allPhotos = (photosRes.data || []).map(toPhoto);
  const byId = new Map();
  (photosRes.data || []).forEach((row, i) => byId.set(row.id, allPhotos[i]));

  // Group photographs under their album, keeping the order the dashboard set.
  const grouped = new Map();
  for (const row of photosRes.data || []) {
    if (!row.album_id) continue;
    if (!grouped.has(row.album_id)) grouped.set(row.album_id, []);
    grouped.get(row.album_id).push(byId.get(row.id));
  }

  const sections = (albumsRes.data || [])
    .map((a) => ({
      id: a.slug,
      title: a.title,
      subtitle: a.subtitle || "",
      photos: grouped.get(a.id) || [],
    }))
    .filter((s) => s.photos.length > 0);

  // Anything not filed into an album still shows, at the bottom.
  const loose = (photosRes.data || [])
    .filter((r) => !r.album_id)
    .map((r) => byId.get(r.id));
  if (loose.length) {
    sections.push({ id: "more", title: "", subtitle: "", photos: loose });
  }

  const s = settingsRes.data || {};
  const site = {
    title: s.site_title || "10MGPKG",
    author: s.author || "",
    links: {
      instagram: s.instagram_url || "",
      shop: s.shop_url || "",
      email: s.email || "",
    },
  };

  const ex = s.exhibition && typeof s.exhibition === "object" ? s.exhibition : {};
  const exhibition = ex.poster
    ? { ...ex, poster: ex.poster.startsWith("http") ? ex.poster : publicUrl(ex.poster) }
    : null;

  cache = {
    photos: allPhotos,
    sections,
    hero: {
      title: s.hero_title || "10MGPKG",
      welcome: s.hero_welcome || "",
      // The photographs you ticked for the opening screen; every photograph
      // if you haven't chosen any yet.
      pool: (() => {
        const chosen = (photosRes.data || [])
          .filter((r) => r.in_hero)
          .map((r) => byId.get(r.id));
        return chosen.length ? chosen : allPhotos;
      })(),
    },
    site,
    exhibition,
  };
  cachedAt = Date.now();
  return cache;
}
