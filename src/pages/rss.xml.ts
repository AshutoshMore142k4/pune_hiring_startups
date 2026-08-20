import type { APIRoute } from 'astro'
import { allJobs } from '../data/load'
import { jobSlug, url as u } from '../data/slugs'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const GET: APIRoute = async ({ site }) => {
  // Newest first — this feed exists so crawlers and readers see new roles without a full crawl.
  const jobs = (await allJobs()).slice(0, 60)
  const abs = (p: string) => new URL(p, site).href

  const items = jobs
    .map((j) => {
      const link = abs(u.job(jobSlug(j.company.slug, j.title, j.ats_job_id)))
      const summary = (j.description ?? '').replace(/\s+/g, ' ').slice(0, 400)
      return `    <item>
      <title>${esc(`${j.title} — ${j.company.name}`)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${new Date(j.first_seen).toUTCString()}</pubDate>
      <category>${esc(j.company.area ?? 'Pune')}</category>
      <description>${esc(summary || `${j.title} at ${j.company.name} in ${j.company.area ?? 'Pune'}.`)}</description>
    </item>`
    })
    .join('\n')

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Punehire — new roles at Pune startups</title>
    <link>${abs('/')}</link>
    <atom:link href="${abs('/rss.xml')}" rel="self" type="application/rss+xml" />
    <description>Newly opened roles at Pune startups, refreshed every six hours.</description>
    <language>en-IN</language>
    <lastBuildDate>${new Date(jobs[0]?.last_seen ?? Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`

  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
