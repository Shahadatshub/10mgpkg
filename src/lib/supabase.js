import { createClient } from "@supabase/supabase-js";

/* ---------------------------------------------------------------------------
   One client, used by both the public pages and the dashboard.

   The anon key is meant to be public — it is in the browser bundle by design.
   What actually protects your data is the row-level security in schema.sql:
   anyone may read published rows, only a signed-in session may write.
   --------------------------------------------------------------------------- */

const url =
  import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const key =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Supabase is not configured. Create a .env file in the project root with " +
      "PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY, then restart the dev server."
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // Only the dashboard signs in, and only in a browser.
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});

export const BUCKET = "photos";

/** Public URL for a file in the photos bucket. */
export function publicUrl(path) {
  if (!path) return "";
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}
