/** Load seed/companies.csv into Supabase. Idempotent — re-run after editing the CSV. */
import { readFileSync } from 'node:fs'
import { parseCsv } from './csv'
import { db } from './db'

const num = (v: string) => (v === '' || v === undefined ? null : Number(v))
const str = (v: string) => (v === '' || v === undefined ? null : v)

const rows = parseCsv(readFileSync('seed/companies.csv', 'utf8')).map((r) => ({
  name: r.name,
  slug: r.slug,
  website: str(r.website),
  careers_url: r.careers_url,
  ats: str(r.ats),
  ats_slug: str(r.ats_slug),
  area: str(r.area),
  lat: num(r.lat),
  lng: num(r.lng),
  industry: str(r.industry),
  stage: str(r.stage),
  headcount_band: str(r.headcount_band),
}))

const { error } = await db.from('companies').upsert(rows, { onConflict: 'slug' })
if (error) throw error
console.log(`Seeded ${rows.length} companies (${rows.filter((r) => r.ats).length} with a live feed).`)
