/**
 * Which ATS does a careers page sit on, and what is its board slug?
 *
 * The slug is very often NOT the company name, which is why this exists. Run it once per
 * company while seeding; the answer goes into seed/companies.csv and never changes again.
 *
 *   npx tsx scraper/detect.ts https://www.druva.com/company/careers
 *   npx tsx scraper/detect.ts --seed        # fill in every blank row in seed/companies.csv
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { Ats } from '../lib/types'
import { ADAPTERS } from './adapters'
import { parseCsv, toCsv } from './csv'

const SEED = 'seed/companies.csv'

const PATTERNS: [Ats, RegExp][] = [
  ['greenhouse', /(?:job-boards|boards|boards-api)\.greenhouse\.io\/(?:v1\/boards\/|embed\/job_board\?for=)?([a-zA-Z0-9_-]+)/],
  ['lever', /(?:jobs|api)\.lever\.co\/(?:v0\/postings\/)?([a-zA-Z0-9_-]+)/],
  ['ashby', /(?:jobs\.ashbyhq\.com|api\.ashbyhq\.com\/posting-api\/job-board)\/([a-zA-Z0-9_.-]+)/],
  ['smartrecruiters', /(?:jobs|careers|api)\.smartrecruiters\.com\/(?:v1\/companies\/)?([a-zA-Z0-9_-]+)/],
  ['recruitee', /([a-z0-9-]+)\.recruitee\.com/],
  // Workday's slug is "<host>/<site>" because the tenant is the host's first label.
  ['workday', /([a-z0-9-]+\.wd\d+\.myworkdayjobs\.com)\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/],
]

const UA =
  'Mozilla/5.0 (compatible; StartupRadar/0.1; +https://github.com/startup-radar/startup-radar)'

export type Detection = { ats: Ats; slug: string; jobs: number }

/** Board tokens guessable from a company name. Workday is excluded — it needs host+site. */
const GUESSABLE: Ats[] = ['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'recruitee']

async function confirm(ats: Ats, slug: string): Promise<Detection | null> {
  // Only trust a candidate the adapter can actually fetch. A careers page may link to some
  // unrelated company's board, and a guessed slug is a guess until it returns jobs.
  try {
    const jobs = await ADAPTERS[ats](slug)
    return jobs.length ? { ats, slug, jobs: jobs.length } : null
  } catch {
    return null
  }
}

export async function detect(careersUrl: string, ...nameHints: string[]): Promise<Detection | null> {
  let html = ''
  try {
    const res = await fetch(careersUrl, {
      headers: { 'user-agent': UA, accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    })
    if (res.ok) html = await res.text()
  } catch {
    // Page blocked or down — the slug guesses below are the whole point of still trying.
  }

  for (const [ats, re] of PATTERNS) {
    const m = html.match(re)
    if (!m) continue
    const hit = await confirm(ats, ats === 'workday' ? `${m[1]}/${m[2]}` : m[1])
    if (hit) return hit
  }

  // Most careers pages render their board in JS, so the scan above finds nothing on them.
  // Guessing the token from the company name recovers a large share of those.
  const guesses = [...new Set(nameHints.flatMap((h) => {
    const base = h.toLowerCase().replace(/[^a-z0-9]/g, '')
    return [base, `${base}inc`, h.toLowerCase().replace(/[^a-z0-9]+/g, '-')]
  }))].filter(Boolean)

  for (const ats of GUESSABLE) {
    for (const g of guesses) {
      const hit = await confirm(ats, g)
      if (hit) return hit
    }
  }
  return null
}

async function seedMode() {
  const rows = parseCsv(readFileSync(SEED, 'utf8'))
  const headers = Object.keys(rows[0] ?? {})
  let found = 0

  for (const r of rows) {
    if (r.ats || !r.careers_url) continue
    const d = await detect(r.careers_url, r.slug, r.name)
    if (d) {
      r.ats = d.ats
      r.ats_slug = d.slug
      found++
      console.log(`  OK   ${r.slug.padEnd(24)} ${d.ats}/${d.slug}  (${d.jobs} jobs)`)
    } else {
      console.log(`  --   ${r.slug.padEnd(24)} no public feed, link-out only`)
    }
  }

  writeFileSync(SEED, toCsv(rows, headers))
  const total = rows.filter((r) => r.ats).length
  console.log(`\n${found} newly detected. ${total}/${rows.length} companies now have a live feed.`)
}

const arg = process.argv[2]
if (!arg) {
  console.error('usage: tsx scraper/detect.ts <careers-url> [name-hint...] | --seed')
  process.exit(1)
} else if (arg === '--seed') {
  await seedMode()
} else {
  const d = await detect(arg, ...process.argv.slice(3))
  console.log(d ? JSON.stringify(d) : 'no supported ATS found — link-out only')
}
