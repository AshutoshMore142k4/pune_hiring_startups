import type { APIRoute } from 'astro'
import { areas, loadEvery, everyJob, stats } from '../data/load'
import { jobSlug, url as u, slugify } from '../data/slugs'
import { GUIDES, guideUrl } from '../data/guides'
import { FUNCTIONS } from '@/lib/filters'

/**
 * Hand-rolled rather than @astrojs/sitemap: its serialize() hook is synchronous, so per-URL
 * lastmod taken from each job's last_seen would need a global. lastmod is the whole point —
 * it is what tells a crawler which of ~125 URLs actually moved since the last visit.
 */

type Entry = { path: string; lastmod?: string | null; changefreq: string; priority: string }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const day = (iso?: string | null) => (iso ? new Date(iso).toISOString() : undefined)

export const GET: APIRoute = async ({ site }) => {
  // loadEvery / everyJob: the sitemap covers both startups and enterprises so every generated
  // company and job page is listed. The startup-only aggregate pages are added explicitly below.
  const companies = await loadEvery()
  const jobs = await everyJob()
  const grouped = await areas()
  const s = await stats()

  const entries: Entry[] = [
    { path: '/', lastmod: s.updated, changefreq: 'hourly', priority: '1.0' },
    { path: u.jobs(), lastmod: s.updated, changefreq: 'hourly', priority: '0.9' },
    { path: u.companies(), lastmod: s.updated, changefreq: 'daily', priority: '0.8' },
    { path: '/areas/', lastmod: s.updated, changefreq: 'daily', priority: '0.7' },
    { path: '/roles/', lastmod: s.updated, changefreq: 'daily', priority: '0.7' },
    { path: '/fresher-jobs-in-pune/', lastmod: s.updated, changefreq: 'daily', priority: '0.8' },
    { path: '/internships-in-pune/', lastmod: s.updated, changefreq: 'daily', priority: '0.8' },
    { path: u.enterprises(), lastmod: s.updated, changefreq: 'daily', priority: '0.7' },
    { path: u.about(), changefreq: 'monthly', priority: '0.3' },
    { path: '/guides/', lastmod: s.updated, changefreq: 'weekly', priority: '0.5' },
    { path: '/privacy/', changefreq: 'monthly', priority: '0.2' },
    { path: '/terms/', changefreq: 'monthly', priority: '0.2' },
    { path: '/disclaimer/', changefreq: 'monthly', priority: '0.2' },
    { path: '/contact/', changefreq: 'monthly', priority: '0.2' },

    // Guides recompute their live figures on every build, so lastmod tracks the last crawl.
    ...GUIDES.map((g) => ({
      path: guideUrl(g.slug),
      lastmod: s.updated,
      changefreq: 'weekly',
      priority: '0.5',
    })),

    ...companies.map((c) => ({
      path: u.company(c.slug),
      lastmod: c.last_crawled_at,
      changefreq: 'daily',
      priority: '0.7',
    })),

    // The ones that actually change: lastmod is this job's own last_seen.
    ...jobs.map((j) => ({
      path: u.job(jobSlug(j.company.slug, j.title, j.ats_job_id)),
      lastmod: j.last_seen,
      changefreq: 'daily',
      priority: '0.9',
    })),

    ...grouped.map((a) => ({
      path: u.area(a.name),
      lastmod: s.updated,
      changefreq: 'daily',
      priority: '0.6',
    })),

    ...Object.keys(FUNCTIONS).map((tag) => ({
      path: `/roles/${slugify(tag)}/`,
      lastmod: s.updated,
      changefreq: 'daily',
      priority: '0.6',
    })),
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => {
    const loc = esc(new URL(e.path, site).href)
    const lastmod = day(e.lastmod)
    return `  <url>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  })
  .join('\n')}
</urlset>
`

  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}
