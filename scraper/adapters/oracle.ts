import { fetchJson } from '../http'
import type { RawJob } from '../../lib/types'
import { stripHtml } from '../normalize'

/**
 * Oracle Recruiting Cloud (Fusion) candidate-experience API. Public and unauthenticated — it
 * is what the employer's own careers page calls. Same category as the Workday cxs endpoint.
 *
 * ats_slug is "<host>/<siteNumber>", e.g. "acme.fa.oraclecloud.com/CX_1001" — the site number
 * is in the careers URL (.../sites/CX_1001/...). The requisition list only materialises when
 * `expand=requisitionList...` is passed; without it the endpoint returns facet counts only.
 *
 * There is no reliable server-side Pune filter (keyword search fuzzy-matches "Pune" -> "pines",
 * and location facet ids are opaque per tenant), so this pages the whole board and lets
 * run.ts's isPune() filter decide. A giant is ~40 requests of 200; only wire companies that
 * actually post Pune roles, or that is 40 requests every crawl for nothing.
 */
type OracleReq = {
  Id: string
  Title: string
  PrimaryLocation?: string
  PostedDate?: string
}
type OracleList = { items?: { TotalJobsCount?: number; requisitionList?: OracleReq[] }[] }

const PAGE = 200
const HARD_CAP = 12_000 // safety stop; JPMorgan, one of the largest, is ~7.4k

const parse = (slug: string) => {
  const [host, site] = slug.split('/')
  if (!host || !site) throw new Error(`oracle ats_slug must be "<host>/<siteNumber>", got "${slug}"`)
  return { host, site }
}

export async function oracle(slug: string): Promise<RawJob[]> {
  const { host, site } = parse(slug)
  const base = `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`

  const out: RawJob[] = []
  for (let offset = 0; offset < HARD_CAP; offset += PAGE) {
    const page = await fetchJson<OracleList>(
      `${base}?onlyData=true&expand=requisitionList.secondaryLocations` +
        `&finder=findReqs;siteNumber=${site},limit=${PAGE},offset=${offset}`,
    )
    const reqs = page.items?.[0]?.requisitionList ?? []
    for (const r of reqs) {
      out.push({
        ats_job_id: r.Id,
        title: r.Title,
        location_raw: r.PrimaryLocation ?? null,
        apply_url: `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${r.Id}`,
        posted_at: r.PostedDate ?? null,
        employment_type: null,
        description: null, // oracleDetail() below, run only for Pune-matched jobs
      })
    }
    const total = page.items?.[0]?.TotalJobsCount ?? 0
    if (reqs.length < PAGE || out.length >= total) break
  }
  return out
}

/** One extra request per job, so run.ts only calls this for jobs that passed the Pune filter. */
export async function oracleDetail(job: RawJob, slug: string): Promise<string | null> {
  const { host, site } = parse(slug)
  const res = await fetchJson<{
    items?: { ExternalDescriptionStr?: string; ExternalQualificationsStr?: string; ExternalResponsibilitiesStr?: string }[]
  }>(
    `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails` +
      `?expand=all&onlyData=true&finder=ById;Id=%22${encodeURIComponent(job.ats_job_id)}%22,siteNumber=${site}`,
  )
  const d = res.items?.[0]
  if (!d) return null
  // The board splits a posting across three HTML fields; join what is present.
  return stripHtml(
    [d.ExternalDescriptionStr, d.ExternalResponsibilitiesStr, d.ExternalQualificationsStr]
      .filter(Boolean)
      .join('\n\n'),
  )
}
