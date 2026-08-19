import { createClient } from '@supabase/supabase-js'
import type { Company } from '../lib/types'
import type { Sighting } from './normalize'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY

if (!url || !key) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_SERVICE_KEY. Copy .env.example to .env, or run with --dry-run to work off seed/companies.csv without a database.',
  )
}

// service_role bypasses RLS. Scraper only — never ships to the browser.
export const db = createClient(url, key, { auth: { persistSession: false } })

export async function loadCrawlable(only?: string): Promise<Company[]> {
  let q = db.from('companies').select('*').not('ats', 'is', null)
  if (only) q = q.eq('slug', only)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Company[]
}

export async function openJobs(companyId: number): Promise<Sighting[]> {
  const { data, error } = await db
    .from('jobs')
    .select('id, ats_job_id, miss_count')
    .eq('company_id', companyId)
    .eq('is_open', true)
  if (error) throw error
  return (data ?? []) as Sighting[]
}

export async function saveJobs(rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const { error } = await db.from('jobs').upsert(rows, { onConflict: 'company_id,ats_job_id' })
  if (error) throw error
}

/**
 * Partial upsert is impossible here (NOT NULL columns would fail the INSERT arm), so this
 * updates instead — grouped by miss_count, which only ever has two or three distinct
 * values per company. One or two round trips, not one per job.
 */
export async function applyMisses(updates: { id: number; miss_count: number; is_open: boolean }[]) {
  const groups = new Map<string, number[]>()
  for (const u of updates) {
    const k = `${u.miss_count}|${u.is_open}`
    groups.set(k, [...(groups.get(k) ?? []), u.id])
  }
  for (const [k, ids] of groups) {
    const [miss_count, is_open] = k.split('|')
    const { error } = await db
      .from('jobs')
      .update({ miss_count: Number(miss_count), is_open: is_open === 'true' })
      .in('id', ids)
    if (error) throw error
  }
}

export async function stampCrawl(companyId: number, err: string | null) {
  const { error } = await db
    .from('companies')
    .update({ last_crawled_at: new Date().toISOString(), last_crawl_error: err })
    .eq('id', companyId)
  if (error) throw error
}
