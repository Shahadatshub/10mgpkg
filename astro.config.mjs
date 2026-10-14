import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";

// Change `site` to your real domain once you have one. It is used for the
// link previews that appear when someone shares a photograph.
export default defineConfig({
  site: "https://10mgpkg.pages.dev",

  // Pages that read the gallery are rendered on demand, so a change in the
  // dashboard shows up without a rebuild. Everything else stays static.
  output: "static",
  // Photographs are resized in the browser when you upload them, so Astro's
  // own image resizer isn't needed. Its default engine (sharp) can't run on
  // Cloudflare at all, and including it breaks the deploy.
  adapter: cloudflare({ imageService: "passthrough" }),

  integrations: [react()],
  build: { format: "directory" },

  vite: {
    server: {
      allowedHosts: [".trycloudflare.com"],
      watch: {
        // Astro's own cache writes files as it works; without this the dev
        // server reloads the page every time it does.
        ignored: ["**/.astro/**", "**/dist/**", "**/node_modules/.astro/**"],
      },
    },
  },
});
