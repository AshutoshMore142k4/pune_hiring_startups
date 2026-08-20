/**
 * FAQ content and FAQPage JSON-LD.
 *
 * Two rules govern everything in here:
 *
 * 1. Every answer must be true of this site as it is actually built. Counts are therefore
 *    derived from the same load.ts calls the pages use, never typed in, so the copy cannot
 *    drift from the data between crawls.
 * 2. The generated area and role sets must differ page to page. The same FAQ block repeated
 *    across a hundred pages is duplicate content and is worth less than no FAQ at all, so
 *    each generated question is either data-derived or keyed to a specific neighbourhood.
 *
 * Note on the schema: Google stopped showing FAQ rich results in Search (the feature was
 * removed from its documentation in June 2025). The markup is still valid schema.org and
 * still read by other consumers, so it is emitted, but the visible answers are the point.
 */

import type { FunctionTag } from '@/lib/filters'
import { areas, byFunction, loadAll, stats } from './load'
import { url } from './slugs'

export type FaqItem = {
  q: string
  /** Plain text. No markup — this string goes into JSON-LD verbatim. */
  a: string
  /** Optional follow-on link, rendered after the answer and left out of the schema. */
  link?: { href: string; text: string }
}

/**
 * FAQPage structured data. `mainEntity` is a list of Question, each with a single
 * acceptedAnswer whose text is plain.
 */
