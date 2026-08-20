import { createClient } from '@supabase/supabase-js'
import type { Company, Job } from '@/lib/types'
import { FUNCTIONS, jobFunctions, type FunctionTag } from '@/lib/filters'
import { slugify } from './slugs'

export type CompanyWithJobs = Company & { jobs: Job[] }
export type JobWithCompany = Job & { company: Company }

const url = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL
const key = import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

// One fetch for the whole build: every getStaticPaths shares this.
let cache: CompanyWithJobs[] | null = null

/**
 * Every company, startups and enterprises together. Cached — the single Supabase read for
 * the whole build. The kind-filtered views below all derive from this, so the startup
 * surfaces (map, home, areas, roles) can stay startup-only while the enterprise section
 * gets its own, without a second query.
 */
export async function loadEvery(): Promise<CompanyWithJobs[]> {
  if (cache) return cache

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_ANON_KEY are missing. This site renders its content at BUILD time — ' +
        'without a database there is nothing to render. See README > Setup.',
    )
  }

  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await db
    .from('companies')
    .select('*, jobs(*)')
    .eq('jobs.is_open', true)

  if (error) throw new Error(`Supabase read failed: ${error.message}`)

  // A build that emits an empty site would deindex every page. Failing is the safe outcome:
  // Cloudflare Pages keeps serving the last good deployment.
  if (!data?.length) {
    throw new Error('Supabase returned zero companies — refusing to build an empty site.')
  }

  cache = (data as CompanyWithJobs[]).map((c) => ({
    ...c,
    jobs: [...c.jobs].sort((a, b) => (b.first_seen ?? '').localeCompare(a.first_seen ?? '')),
  }))
  return cache
}

/** Startups only — the default view. Every existing consumer (map, home, areas, roles) uses this. */
export async function loadAll(): Promise<CompanyWithJobs[]> {
  return (await loadEvery()).filter((c) => c.kind !== 'enterprise')
}

/** Big employers only — the separate enterprise section. */
export async function loadEnterprises(): Promise<CompanyWithJobs[]> {
  return (await loadEvery()).filter((c) => c.kind === 'enterprise')
}

const jobsOf = (companies: CompanyWithJobs[]): JobWithCompany[] =>
  companies
    .flatMap(({ jobs, ...company }) => jobs.map((j) => ({ ...j, company: company as Company })))
    .sort((a, b) => (b.first_seen ?? '').localeCompare(a.first_seen ?? ''))

/** Startup jobs, newest first. Unchanged behaviour. */
export async function allJobs(): Promise<JobWithCompany[]> {
  return jobsOf(await loadAll())
}

/** Enterprise jobs, newest first. */
export async function enterpriseJobs(): Promise<JobWithCompany[]> {
  return jobsOf(await loadEnterprises())
}

/** Every job across both kinds — for the two per-entity getStaticPaths and the sitemap only. */
export async function everyJob(): Promise<JobWithCompany[]> {
  return jobsOf(await loadEvery())
}

export async function areas(): Promise<{ name: string; companies: CompanyWithJobs[] }[]> {
  const companies = await loadAll()
  const map = new Map<string, CompanyWithJobs[]>()
  for (const c of companies) {
    if (!c.area) continue
    map.set(c.area, [...(map.get(c.area) ?? []), c])
  }
  return [...map]
    .map(([name, list]) => ({
      name,
      companies: list.sort((a, b) => b.jobs.length - a.jobs.length || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function byFunction(tag: FunctionTag): Promise<JobWithCompany[]> {
  return (await allJobs()).filter((j) => jobFunctions(j.title).includes(tag))
}

function statsOf(companies: CompanyWithJobs[]) {
  const jobs = companies.flatMap((c) => c.jobs)
  const crawled = companies.map((c) => c.last_crawled_at).filter(Boolean).sort()
  return {
    companies: companies.length,
    hiring: companies.filter((c) => c.jobs.length > 0).length,
    jobs: jobs.length,
    updated: (crawled.at(-1) as string | undefined) ?? null,
  }
}

/** Startup stats — homepage numbers. Unchanged. */
export async function stats() {
  return statsOf(await loadAll())
}

/** Enterprise-section stats. */
export async function enterpriseStats() {
  return statsOf(await loadEnterprises())
}
