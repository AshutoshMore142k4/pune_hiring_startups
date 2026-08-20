import { defineConfig } from 'astro/config'

// Override at build time once a real domain is attached in Cloudflare Pages.
const site = process.env.SITE_URL ?? 'https://punehire.pages.dev'

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  // No @astrojs/sitemap: its serialize() hook is synchronous, so per-URL lastmod from
  // last_seen would need a global. src/pages/sitemap.xml.ts writes it directly instead —
  // fewer moving parts and exact control over what each URL reports.
  build: { inlineStylesheets: 'always' },
})
