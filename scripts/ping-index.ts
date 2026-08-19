/**
 * Push newly changed URLs to search engines instead of waiting to be crawled.
 *
 *   npx tsx scripts/ping-index.ts            # push job URLs seen in the last 7 hours
 *   npx tsx scripts/ping-index.ts --all      # push every open job URL
 *
 * Both channels are optional: with their env vars unset the script says so and exits 0, so
 * the scheduled workflow does not fail for anyone who has not set them up.
 *
 *   GOOGLE_SERVICE_ACCOUNT_JSON  service-account key, added as an owner in Search Console
 *   INDEXNOW_KEY                 any 8-128 hex string, also hosted at /<key>.txt
 *   SITE_URL                     defaults to the Cloudflare Pages subdomain
 */
import { createSign } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { jobSlug, url as u } from '../src/data/slugs'

const SITE = (process.env.SITE_URL ?? 'https://startup-radar.pages.dev').replace(/\/$/, '')
const WINDOW_HOURS = 7 // one crawl interval plus slack
const all = process.argv.includes('--all')

const b64 = (input: string | Buffer) =>
  Buffer.from(input).toString('base64url')

async function changedUrls(): Promise<string[]> {
  const supaUrl = process.env.SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!supaUrl || !supaKey) throw new Error('SUPABASE_URL / SUPABASE key missing')

  const db = createClient(supaUrl, supaKey, { auth: { persistSession: false } })
  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString()

  let q = db
    .from('jobs')
    .select('title, ats_job_id, first_seen, companies(slug)')
    .eq('is_open', true)
  if (!all) q = q.gte('first_seen', since)

  const { data, error } = await q
  if (error) throw new Error(`Supabase read failed: ${error.message}`)

  return (data ?? [])
    .filter((j: any) => j.companies?.slug)
    .map((j: any) => `${SITE}${u.job(jobSlug(j.companies.slug, j.title, j.ats_job_id))}`)
}

/**
 * Google's Indexing API accepts only JobPosting and BroadcastEvent — this site is exactly
 * what it exists for. RS256 is signed here rather than pulling in the googleapis package
 * for one call.
 */
async function google(urls: string[]) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return console.log('· Google Indexing API skipped (GOOGLE_SERVICE_ACCOUNT_JSON unset)')

  const key = JSON.parse(raw) as { client_email: string; private_key: string }
  const now = Math.floor(Date.now() / 1000)
  const claim = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const signature = createSign('RSA-SHA256').update(claim).end().sign(key.private_key, 'base64url')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${claim}.${signature}`,
    }),
  })
  if (!tokenRes.ok) throw new Error(`Google token failed: ${tokenRes.status} ${await tokenRes.text()}`)
  const { access_token } = (await tokenRes.json()) as { access_token: string }

  // Default quota is 200 publishes/day. Well clear at Pune scale; request more if it bites.
  let ok = 0
  for (const url of urls.slice(0, 190)) {
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    })
    if (res.ok) ok++
    else console.warn(`  google ${res.status} for ${url}`)
  }
  console.log(`· Google Indexing API: ${ok}/${Math.min(urls.length, 190)} accepted`)
}

/** One batch call covers Bing and Copilot. Up to 10,000 URLs per request. */
async function indexNow(urls: string[]) {
  const key = process.env.INDEXNOW_KEY
  if (!key) return console.log('· IndexNow skipped (INDEXNOW_KEY unset)')

  const host = new URL(SITE).host
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `${SITE}/${key}.txt`,
      urlList: urls.slice(0, 10_000),
    }),
  })
  console.log(`· IndexNow: HTTP ${res.status} for ${urls.length} URLs`)
}

const urls = await changedUrls()
if (!urls.length) {
  console.log('Nothing new to submit.')
} else {
  console.log(`Submitting ${urls.length} job URL${urls.length === 1 ? '' : 's'}…`)
  await google(urls)
  await indexNow(urls)
}
