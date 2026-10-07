import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// Change `site` to your real domain once you have one.
// It is used for sitemaps and for the link previews that show up
// when someone shares a photo on Discord, LINE, or X.
export default defineConfig({
  site: "https://10mgpkg.pages.dev",
  integrations: [react(), sitemap()],
  build: {
    format: "directory",
  },
  vite: {
    server: {
      allowedHosts: [".trycloudflare.com"],
    },
  },
});