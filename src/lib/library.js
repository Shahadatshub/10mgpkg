import { supabase, BUCKET, publicUrl } from "./supabase.js";
import { prepare, slugify, titleFrom, storageKey } from "./imaging.js";

/* ===========================================================================
   Every write the dashboard makes. Kept apart from the interface so the
   component is about buttons and the rules live here.
   =========================================================================== */

export { publicUrl };

/* ----- session ----- */

export async function currentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function onAuthChange(fn) {
  const { data } = supabase.auth.onAuthStateChange((_e, session) => fn(session));
  return () => data.subscription.unsubscribe();
}

/* ----- reading ----- */

export async function fetchLibrary() {
  const [albums, photos] = await Promise.all([
    supabase
      .from("albums")
      .select("*")
      .order("position", { ascending: true }),
    supabase
      .from("photos")
      .select("*")
      .order("position", { ascending: true }),
  ]);
  if (albums.error) throw new Error(albums.error.message);
  if (photos.error) throw new Error(photos.error.message);
  return { albums: albums.data || [], photos: photos.data || [] };
}

/* ----- albums ----- */

/**
 * A slug nothing else is using.
 *
 * After the first miss it jumps straight to a random suffix rather than
 * counting upwards — filenames in Japanese all reduce to the same fallback
 * stem, and walking "-2, -3, -4…" would mean a database round trip per
 * photograph in a batch.
 */
async function uniqueSlug(table, base) {
  const stem = base || "item";
  const taken = async (probe) => {
    const { data } = await supabase
      .from(table)
      .select("id")
      .eq("slug", probe)
      .maybeSingle();
    return Boolean(data);
  };

  if (!(await taken(stem))) return stem;

  for (let n = 0; n < 5; n++) {
    const probe = `${stem}-${Math.random().toString(36).slice(2, 7)}`;
    if (!(await taken(probe))) return probe;
  }
  return `${stem}-${Date.now().toString(36)}`;
}

export async function createAlbum(title, position) {
  const slug = await uniqueSlug("albums", slugify(title || "album"));
  const { data, error } = await supabase
    .from("albums")
    .insert({ title: title || "Untitled album", slug, position })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAlbum(id, patch) {
  const { error } = await supabase.from("albums").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Photographs are never destroyed with their album — they fall to Unfiled. */
export async function deleteAlbum(id) {
  const { error } = await supabase.from("albums").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reorderAlbums(ids) {
  const { error } = await supabase.rpc("reorder_albums", { ids });
  if (error) throw new Error(error.message);
}

/* ----- photos ----- */

export async function updatePhoto(id, patch) {
  const { error } = await supabase.from("photos").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reorderPhotos(ids) {
  const { error } = await supabase.rpc("reorder_photos", { ids });
  if (error) throw new Error(error.message);
}

export async function movePhoto(id, albumId, position) {
  await updatePhoto(id, { album_id: albumId, position });
}

/** Removes the row and both renditions from storage. */
export async function deletePhoto(row) {
  const paths = [row.full_path, row.thumb_path].filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from("photos").delete().eq("id", row.id);
  if (error) throw new Error(error.message);
}

/* ----- upload ----- */

/**
 * Processes and uploads one file, then records it.
 * `onStage` reports progress so the interface can show where it has got to.
 */
export async function uploadOne(file, { albumId, caption, position, onStage }) {
  onStage?.("resizing");
  const made = await prepare(file);

  const base = slugify(made.originalName);
  const fullKey = storageKey(base, "full", made.ext);
  const thumbKey = storageKey(base, "thumb", made.ext);

  onStage?.("uploading");
  const up = async (key, blob) => {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(key, blob, { contentType: made.mime, cacheControl: "31536000" });
    if (error) throw new Error(error.message);
  };
  await up(fullKey, made.full);
  await up(thumbKey, made.thumb);

  onStage?.("saving");
  const slug = await uniqueSlug("photos", base);
  const { data, error } = await supabase
    .from("photos")
    .insert({
      album_id: albumId || null,
      slug,
      title: titleFrom(made.originalName),
      caption: caption || "",
      full_path: fullKey,
      thumb_path: thumbKey,
      lqip: made.lqip,
      width: made.width,
      height: made.height,
      position,
    })
    .select()
    .single();

  if (error) {
    // Don't leave orphaned files behind if the row could not be written.
    await supabase.storage.from(BUCKET).remove([fullKey, thumbKey]);
    throw new Error(error.message);
  }

  onStage?.("done");
  return data;
}

/* ----- settings ----- */

export async function fetchSettings() {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || {};
}

export async function updateSettings(patch) {
  const { error } = await supabase.from("settings").update(patch).eq("id", 1);
  if (error) throw new Error(error.message);
}
