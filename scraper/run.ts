/**
 *   npx tsx scraper/run.ts                       # crawl everything, write to Supabase
 *   npx tsx scraper/run.ts --company druva       # one company
 *   npx tsx scraper/run.ts --dry-run             # print only; reads seed/companies.csv,
 *                                                # needs no database and no credentials
 */
import { readFileSync } from 'node:fs'
import type { Ats, Company } from '../lib/types'
import { ADAPTERS, DETAILS } from './adapters'
import { parseCsv } from './csv'
import { computeMisses, normalize } from './normalize'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const only = argv.includes('--company') ? argv[argv.indexOf('--company') + 1] : undefined
const CONCURRENCY = 8

type Result = { slug: string; found: number; kept: number; error?: string }
const results: Result[] = []

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await fn(items[next++])
    }),
  )
}

function fromSeed(): Company[] {
  return parseCsv(readFileSync('seed/companies.csv', 'utf8'))
    .filter((r) => r.ats && (!only || r.slug === only))
    .map((r, i) => ({ ...r, id: -(i + 1), ats: r.ats as Ats }) as unknown as Company)
}

async function crawl(c: Company, db: typeof import('./db') | null) {
  let raw
  try {
    raw = await ADAPTERS[c.ats as Ats](c.ats_slug!)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    results.push({ slug: c.slug, found: 0, kept: 0, error: message })
    // THE GUARD: a failed fetch records the error and stops. It must never reach the
    // miss pass below, or one bad run closes every job we have.
    await db?.stampCrawl(c.id, message)
    return
  }

  const rows = raw.map((r) => normalize(r, c.id)).filter((r) => r.is_pune)
  results.push({ slug: c.slug, found: raw.length, kept: rows.length })

  // Workday and SmartRecruiters keep descriptions behind a per-job request. Only Pune jobs
  // are stored, so only Pune jobs are worth the extra call — a handful, not hundreds.
  const detail = DETAILS[c.ats as Ats]
  if (detail) {
    for (const row of rows) {
      if (row.description) continue
      try {
        row.description = await detail(raw.find((r) => r.ats_job_id === row.ats_job_id)!, c.ats_slug!)
      } catch {
        // A missing description is not worth failing the crawl over.
      }
    }
  }

  if (!db) {
    for (const r of rows)
      console.log(
        `    ${r.title}  —  ${r.location_raw ?? '?'}  [desc ${r.description?.length ?? 0}c]`,
      )
    return
  }

  await db.saveJobs(rows)
  const misses = computeMisses(await db.openJobs(c.id), new Set(rows.map((r) => r.ats_job_id)), true)
  await db.applyMisses(misses)
  await db.stampCrawl(c.id, null)
}

const db = dryRun ? null : await import('./db')
const companies = db ? await db.loadCrawlable(only) : fromSeed()

if (!companies.length) {
  console.error(only ? `No crawlable company "${only}".` : 'No companies with an ATS. Seed first.')
  process.exit(1)
}

console.log(`Crawling ${companies.length} companies${dryRun ? ' (dry run, nothing written)' : ''}…\n`)
await pool(companies, CONCURRENCY, (c) => crawl(c, db))

results.sort((a, b) => b.kept - a.kept)
for (const r of results) {
  console.log(
    r.error
      ? `  FAIL ${r.slug.padEnd(24)} ${r.error}`
      : `  ok   ${r.slug.padEnd(24)} ${String(r.kept).padStart(3)} Pune / ${r.found} total`,
  )
}
const failed = results.filter((r) => r.error).length
console.log(
  `\n${results.reduce((n, r) => n + r.kept, 0)} Pune jobs across ${results.length - failed} companies` +
    (failed ? `, ${failed} failed (their jobs were left untouched)` : ''),
)
