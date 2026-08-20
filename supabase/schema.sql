-- Punehire schema. Paste into Supabase SQL editor.
-- Two tables. Crawl history lives in GitHub Actions logs, which are free and searchable.

create table if not exists companies (
  id               bigserial primary key,
  name             text not null,
  slug             text unique not null,
  website          text,
  careers_url      text not null,
  ats              text,             -- greenhouse|lever|ashby|workday|smartrecruiters|recruitee|oracle|phenom|successfactors, null = link-out only
  ats_slug         text,             -- board token; NOT always the company name (see scraper/detect.ts)
  kind             text not null default 'startup',  -- 'startup' | 'enterprise'. Enterprises render in a separate section and stay off the startup map.
  area             text,             -- Kharadi, Baner, Hinjawadi...
  lat              double precision,
  lng              double precision,
  industry         text,
  stage            text,
  headcount_band   text,
  last_crawled_at  timestamptz,
  last_crawl_error text,
  unique (ats, ats_slug)
);

create table if not exists jobs (
  id              bigserial primary key,
  company_id      bigint not null references companies(id) on delete cascade,
  ats_job_id      text not null,    -- ATS id, or sha1(title|location) fallback
  title           text not null,
  location_raw    text,
  is_pune         boolean not null default false,
  remote_type     text,             -- onsite|hybrid|remote
  employment_type text,
  experience_min  smallint,
  experience_max  smallint,
  apply_url       text not null,
  description     text,             -- plain text; Google requires it on JobPosting
  posted_at       timestamptz,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  miss_count      smallint not null default 0,
  is_open         boolean not null default true,
  unique (company_id, ats_job_id)
);

create index if not exists jobs_open_pune_idx on jobs (is_open, is_pune);
create index if not exists jobs_company_idx   on jobs (company_id);
create index if not exists companies_ats_idx  on companies (ats);

-- Public read, no writes. The scraper uses the service_role key, which bypasses RLS.
alter table companies enable row level security;
alter table jobs      enable row level security;

drop policy if exists anon_read on companies;
drop policy if exists anon_read on jobs;
create policy anon_read on companies for select to anon, authenticated using (true);
create policy anon_read on jobs      for select to anon, authenticated using (true);

-- No PostGIS: at ~100 markers the whole dataset is read once at build time and filtered in JS.
-- Upgrade path when server-side radius queries get slow:
--   create extension postgis;
--   alter table companies add column geog geography(Point,4326)
--     generated always as (st_point(lng, lat)::geography) stored;
--   create index on companies using gist (geog);

-- Existing installs: run this once.
alter table jobs add column if not exists description text;
alter table companies add column if not exists kind text not null default 'startup';
