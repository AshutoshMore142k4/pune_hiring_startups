export const ATS_NAMES = [
  'greenhouse', 'lever', 'ashby', 'workday', 'smartrecruiters', 'recruitee',
] as const

export type Ats = (typeof ATS_NAMES)[number]

export type Company = {
  id: number
  name: string
  slug: string
  website: string | null
  careers_url: string
  ats: Ats | null
  ats_slug: string | null
  area: string | null
  lat: number | null
  lng: number | null
  industry: string | null
  stage: string | null
  headcount_band: string | null
  last_crawled_at: string | null
  last_crawl_error: string | null
}

/** What an adapter returns: only what every ATS actually gives us. */
export type RawJob = {
  ats_job_id: string
  title: string
  location_raw: string | null
  apply_url: string
  posted_at: string | null
  employment_type: string | null
  /** Plain text. Null when the ATS needs a detail call that has not run yet. */
  description: string | null
}

export type Job = {
  id: number
  company_id: number
  ats_job_id: string
  title: string
  location_raw: string | null
  is_pune: boolean
  remote_type: 'onsite' | 'hybrid' | 'remote' | null
  employment_type: string | null
  experience_min: number | null
  experience_max: number | null
  apply_url: string
  posted_at: string | null
  description: string | null
  first_seen: string
  last_seen: string
  miss_count: number
  is_open: boolean
}

export type CompanyWithJobs = Company & { jobs: Job[] }
