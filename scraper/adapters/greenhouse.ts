import { fetchJson } from '../http'
import type { RawJob } from '../../lib/types'
import { stripHtml } from '../normalize'

type GhJob = {
  id: number
  title: string
  location?: { name?: string }
  content?: string
  absolute_url: string
  first_published?: string
  updated_at?: string
}

// content=true: Google requires a real description on JobPosting, and it is what keeps
// the generated job pages from being thin.
export async function greenhouse(slug: string): Promise<RawJob[]> {
  const { jobs } = await fetchJson<{ jobs: GhJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  )
  return (jobs ?? []).map((j) => ({
    ats_job_id: String(j.id),
    title: j.title,
    location_raw: j.location?.name ?? null,
    apply_url: j.absolute_url,
    posted_at: j.first_published ?? j.updated_at ?? null,
    employment_type: null,
    description: stripHtml(j.content),
  }))
}
