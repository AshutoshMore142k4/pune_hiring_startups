import { fetchJson } from '../http'
import type { RawJob } from '../../lib/types'

type LeverPost = {
  id: string
  text: string
  categories?: { location?: string; commitment?: string }
  descriptionPlain?: string
  hostedUrl: string
  createdAt?: number
}

export async function lever(slug: string): Promise<RawJob[]> {
  const posts = await fetchJson<LeverPost[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`)
  return (posts ?? []).map((p) => ({
    ats_job_id: p.id,
    title: p.text,
    location_raw: p.categories?.location ?? null,
    apply_url: p.hostedUrl,
    posted_at: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    employment_type: p.categories?.commitment ?? null,
    description: p.descriptionPlain?.trim() || null,
  }))
}
