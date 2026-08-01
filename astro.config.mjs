import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = process.env.SITE_URL ?? 'https://app.dean-da-dev.co.uk';

export default defineConfig({
  site: SITE_URL,
  output: 'server',
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !/^\/(dashboard|admin|login|offline)(\/|$)/.test(path);
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
  },
});
