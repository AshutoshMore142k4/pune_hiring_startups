import { fetchJson } from '../http'
import type { RawJob } from '../../lib/types'
import { stripHtml } from '../normalize'

type SrPosting = {
  id: string
  name: string
  location?: { city?: string; region?: string; country?: string; remote?: boolean }
  releasedDate?: string
  typeOfEmployment?: { label?: string }
}

const PAGE = 100

export async function smartrecruiters(slug: string): Promise<RawJob[]> {
  const out: RawJob[] = []
  for (let offset = 0; offset < 1000; offset += PAGE) {
    const page = await fetchJson<{ content?: SrPosting[]; totalFound?: number }>(
      `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${PAGE}&offset=${offset}`,
    )
    const posts = page.content ?? []
    for (const p of posts) {
      const loc = [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(', ')
      out.push({
        ats_job_id: p.id,
        title: p.name,
        location_raw: p.location?.remote ? `Remote ${loc}`.trim() : loc || null,
        apply_url: `https://jobs.smartrecruiters.com/${slug}/${p.id}`,
        posted_at: p.releasedDate ?? null,
        employment_type: p.typeOfEmployment?.label ?? null,
        description: null,   // detail() below, run only for Pune-matched jobs
      })
    }
    if (posts.length < PAGE || out.length >= (page.totalFound ?? 0)) break
  }
  return out
}

type SrSection = { text?: string }

/** jobAd.sections holds the real copy; the list endpoint carries none of it. */
export async function smartrecruitersDetail(job: RawJob, slug: string): Promise<string | null> {
  const res = await fetchJson<{
    jobAd?: { sections?: Record<string, SrSection> }
  }>(`https://api.smartrecruiters.com/v1/companies/${slug}/postings/${job.ats_job_id}`)
  const s = res.jobAd?.sections ?? {}
  const joined = ['jobDescription', 'qualifications', 'additionalInformation', 'companyDescription']
    .map((k) => s[k]?.text)
    .filter(Boolean)
    .join('\n\n')
  return stripHtml(joined)
}
