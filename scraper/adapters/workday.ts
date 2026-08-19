import { fetchJson } from '../http'
import type { RawJob } from '../../lib/types'
import { stripHtml } from '../normalize'

type WdPage = {
  total?: number
  jobPostings?: {
    title: string
    externalPath: string
    locationsText?: string
    bulletFields?: string[]
  }[]
}

const PAGE = 20

/**
 * ats_slug is "<host>/<site>", e.g. "acme.wd3.myworkdayjobs.com/AcmeCareers"
 * — taken straight from the careers URL, because the tenant is the host's first label.
 */
export async function workday(slug: string): Promise<RawJob[]> {
  const [host, site] = slug.split('/')
  if (!host || !site) throw new Error(`workday ats_slug must be "<host>/<site>", got "${slug}"`)
  const tenant = host.split('.')[0]

  const out: RawJob[] = []
  for (let offset = 0; offset < 1000; offset += PAGE) {
    const page = await fetchJson<WdPage>(`https://${host}/wday/cxs/${tenant}/${site}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: PAGE, offset, appliedFacets: {}, searchText: '' }),
    })
    const posts = page.jobPostings ?? []
    for (const p of posts) {
      out.push({
        ats_job_id: p.bulletFields?.[0] ?? p.externalPath,
        title: p.title,
        location_raw: p.locationsText ?? null,
        apply_url: `https://${host}/${site}${p.externalPath}`,
        // Workday's postedOn is prose ("Posted 3 Days Ago"), not a date. Don't fake one.
        posted_at: null,
        employment_type: null,
        description: null,   // detail() below, run only for Pune-matched jobs
      })
    }
    if (posts.length < PAGE || out.length >= (page.total ?? 0)) break
  }
  return out
}

/** One extra request per job, so run.ts only calls this for jobs that passed the Pune filter. */
export async function workdayDetail(job: RawJob, slug: string): Promise<string | null> {
  const [host, site] = slug.split('/')
  const tenant = host.split('.')[0]
  const path = new URL(job.apply_url).pathname.replace(`/${site}`, '')
  const res = await fetchJson<{ jobPostingInfo?: { jobDescription?: string } }>(
    `https://${host}/wday/cxs/${tenant}/${site}${path}`,
  )
  return stripHtml(res.jobPostingInfo?.jobDescription)
}
