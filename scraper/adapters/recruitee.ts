import { fetchJson } from '../http'
import type { RawJob } from '../../lib/types'
import { stripHtml } from '../normalize'

type RtOffer = {
  id: number
  title: string
  location?: string
  city?: string
  country_code?: string
  careers_url?: string
  careers_apply_url?: string
  published_at?: string
  employment_type_code?: string
  description?: string
  status?: string
}

export async function recruitee(slug: string): Promise<RawJob[]> {
  const { offers } = await fetchJson<{ offers: RtOffer[] }>(`https://${slug}.recruitee.com/api/offers/`)
  return (offers ?? [])
    .filter((o) => o.status === undefined || o.status === 'published')
    .map((o) => ({
      ats_job_id: String(o.id),
      title: o.title,
      location_raw: o.location ?? [o.city, o.country_code].filter(Boolean).join(', ') ?? null,
      apply_url: o.careers_url ?? o.careers_apply_url ?? `https://${slug}.recruitee.com/o/${o.id}`,
      posted_at: o.published_at ?? null,
      employment_type: o.employment_type_code ?? null,
      description: stripHtml(o.description),
    }))
}