export function faqPageLd(items: FaqItem[], site: URL | string, path = '/') {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: new URL(path, site).href,
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const list = (xs: string[]) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`

/**
 * One factual sentence per neighbourhood, written by hand because the database holds a name
 * and a centroid and nothing that explains a commute. Areas missing from this map simply
 * lose that one question rather than getting a vague filler answer.
 */
const AREA_NOTES: Record<string, string> = {
  hinjawadi:
    'Hinjawadi is the Rajiv Gandhi Infotech Park, roughly 20 km west of Pune station and laid ' +
    'out in three phases, reached from the city through Wakad on the Mumbai-Bangalore highway. ' +
    'Morning traffic into Phase 1 is the single largest commute consideration of any area here.',
  wakad:
    'Wakad sits between the highway and Hinjawadi, which makes it the usual place to live for ' +
    'people working in the Infotech Park and a short hop from Baner.',
  baner:
    'Baner runs along the Mumbai-Bangalore highway between the city and Hinjawadi, next to ' +
    'Balewadi and Pashan. It is closer in than Hinjawadi, which is why mid-sized product ' +
    'companies tend to settle there rather than in the parks.',
  balewadi:
    'Balewadi adjoins Baner on the highway side, around the sports complex, and shares the same ' +
    'commute into the city as Baner does.',
  aundh:
    'Aundh is an older residential suburb between Baner and the university, closer to the city ' +
    'centre than the highway offices and connected to Shivajinagar by University Road.',
  bavdhan:
    'Bavdhan sits on the Paud Road side of the bypass, between Kothrud and the highway at ' +
    'Chandni Chowk, so it draws from the west of the city rather than from Hinjawadi.',
  kharadi:
    'Kharadi is in the east, built around EON IT Park and the World Trade Center off Nagar Road. ' +
    'It leans enterprise and shares the airport corridor with Viman Nagar and Kalyani Nagar.',
  magarpatta:
    'Magarpatta City is a walk-to-work township inside Hadapsar in the south-east, with Amanora ' +
    'and the Hadapsar industrial belt next to it and Kharadi across the river.',
  hadapsar:
    'Hadapsar is the south-eastern corridor along Solapur Road that contains Magarpatta and ' +
    'Amanora, and it is the practical alternative to Kharadi for anyone living south of the river.',
  'viman nagar':
    'Viman Nagar sits beside Pune airport on Nagar Road, between Kalyani Nagar and Kharadi. ' +
    'Offices there are smaller than the Hinjawadi or Kharadi parks and mixed in with residential ' +
    'and retail blocks.',
  'kalyani nagar':
    'Kalyani Nagar is on the north bank of the Mula-Mutha between Koregaon Park and Viman Nagar, ' +
    'joined to Koregaon Park by the Aga Khan bridge.',
  'koregaon park':
    'Koregaon Park is central and residential rather than a tech park, so offices there are ' +
    'small and usually occupy converted buildings rather than campuses.',
  yerwada:
    'Yerwada is across the river from Koregaon Park on the airport road, holding a handful of ' +
    'larger office buildings on an otherwise residential stretch.',
  shivajinagar:
    'Shivajinagar is central Pune, at the railway and bus terminus end of the city near the ' +
    'university and FC Road, which makes it the most public-transport-reachable area on this map.',
  pimpri:
    'Pimpri is part of the Pimpri-Chinchwad industrial twin city to the north-west, along the old ' +
    'Mumbai-Pune highway rather than the newer Hinjawadi corridor.',
  chinchwad:
    'Chinchwad is the other half of the Pimpri-Chinchwad municipal area to the north-west, an ' +
    'older manufacturing belt that now also holds engineering offices.',
  talawade:
    'Talawade is north-west beyond Chinchwad, around the Talawade IT park and the surrounding ' +
    'MIDC industrial land.',
  chakan:
    'Chakan is the automotive manufacturing belt about 30 km north of the city on the ' +
    'Pune-Nashik highway, so the companies there are hardware and vehicle firms rather than ' +
    'software offices.',
  lohegaon:
    'Lohegaon is north-east of the city beside the airport and the air force station, next to ' +
    'Viman Nagar and Dhanori.',
}

/* -------------------------------------------------------------------------------------- */

/**
 * The site-wide set. Used on the home page and the methodology page — the two pages where a
 * reader is asking about the site itself rather than about one slice of the data.
 */
export async function siteFaq(): Promise<FaqItem[]> {
  const companies = await loadAll()
  const s = await stats()
  const byArea = await areas()

  const jobs = companies.flatMap((c) => c.jobs)
  const feeds = companies.filter((c) => c.ats)
  const atsNames = [...new Set(feeds.map((c) => c.ats))].sort()
  const openIn = (a: { companies: { jobs: unknown[] }[] }) =>
    a.companies.reduce((n, c) => n + c.jobs.length, 0)

  const topAreas = [...byArea].sort((a, b) => openIn(b) - openIn(a)).slice(0, 4)
  const topHiring = [...companies]
    .filter((c) => c.jobs.length > 0)
    .sort((a, b) => b.jobs.length - a.jobs.length || a.name.localeCompare(b.name))
    .slice(0, 5)

  const freshers = jobs.filter((j) => j.experience_max !== null && j.experience_max <= 2).length
  const interns = jobs.filter(
    (j) => j.employment_type === 'internship' || j.experience_max === 0,
  ).length
  const remote = jobs.filter((j) => j.remote_type === 'remote').length
  const hybrid = jobs.filter((j) => j.remote_type === 'hybrid').length
  const noFeed = s.companies - feeds.length

  return [
    {
      q: 'Which Pune startups are hiring right now?',
      a:
        `At the last crawl, ${s.hiring} of the ${s.companies} Pune startups tracked here had at ` +
        `least one open role, ${plural(s.jobs, 'role')} in total. ` +
        (topHiring.length
          ? `The largest openings lists belong to ${list(topHiring.map((c) => `${c.name} (${c.jobs.length})`))}. `
          : '') +
        'Those numbers move with every crawl, so the map on the home page is the current answer ' +
        'rather than this sentence.',
      link: { href: url.companies(), text: 'Every tracked startup' },
    },
    {
      q: 'Where in Pune are the startup offices?',
      a:
        (topAreas.length
          ? `The busiest areas on this map today are ${list(topAreas.map((a) => `${a.name} (${plural(openIn(a), 'open role')})`))}. `
          : '') +
        'Broadly: Hinjawadi holds the Rajiv Gandhi Infotech Park and the largest engineering ' +
        'campuses, Baner and Balewadi sit closer to the city on the same highway, Kharadi around ' +
        'EON IT Park leans enterprise, and Magarpatta, Hadapsar and Viman Nagar hold smaller ' +
        'offices in the east. Map pins are neighbourhood centroids, not street addresses, so use ' +
        'them for "which part of town", not "which building".',
      link: { href: '/areas/', text: 'Browse by area' },
    },
    {
      q: 'Do Pune startups hire freshers?',
      a:
        freshers > 0
          ? `Yes, though in smaller numbers than the services companies. ${plural(freshers, 'open role')} ` +
            'currently ask for two years of experience or less. Experience levels are read out of ' +
            'the title and description with pattern matching, so treat that filter as a way to ' +
            'narrow a list rather than a rule about who may apply.'
          : 'Yes, but nothing at that level is open across the tracked companies at the moment. ' +
            'Startup fresher hiring in Pune runs in bursts rather than continuously, and the ' +
            'fresher page fills up again when a crawl finds new roles.',
      link: { href: '/fresher-jobs-in-pune/', text: 'Fresher jobs in Pune' },
    },
    {
      q: 'Are there internships at Pune startups?',
      a:
        `${interns === 0 ? 'None are' : plural(interns, 'role is', 'roles are')} tagged as an ` +
        'internship right now. Startup internships are posted in bursts around college calendars ' +
        'rather than continuously, so a short list usually means nothing is open rather than ' +
        'that nothing was collected. The RSS feed is the reliable way to catch them the day they ' +
        'appear.',
      link: { href: '/internships-in-pune/', text: 'Internships in Pune' },
    },
    {
      q: 'Are any Pune startup jobs remote or hybrid?',
      a:
        `${plural(remote, 'role')} name remote work and ${plural(hybrid, 'names', 'name')} hybrid, ` +
        `out of ${plural(s.jobs, 'open role')}. A remote role only appears here if it names India ` +
        'and does not name another metro, because a bare "Remote" on a job board usually means ' +
        'US-remote. That rule drops some genuinely open roles, which is a trade made deliberately ' +
        'to keep a Pune map about Pune.',
    },
    {
      q: 'What kinds of roles do Pune startups hire for?',
      a:
        'Engineering is almost always the largest group, followed by data and AI, then sales and ' +
        'go-to-market, product and design. The proportion is the interesting part: a company ' +
        'opening its first product or design roles is usually past survival mode, and one posting ' +
        'only sales roles has a product it already believes in. Each role page lists what is open ' +
        'in that function today.',
      link: { href: '/roles/', text: 'Browse by role' },
    },
    {
      q: 'How do I apply for a job listed here?',
      a:
        'Open the role and use the apply link, which goes straight to the employer’s own ' +
        `hiring system — ${atsNames.length ? list(atsNames as string[]) : 'the ATS'} pages, ` +
        'depending on the company. The application is submitted there, on the company’s ' +
        'form, and nothing about it passes through this site. There is no account to create here ' +
        'and no step in between.',
    },
    {
      q: 'Does Punehire take applications, CVs or fees?',
      a:
        'No. It never accepts an application, stores a CV, or charges anybody — not ' +
        'candidates and not employers. There is no login, no profile and no way to apply through ' +
        'this site, which is deliberate: an aggregator that sits between you and the employer has ' +
        'an incentive to hide things, and this one has nothing to hide behind.',
    },
    {
      q: 'How often are the listings updated?',
      a:
        'Every company feed is re-read every six hours and the site is rebuilt from the result. ' +
        'Each role shows when it was last confirmed still open, and roles that have left a ' +
        'company’s feed are not carried over into the next build. In practice a new posting ' +
        'shows up here within a few hours of the employer publishing it.',
    },
    {
      q: 'Why does a company show a careers link but no open roles?',
      a:
        `Because ${plural(noFeed, 'of the tracked companies publishes', 'of the tracked companies publish')} ` +
        'nothing a machine can read. Only ' +
        `${feeds.length} of ${s.companies} use a hiring tool with a public feed; the rest run ` +
        'their careers page as ordinary HTML or through a tool with no syndication endpoint. ' +
        'Those companies still appear on the map with a link to their own careers page, because ' +
        'inventing listings for them would make the map look fuller and be worth less.',
      link: { href: url.about(), text: 'How this works' },
    },
    {
      q: 'What is an ATS feed, and why does it matter here?',
      a:
        'An applicant tracking system is the software a company uses to run its hiring, and most ' +
        'of them publish the open roles as a machine-readable feed so the company’s own ' +
        'careers page can render them. That feed is the only source this site reads. It means ' +
        'the listing you see is the employer’s own text, unedited, and that it disappears ' +
        'here when they close it there.',
    },
    {
      q: 'Are these startups or large IT services companies?',
      a:
        'Pune has two job markets that get confused with each other: the services and GCC ' +
        'campuses that hire in hundreds, and the product companies that hire in ones and twos. ' +
        'This list is curated by hand towards the second, which is why it is short. Some of the ' +
        'companies here are large and long past the startup stage, but they are product ' +
        'organisations rather than staffing businesses.',
    },
    {
      q: 'How do I know a listing here is still open?',
      a:
        'Every role shows when it was last seen in the employer’s feed, which is at most six ' +
        'hours before the last build. When a role leaves the feed, its page here is removed ' +
        'rather than left up, so an expired posting does not linger. The apply link is still the ' +
        'final word — if it 404s, the employer pulled the role between crawls.',
    },
    {
      q: 'Can a company be added, corrected or removed from this list?',
      a:
        'Yes. The company list is the one part of this site a human maintains directly, so a ' +
        'company in the wrong area, missing entirely, or listed when it should not be is a data ' +
        'problem worth fixing. Job listings themselves are not editable here — they are ' +
        'whatever the employer’s feed says, and a wrong title has to be fixed at the source.',
      link: { href: url.about(), text: 'Methodology and corrections' },
    },
  ]
}

/* -------------------------------------------------------------------------------------- */

/**
 * Per-area set. Every question is either derived from that area’s own rows or keyed to the
 * neighbourhood note, so two area pages never carry the same answer.
 */
export async function areaFaq(area: string): Promise<FaqItem[]> {
  const group = (await areas()).find((a) => a.name === area)
  if (!group) return []

  const companies = group.companies
  const jobs = companies.flatMap((c) => c.jobs)
  const hiring = companies.filter((c) => c.jobs.length > 0)
  const noFeed = companies.filter((c) => !c.ats).length
  const industries = [...new Set(companies.map((c) => c.industry).filter(Boolean) as string[])]
  const freshers = jobs.filter((j) => j.experience_max !== null && j.experience_max <= 2).length
  const note = AREA_NOTES[area.toLowerCase()]

  const items: FaqItem[] = [
    {
      q: `Which startups are hiring in ${area}, Pune?`,
      a: hiring.length
        ? `${list(hiring.slice(0, 6).map((c) => `${c.name} (${plural(c.jobs.length, 'role')})`))}` +
          `${hiring.length > 6 ? ` and ${hiring.length - 6} more` : ''} ` +
          `${hiring.length === 1 ? 'is' : 'are'} hiring in ${area} right now, ` +
          `${plural(jobs.length, 'open role')} between them out of ` +
          `${plural(companies.length, 'startup')} tracked in the area.`
        : `None of the ${plural(companies.length, 'startup')} tracked in ${area} has an open role ` +
          'in its feed today. That is a real answer rather than a gap: their careers pages are ' +
          'linked from each company page, and this list refills as soon as a crawl finds ' +
          'something.',
    },
  ]

  if (note) {
    items.push({
      q: `Where is ${area} and what is the commute like?`,
      a: `${note} Pins on the map are neighbourhood centroids rather than street addresses, so check the employer’s own posting for the exact office.`,
    })
  }

  if (industries.length) {
    items.push({
      q: `What kind of startups are based in ${area}?`,
      a:
        `The ${plural(companies.length, 'company', 'companies')} tracked in ${area} work in ` +
        `${list(industries.slice(0, 6))}${industries.length > 6 ? ' among others' : ''}. ` +
        'That mix is what the area happens to hold, not a category this site assigns — ' +
        'industry comes from the curated company list, and the roles come from each ' +
        'company’s own feed.',
    })
  }

  items.push({
    q: `Are there fresher or entry-level roles in ${area}?`,
    a:
      freshers > 0
        ? `${plural(freshers, 'of the open role in', 'of the open roles in')} ${area} ` +
          `${freshers === 1 ? 'asks' : 'ask'} for two years of experience or less. Experience is ` +
          'inferred from the title and description, so read the posting itself before ruling ' +
          'yourself out.'
        : `Nothing in ${area} is currently posted at two years of experience or less. The ` +
          'city-wide fresher list is the better place to look, since early-career openings ' +
          'cluster wherever a team happens to be growing rather than in one neighbourhood.',
    link: { href: '/fresher-jobs-in-pune/', text: 'Fresher jobs across Pune' },
  })

  if (noFeed > 0) {
    items.push({
      q: `Why do some ${area} companies show no roles at all?`,
      a:
        `${plural(noFeed, 'company', 'companies')} in ${area} ` +
        `${noFeed === 1 ? 'runs a hiring tool that publishes' : 'run hiring tools that publish'} ` +
        'no machine-readable feed, so this site can link to their careers page but cannot list ' +
        'what is on it. They may well be hiring. Checking their own careers link is the only ' +
        'way to know.',
    })
  }

  return items
}

/* -------------------------------------------------------------------------------------- */

/**
 * Per-function set. The matching heuristic is different for every tag, and so are the
 * companies and sample titles it catches, so these five sets do not overlap.
 */
export async function roleFaq(tag: FunctionTag, label: string): Promise<FaqItem[]> {
  const jobs = await byFunction(tag)
  const lower = label.toLowerCase()
  const companies = [...new Set(jobs.map((j) => j.company.name))]
  const areasWith = [...new Set(jobs.map((j) => j.company.area).filter(Boolean) as string[])]
  const samples = [...new Set(jobs.map((j) => j.title))].slice(0, 3)
  const freshers = jobs.filter((j) => j.experience_max !== null && j.experience_max <= 2).length
  const flexible = jobs.filter(
    (j) => j.remote_type === 'remote' || j.remote_type === 'hybrid',
  ).length

  return [
    {
      q: `Which Pune startups are hiring for ${lower} roles?`,
      a: companies.length
        ? `${plural(jobs.length, `open ${lower} role`)} across ` +
          `${plural(companies.length, 'Pune startup')}: ${list(companies.slice(0, 8))}` +
          `${companies.length > 8 ? ` and ${companies.length - 8} more` : ''}. ` +
          'Every one of those comes from the company’s own job feed and is re-checked ' +
          'every six hours.'
        : `No ${lower} roles are open across the tracked Pune startups today. This page is ` +
          'generated from live feeds rather than kept as a static list, so an empty result means ' +
          'the openings genuinely are not there this morning.',
    },
    {
      q: `What counts as a ${lower} role on this page?`,
      a:
        `Job titles are matched against a pattern for this function — titles are never ` +
        'rewritten, only tagged. A title can match more than one function, so a machine learning ' +
        'engineer shows up under both engineering and data and AI rather than being forced into ' +
        'one. ' +
        (samples.length
          ? `Titles currently matching here include ${list(samples.map((t) => `"${t}"`))}.`
          : 'Anything the pattern misses ends up untagged rather than misfiled.'),
    },
    {
      q: `Are there fresher ${lower} jobs in Pune?`,
      a:
        freshers > 0
          ? `${plural(freshers, `of the open ${lower} role`, `of the open ${lower} roles`)} ` +
            `${freshers === 1 ? 'asks' : 'ask'} for two years of experience or less. Startups in ` +
            'Pune also interview people a year short of what a posting asks for more often than ' +
            'portals suggest, so the number is a filter, not a gate.'
          : `None of the open ${lower} roles currently states two years of experience or less. ` +
            'Roles that name no experience level at all are left out of that count rather than ' +
            'guessed at, so it undercounts rather than overstates.',
      link: { href: '/fresher-jobs-in-pune/', text: 'Fresher jobs in Pune' },
    },
    {
      q: `Are any ${lower} roles remote or hybrid?`,
      a:
        `${flexible === 0 ? 'None of the' : `${flexible} of the`} open ${lower} ` +
        `${jobs.length === 1 ? 'role' : 'roles'} name remote or hybrid work` +
        `${flexible === 0 ? ' — the rest are onsite' : ''}. ` +
        (areasWith.length
          ? `The onsite ones sit in ${list(areasWith.slice(0, 5))}${areasWith.length > 5 ? ' and elsewhere' : ''}, ` +
            'which is worth checking before you apply.'
          : 'Check each posting for the office it is attached to.'),
    },
  ]
}
