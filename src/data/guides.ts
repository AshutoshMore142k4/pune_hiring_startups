/**
 * The guides are the only hand-written pages on this site. Everything else is generated from
 * a job feed; these are not. The registry lives here because three places need the same list:
 * the /guides/ index, the cross-links at the foot of every guide, and the sitemap.
 *
 * Adding a guide means adding a row here AND creating src/pages/guides/<slug>.astro. Nothing
 * globs the directory, so a row without a page would emit a 404 into the sitemap.
 */

export type Guide = {
  slug: string
  /** Short label for tiles and cross-links. */
  nav: string
  /** <title>, without the site name — pages append it. */
  title: string
  h1: string
  /** One line. Used as the meta description and as the tile subtitle. */
  blurb: string
  /** The date the prose was written. The figures inside update on every build. */
  published: string
}

export const GUIDES: Guide[] = [
  {
    slug: 'where-pune-startup-jobs-are',
    nav: 'Where the jobs are',
    title: "Where Pune's startup jobs actually are",
    h1: "Where Pune's startup jobs actually are",
    blurb:
      'Hinjawadi, Baner, Kharadi, Magarpatta and the rest — what sits in each area, what the ' +
      'commute costs you, and which areas have the most open roles right now.',
    published: '2026-02-14',
  },
  {
    slug: 'pune-startup-jobs-for-freshers',
    nav: 'Getting hired as a fresher',
    title: 'How to get hired at a Pune startup as a fresher',
    h1: 'Getting hired at a Pune startup as a fresher',
    blurb:
      'What the open entry-level roles actually ask for, why the list is short, and how ' +
      'applying through a company ATS differs from applying on Naukri.',
    published: '2026-02-18',
  },
  {
    slug: 'how-to-read-a-startup-job-posting',
    nav: 'Reading a job posting',
    title: 'How to read a startup job posting',
    h1: 'How to read a startup job posting',
    blurb:
      'Decoding SDE-1 against Engineer II against Staff, what "hybrid" really means in Pune, ' +
      'the red flags worth walking away from, and what the experience ranges here are derived from.',
    published: '2026-02-22',
  },
  {
    slug: 'which-ats-a-company-uses',
    nav: 'ATS, and why it matters',
    title: 'Which ATS a company uses, and why it matters to you',
    h1: 'Which ATS a company uses, and why it matters to you',
    blurb:
      'Greenhouse, Lever, Ashby, Workday, SmartRecruiters and Recruitee produce very different ' +
      'application flows. Which Pune companies use which, and what each one costs you in time.',
    published: '2026-02-26',
  },
]

export const guideUrl = (slug: string) => `/guides/${slug}/`

export const otherGuides = (slug: string) => GUIDES.filter((g) => g.slug !== slug)

/**
 * Article JSON-LD.
 *
 * Google lists no required properties for Article, only recommended ones, so this carries
 * only what can be stated honestly: the site is the author and the publisher, `datePublished`
 * is when the prose was written, and `dateModified` is the build that recomputed the live
 * figures inside the page. No fabricated byline, no image we do not have.
 */
export function articleLd(guide: Guide, site: URL | string, siteName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.blurb,
    datePublished: guide.published,
    dateModified: new Date().toISOString().slice(0, 10),
    author: { '@type': 'Organization', name: siteName, url: new URL('/', site).href },
    publisher: { '@type': 'Organization', name: siteName, url: new URL('/', site).href },
    isAccessibleForFree: true,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': new URL(guideUrl(guide.slug), site).href,
    },
  }
}
