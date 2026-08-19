import { fetchJson } from '../http'
import type { RawJob } from '../../lib/types'

type AshbyJob = {
  id: string
  title: string
  location?: string
  employmentType?: string
  descriptionPlain?: string
  jobUrl: string
  publishedAt?: string
  isListed?: boolean
}

export async function ashby(slug: string): Promise<RawJob[]> {
  const { jobs } = await fetchJson<{ jobs: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
  )
  return (jobs ?? [])
    .filter((j) => j.isListed !== false)
    .map((j) => ({
      ats_job_id: j.id,
      title: j.title,
      location_raw: j.location ?? null,
      apply_url: j.jobUrl,
      posted_at: j.publishedAt ?? null,
      employment_type: j.employmentType ?? null,
      description: j.descriptionPlain?.trim() || null,
    }))
}
