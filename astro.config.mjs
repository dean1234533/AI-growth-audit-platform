import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = process.env.SITE_URL ?? 'https://app.dean-da-dev.co.uk';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  outDir: process.env.BUILD_OUTPUT_DIR ?? './dist',
  cacheDir: process.env.ASTRO_CACHE_DIR ?? './node_modules/.astro',
  output: 'server',
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !/^\/(dashboard|admin|login|offline|api)(\/|$)/.test(path) && !path.startsWith('/blog/tag/');
      },
    }),
    mdx(),
  ],
  adapter: cloudflare({
    // This machine's local runtime can't launch workerd (unsupported macOS version),
    // and prerendered pages need no Cloudflare-specific APIs, so build them with Node instead.
    prerenderEnvironment: 'node',
  }),
  vite: {
    plugins: [tailwindcss()],
    cacheDir: process.env.VITE_CACHE_DIR ?? 'node_modules/.vite',
  },
});
