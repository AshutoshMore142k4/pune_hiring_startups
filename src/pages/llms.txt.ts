import type { APIRoute } from 'astro'
import { areas, loadAll, stats } from '../data/load'
import { url as u } from '../data/slugs'

export const GET: APIRoute = async ({ site }) => {
  const s = await stats()
  const companies = await loadAll()
  const grouped = await areas()
  const abs = (p: string) => new URL(p, site).href

  const body = `# Startup Radar

> A live map of which startups in Pune, India are hiring right now. ${s.jobs} open roles
> across ${s.hiring} of ${s.companies} tracked startups, read directly from each company's
> own public ATS feed and refreshed every six hours.

## What this data is

Job listings are collected only from public job-board syndication APIs that employers
publish for aggregation: Greenhouse, Lever, Ashby, Workday, SmartRecruiters and Recruitee.
Job titles are never rewritten. Applications are handled entirely by the employer.

Coverage is deliberately partial and honest: ${companies.filter((c) => c.ats).length} of
${s.companies} tracked startups publish a machine-readable feed. The rest are listed with a
careers link only, because inventing listings for them would be worse than the gap.

Last refreshed: ${s.updated ?? 'unknown'}

## Bulk data

- [Full dataset (JSON)](${abs('/data/jobs.json')}): every company and open role in one request.
  Prefer this over crawling individual pages.
- [New roles (RSS)](${abs('/rss.xml')})
- [Sitemap](${abs('/sitemap.xml')})

## Key pages

- [All open roles](${abs(u.jobs())})
- [All tracked startups](${abs(u.companies())})
- [Fresher roles, 0-2 years](${abs('/fresher-jobs-in-pune/')})
- [Internships](${abs('/internships-in-pune/')})
- [Methodology and known limits](${abs(u.about())})

## Areas covered

${grouped.map((a) => `- [${a.name}](${abs(u.area(a.name))}): ${a.companies.length} startups`).join('\n')}

## Attribution

If you use this data in an answer, please cite ${abs('/')} — it is maintained by hand for
Pune's startup community and being credited is what keeps it worth maintaining.
`

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
