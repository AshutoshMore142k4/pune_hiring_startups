import type { RawJob } from '../lib/types'

/** A job is closed once it has been missing from this many *successful* crawls. */
export const MISS_LIMIT = 2

const PUNE =
  /\b(pune|pimpri|chinchwad|pcmc|hinjawadi|hinjewadi|kharadi|baner|balewadi|bavdhan|viman\s*nagar|magarpatta|hadapsar|kalyani\s*nagar|koregaon\s*park|wakad|aundh|yerwada|yerawada|shivajinagar|kothrud|warje|katraj|kondhwa|undri|pashan|mundhwa|phursungi|talawade|talegaon|chakan|ranjangaon|wagholi|lohegaon|dhanori|moshi|nigdi|akurdi|bhosari)\b/i

/** Other Indian metros — a "Remote" role that names one of these is not a Pune role. */
const OTHER_INDIAN_METRO =
  /\b(bengaluru|bangalore|mumbai|delhi|gurgaon|gurugram|noida|hyderabad|chennai|kolkata|ahmedabad|jaipur|indore|kochi|coimbatore|chandigarh|bhubaneswar|nagpur|trivandrum|mysore|mysuru)\b/i

const REMOTE = /\b(remote|work\s*from\s*home|wfh|anywhere)\b/i
const HYBRID = /\bhybrid\b/i
// No bare "in" here: it would match "Remote in United States".
const INDIA = /\b(india|bharat|apac)\b/i

/**
 * Pune-relevant? A named Pune locality always counts. A remote role counts only when it
 * carries an India signal and names no other metro — a bare "Remote" is usually US-remote,
 * and a Pune map full of San Francisco listings is worse than a smaller honest one.
 */
export function isPune(location: string | null | undefined): boolean {
  if (!location) return false
  if (PUNE.test(location)) return true
  if (REMOTE.test(location) && INDIA.test(location) && !OTHER_INDIAN_METRO.test(location)) return true
  return false
}

export function remoteType(location: string | null | undefined): 'onsite' | 'hybrid' | 'remote' | null {
  if (!location) return null
  if (HYBRID.test(location)) return 'hybrid'
  if (REMOTE.test(location)) return 'remote'
  return 'onsite'
}

/** Years of experience, inferred from whatever text the ATS gave us (usually just the title). */
export function parseExperience(text: string): { min: number | null; max: number | null } {
  const t = text.toLowerCase()

  const range = t.match(/(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?|yoe)/)
  if (range) return { min: Number(range[1]), max: Number(range[2]) }

  const atLeast = t.match(/(\d{1,2})\s*\+\s*(?:years?|yrs?|yoe)/)
  if (atLeast) return { min: Number(atLeast[1]), max: null }

  const exact = t.match(/(\d{1,2})\s*(?:years?|yrs?|yoe)/)
  if (exact) return { min: Number(exact[1]), max: Number(exact[1]) }

  if (/\b(intern|internship)\b/.test(t)) return { min: 0, max: 0 }
  if (/\b(fresher|entry[\s-]?level|graduate|new\s*grad|campus|trainee|apprentice)\b/.test(t))
    return { min: 0, max: 1 }
  if (/\b(junior|jr\.?|associate|sde\s*-?\s*(i|1)|engineer\s*(i|1))\b/.test(t)) return { min: 0, max: 2 }
  if (/\b(sde\s*-?\s*(ii|2)|engineer\s*(ii|2)|ii)\b/.test(t)) return { min: 2, max: 4 }
  if (/\b(senior|sr\.?|lead|staff|principal|architect|head\s+of|director|vp|manager)\b/.test(t))
    return { min: 5, max: null }

  return { min: null, max: null }
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', bull: '•',
}

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (_, n) => ENTITIES[n.toLowerCase()] ?? `&${n};`)

/** Descriptions are stored as PLAIN TEXT, never HTML — nothing downstream can then inject markup. */
const MAX_DESCRIPTION = 8000

/**
 * ATS description HTML -> plain text.
 *
 * Greenhouse double-encodes (`&lt;p&gt;` for `<p>`), so this decodes, strips, then decodes
 * again for entities that were inside the text itself.
 */
export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const text = decode(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return (
    decode(text)
      .replace(/\r/g, '')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, MAX_DESCRIPTION) || null
  )
}

export function employmentType(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.toLowerCase().replace(/[\s-]+/g, '_')
  if (t.includes('full')) return 'full_time'
  if (t.includes('part')) return 'part_time'
  if (t.includes('intern')) return 'internship'
  if (t.includes('contract') || t.includes('temp')) return 'contract'
  return t
}

/** Adapter output -> a row ready for the jobs table. first_seen is left to the DB default. */
export function normalize(raw: RawJob, companyId: number) {
  const exp = parseExperience(`${raw.title} ${raw.location_raw ?? ''}`)
  return {
    company_id: companyId,
    ats_job_id: raw.ats_job_id,
    title: raw.title.trim(),
    location_raw: raw.location_raw,
    is_pune: isPune(raw.location_raw),
    remote_type: remoteType(raw.location_raw),
    employment_type: employmentType(raw.employment_type ?? raw.title),
    experience_min: exp.min,
    experience_max: exp.max,
    apply_url: raw.apply_url,
    posted_at: raw.posted_at,
    description: raw.description,
    last_seen: new Date().toISOString(),
    miss_count: 0,
    is_open: true,
  }
}

export type Sighting = { id: number; ats_job_id: string; miss_count: number }

/**
 * Which of a company's open jobs just went missing.
 *
 * THE GUARD: when the fetch failed we return nothing. Without this, one network blip or
 * ATS 500 marks every job in the database as closed. That is the single most likely way
 * to corrupt the dataset, so it lives in a pure function with a test on it.
 */
export function computeMisses(existing: Sighting[], seenIds: Set<string>, fetchOk: boolean) {
  if (!fetchOk) return []
  return existing
    .filter((j) => !seenIds.has(j.ats_job_id))
    .map((j) => {
      const miss_count = j.miss_count + 1
      return { id: j.id, miss_count, is_open: miss_count < MISS_LIMIT }
    })
}
