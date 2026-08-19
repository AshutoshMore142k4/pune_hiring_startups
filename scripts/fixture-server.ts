/**
 * Serves live adapter output in Supabase's REST shape, so `npm run build` and `npm run dev`
 * work with no database at all:
 *
 *   npm run fixture     # then, in another shell, with .env pointing at localhost:54321
 *
 * It is how the site is verified end to end before a Supabase project exists. Real data,
 * fetched from the same ATS APIs the scraper uses — only the storage layer is faked.
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { ADAPTERS, DETAILS } from '../scraper/adapters'
import { parseCsv } from '../scraper/csv'
import { normalize } from '../scraper/normalize'
import type { Ats } from '../lib/types'

const rows = parseCsv(readFileSync('seed/companies.csv', 'utf8'))
let jobId = 0
const now = new Date().toISOString()

const companies = await Promise.all(
  rows.map(async (r, i) => {
    let jobs: any[] = []
    if (r.ats) {
      try {
        const raw = await ADAPTERS[r.ats as Ats](r.ats_slug)
        const kept = raw.map((x) => normalize(x, i + 1)).filter((j) => j.is_pune)
        const detail = DETAILS[r.ats as Ats]
        if (detail) {
          for (const row of kept) {
            if (row.description) continue
            try {
              row.description = await detail(
                raw.find((x) => x.ats_job_id === row.ats_job_id)!,
                r.ats_slug,
              )
            } catch {}
          }
        }
        jobs = kept.map((j) => ({ ...j, id: ++jobId, first_seen: now }))
      } catch (e) {
        console.error(`  ${r.slug}: ${(e as Error).message}`)
      }
    }
    return {
      ...r,
      id: i + 1,
      lat: r.lat ? Number(r.lat) : null,
      lng: r.lng ? Number(r.lng) : null,
      ats: r.ats || null,
      ats_slug: r.ats_slug || null,
      last_crawled_at: now,
      last_crawl_error: null,
      jobs,
    }
  }),
)

const total = companies.reduce((n, c) => n + c.jobs.length, 0)
const withDesc = companies.flatMap((c) => c.jobs).filter((j) => j.description).length
console.log(`fixture: ${companies.length} companies, ${total} jobs, ${withDesc} with descriptions`)

createServer((req, res) => {
  res.writeHead(200, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
  })
  res.end(JSON.stringify(req.method === 'OPTIONS' ? [] : companies))
}).listen(54321, () => console.log('stub on :54321'))
