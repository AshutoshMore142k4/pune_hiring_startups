# Startup Radar

A live map of which Pune startups are hiring right now. Runs on free tiers: static site on
Cloudflare Pages, Supabase Postgres, a GitHub Actions cron every 6 hours. No server.

## How it works

```
GitHub Actions (6h cron) -> 6 ATS adapters (public JSON) -> Supabase
                                   |                            |
                     ping-index.ts (Google/IndexNow)     Astro reads at BUILD time
                                                                |
                                        static HTML -> Cloudflare Pages
```

The build reads Supabase, so every page ships as finished HTML: a crawler with JavaScript
off sees the same content a person does. The only JavaScript on the site is the map and the
filter chips, and both narrow content that is already in the DOM.

Every seeded startup appears on the map. Live job counts appear for the subset that
publishes a machine-readable feed; the rest get a careers link. Adding an ATS adapter
unlocks companies in batches, which is why there are no per-company scrapers here.

## Setup

1. Create a Supabase project, run `supabase/schema.sql` in its SQL editor.
2. `cp .env.example .env` and fill it in.
3. `npm install && npm run seed && npm run scrape && npm run dev`

No database yet? `npm run scrape -- --dry-run` runs the whole pipeline against
`seed/companies.csv` and needs no credentials. For the site itself, `npm run fixture` serves
live adapter output in Supabase's shape on :54321 — point `SUPABASE_URL` at it and
`npm run dev` works with no database.

## Deploy

Cloudflare Pages, build `npm run build`, output directory `dist`. Set `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SITE_URL` as Pages environment variables, and `SUPABASE_URL` +
`SUPABASE_SERVICE_KEY` as GitHub Actions secrets for the cron.

Each crawl commits `data/heartbeat.json`, which is also what triggers the Pages rebuild —
one mechanism doing two jobs. At ~124 builds a month it sits well inside the free 500.

If Supabase is unreachable at build time **the build fails on purpose**. Cloudflare then
keeps serving the last good deployment; publishing an empty site would deindex everything.

## Commands

| Command | Does |
| --- | --- |
| `npm run detect -- <careers-url> [name]` | Which ATS is this company on, and what's its board slug? |
| `npm run detect -- --seed` | Fill in `ats`/`ats_slug` for every blank row in the seed CSV |
| `npm run seed` | Load `seed/companies.csv` into Supabase |
| `npm run scrape -- [--company slug] [--dry-run]` | Crawl |
| `npm run fixture` | Serve live ATS data in Supabase's shape, for building without a database |
| `npm run ping -- [--all]` | Push changed job URLs to Google Indexing API + IndexNow |
| `npm run build` | Static build into `dist` |
| `npm test` | The five assertions that matter |

## Adding companies

`seed/companies.csv` is the one manual input this project has. Add a row with at least
`name,slug,careers_url,area,lat,lng`, then run `npm run detect -- --seed` — it finds the
ATS board by scanning the careers page and, when that page renders in JS (most do), by
guessing the board token from the company name and confirming it against the live API.
Anything it can't confirm stays link-out, which is a fine outcome.

Add a 7th adapter only once **three or more** seeded companies share that ATS. Oracle
Recruiting is next in line.

## SEO, and what is actually winnable

You will not outrank Naukri or LinkedIn for "software engineer jobs pune". The winnable
queries are the long tail nobody serves: *startups hiring in Hinjawadi*, *which Pune
startups hire freshers*, *AI startups in Pune hiring*. The page structure follows from that
— per-job, per-company, per-area and per-role pages, each with real content rather than a
filtered view of one list.

- `JobPosting` schema on every job page, built to Google's aggregator rules: titles passed
  through verbatim, `directApply: false`, and pages generated **only for open roles** so no
  expired listing is left carrying schema.
- `scripts/ping-index.ts` pushes changed URLs instead of waiting for a crawl. Google's
  Indexing API accepts only two content types and `JobPosting` is one of them — 200/day,
  free. IndexNow covers Bing and Copilot in one batch call.
- `/data/jobs.json`, `/rss.xml` and `/llms.txt` exist so an AI crawler takes the whole
  dataset in one request rather than walking ~125 pages.
- Descriptions are stored as plain text, never HTML, and are what makes a job page
  substantial enough to index at all.

## Data caveats, stated plainly

- Coordinates are **area centroids**, not street addresses. `src/scripts/app.ts` spreads
  overlapping pins by ~0.5 km so ten Hinjawadi companies don't render as one dot.
- Pune presence is **verified by their own job postings** for companies with a live feed.
  For the rest it is seed data and should be checked before you show this to anyone.
- Only Pune-relevant jobs are stored. A bare "Remote" is treated as *not* Pune —
  it is usually US-remote, and a Pune map full of San Francisco roles is worse than a
  smaller honest one.

## The two things that will break this

1. **A failed fetch must never close jobs.** `computeMisses()` returns nothing when the
   crawl failed. Without that guard one network blip marks every job in the database as
   closed. It is a pure function with a test on it — keep it that way.
2. **GitHub disables scheduled workflows after 60 days of repo inactivity.** The workflow
   commits `data/heartbeat.json` each run so the cron stays alive.

## Only public syndication APIs

Greenhouse, Lever, Ashby, Workday, SmartRecruiters and Recruitee publish these endpoints
so listings can be aggregated. LinkedIn, Naukri and Wellfound do not — companies on those
are link-out only, deliberately.
