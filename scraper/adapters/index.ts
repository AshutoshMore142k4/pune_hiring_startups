import type { Ats, RawJob } from '../../lib/types'
import { greenhouse } from './greenhouse'
import { lever } from './lever'
import { ashby } from './ashby'
import { workday, workdayDetail } from './workday'
import { smartrecruiters, smartrecruitersDetail } from './smartrecruiters'
import { recruitee } from './recruitee'

export const ADAPTERS: Record<Ats, (slug: string) => Promise<RawJob[]>> = {
  greenhouse,
  lever,
  ashby,
  workday,
  smartrecruiters,
  recruitee,
}

/**
 * ATSs whose list endpoint carries no description. One extra request per job, so run.ts
 * calls these ONLY for jobs that already passed the Pune filter.
 */
export const DETAILS: Partial<Record<Ats, (job: RawJob, slug: string) => Promise<string | null>>> = {
  workday: workdayDetail,
  smartrecruiters: smartrecruitersDetail,
}

// Adding a 7th: only once >=3 seeded companies share it. Oracle Recruiting is next in line.
