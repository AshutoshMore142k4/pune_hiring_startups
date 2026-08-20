/**
 * URL slugs. These are permanent addresses that search engines index, so they must stay
 * stable across builds — everything here derives only from data that does not change.
 */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

/** djb2 -> 6 base36 chars. Short enough for a readable URL, wide enough to not collide. */
export function shortHash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h * 33) ^ input.charCodeAt(i)) >>> 0
  return h.toString(36).padStart(6, '0').slice(-6)
}

/**
 * `/jobs/druva-senior-engineer-a1b2c3/`
 *
 * The hash is over ats_job_id, which is unique per company and stable for the life of the
 * posting. Two roles with the same title at the same company therefore get distinct URLs.
 */
export function jobSlug(companySlug: string, title: string, atsJobId: string): string {
  return `${companySlug}-${slugify(title)}-${shortHash(atsJobId)}`
}

export const areaSlug = slugify

/** Trailing slash everywhere — astro.config sets trailingSlash: 'always'. */
export const url = {
  home: () => '/',
  companies: () => '/companies/',
  company: (slug: string) => `/companies/${slug}/`,
  jobs: () => '/jobs/latest/',
  job: (slug: string) => `/jobs/${slug}/`,
  area: (area: string) => `/areas/${areaSlug(area)}/`,
  role: (tag: string) => `/roles/${slugify(tag)}/`,
  about: () => '/about/',
  enterprises: () => '/pune-it-companies-hiring/',
}
