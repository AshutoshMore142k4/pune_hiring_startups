import type { APIRoute } from 'astro'
import { loadAll, stats } from '../../data/load'
import { jobSlug, url as u } from '../../data/slugs'

/**
 * The whole dataset in one request. Referenced from llms.txt so an AI crawler takes this
 * instead of walking ~125 HTML pages.
 */
export const GET: APIRoute = async ({ site }) => {
  const companies = await loadAll()
  const s = await stats()
  const abs = (p: string) => new URL(p, site).href

  const body = {
    name: 'Punehire',
    description: 'Open roles at startups in Pune, India, read from public company ATS feeds.',
    homepage: abs('/'),
    licence: 'Listings belong to their employers. Attribution appreciated.',
    generated_at: new Date().toISOString(),
    last_crawled_at: s.updated,
    counts: { companies: s.companies, hiring: s.hiring, open_roles: s.jobs },
    companies: companies.map((c) => ({
      name: c.name,
      slug: c.slug,
      url: abs(u.company(c.slug)),
      website: c.website,
      careers_url: c.careers_url,
      area: c.area,
      city: 'Pune',
      region: 'Maharashtra',
      country: 'IN',
      lat: c.lat,
      lng: c.lng,
      industry: c.industry,
      stage: c.stage,
      headcount_band: c.headcount_band,
      feed: c.ats,
      last_crawled_at: c.last_crawled_at,
      open_roles: c.jobs.map((j) => ({
        title: j.title,
        url: abs(u.job(jobSlug(c.slug, j.title, j.ats_job_id))),
        apply_url: j.apply_url,
        location: j.location_raw,
        remote_type: j.remote_type,
        employment_type: j.employment_type,
        experience_min: j.experience_min,
        experience_max: j.experience_max,
        first_seen: j.first_seen,
        last_seen: j.last_seen,
        description: j.description,
      })),
    })),
  }

  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
