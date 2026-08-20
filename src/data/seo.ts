import type { Company, Job } from '@/lib/types'
import { url } from './slugs'

export const SITE_NAME = 'Punehire'
export const SITE_TAGLINE = 'Which Pune startups are hiring right now'

const abs = (site: URL | string, path: string) => new URL(path, site).href

/** Google's vocabulary, not ours. */
const EMPLOYMENT: Record<string, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  internship: 'INTERN',
  contract: 'CONTRACTOR',
}

const plusDays = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10)

/**
 * JobPosting, built to Google's rules for third-party aggregators:
 *  - `title` is passed through verbatim; aggregators must not rewrite employer titles.
 *  - `directApply: false` because applying happens on the employer's own ATS.
 *  - pages for closed roles are never generated, so no expired listing keeps its schema.
 */
export function jobPostingLd(job: Job, company: Company, site: URL | string, slug: string) {
  const remote = job.remote_type === 'remote'

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description ?? `${job.title} at ${company.name} in ${company.area ?? 'Pune'}.`,
    identifier: {
      '@type': 'PropertyValue',
      name: company.name,
      value: job.ats_job_id,
    },
    datePosted: (job.posted_at ?? job.first_seen).slice(0, 10),
    validThrough: plusDays(job.last_seen, 30),
    ...(job.employment_type && EMPLOYMENT[job.employment_type]
      ? { employmentType: EMPLOYMENT[job.employment_type] }
      : {}),
    hiringOrganization: {
      '@type': 'Organization',
      name: company.name,
      ...(company.website ? { sameAs: company.website } : {}),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(company.area ? { addressLocality: company.area } : { addressLocality: 'Pune' }),
        addressRegion: 'MH',
        addressCountry: 'IN',
      },
    },
    ...(remote
      ? {
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: { '@type': 'Country', name: 'India' },
        }
      : {}),
    directApply: false,
    url: abs(site, url.job(slug)),
  }
}

export function organizationLd(company: Company, site: URL | string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    ...(company.website ? { url: company.website } : {}),
    ...(company.industry ? { knowsAbout: company.industry } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: company.area ?? 'Pune',
      addressRegion: 'MH',
      addressCountry: 'IN',
    },
    mainEntityOfPage: abs(site, url.company(company.slug)),
  }
}

export function breadcrumbLd(trail: { name: string; href: string }[], site: URL | string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: abs(site, t.href),
    })),
  }
}

export function collectionLd(
  name: string,
  description: string,
  items: { name: string; href: string }[],
  site: URL | string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        url: abs(site, it.href),
      })),
    },
  }
}

export function websiteLd(site: URL | string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_TAGLINE,
    url: abs(site, '/'),
  }
}
