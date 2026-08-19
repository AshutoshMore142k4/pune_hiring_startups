import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPune, parseExperience, computeMisses, MISS_LIMIT, stripHtml } from './normalize'
import { jobFunctions } from '../lib/filters'

test('isPune: localities in, other metros out, remote only with an India signal', () => {
  for (const loc of ['Pune, India', 'Hinjawadi', 'Kharadi, Pune, MH', 'Remote (India)', 'PCMC'])
    assert.equal(isPune(loc), true, loc)

  for (const loc of [
    'Bengaluru',
    'Bangalore, India',
    'Remote - Bengaluru',   // remote, but names another metro
    'Remote, United States', // the bare-"in" trap: must not read as India
    'Punta Gorda, FL',       // must not substring-match "pune"
    null,
  ])
    assert.equal(isPune(loc), false, String(loc))
})

test('parseExperience: explicit numbers beat seniority words', () => {
  assert.deepEqual(parseExperience('Backend Engineer (0-2 years)'), { min: 0, max: 2 })
  assert.deepEqual(parseExperience('Data Scientist, 5+ years'), { min: 5, max: null })
  assert.deepEqual(parseExperience('Software Engineer - Fresher'), { min: 0, max: 1 })
  assert.deepEqual(parseExperience('Engineering Intern'), { min: 0, max: 0 })
  assert.deepEqual(parseExperience('Senior Platform Engineer'), { min: 5, max: null })
  assert.deepEqual(parseExperience('Product Designer'), { min: null, max: null })
})

test('computeMisses: a FAILED fetch never closes a job', () => {
  const existing = [
    { id: 1, ats_job_id: 'a', miss_count: 0 },
    { id: 2, ats_job_id: 'b', miss_count: MISS_LIMIT - 1 },
  ]

  // Fetch failed -> the response is empty, but nothing may be marked missing.
  assert.deepEqual(computeMisses(existing, new Set(), false), [])

  // Fetch succeeded and returned nothing -> both missed; only the repeat offender closes.
  assert.deepEqual(computeMisses(existing, new Set(), true), [
    { id: 1, miss_count: 1, is_open: true },
    { id: 2, miss_count: MISS_LIMIT, is_open: false },
  ])

  // Still listed -> untouched.
  assert.deepEqual(computeMisses(existing, new Set(['a', 'b']), true), [])
})

test('stripHtml: decodes Greenhouse double-encoding and never leaves markup behind', () => {
  // Greenhouse ships "&lt;p&gt;" for "<p>" — verified against the live board.
  const gh = '&lt;h3&gt;About&lt;/h3&gt;&lt;p&gt;We use R&amp;amp;D&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Go&lt;/li&gt;&lt;/ul&gt;'
  const out = stripHtml(gh)!
  assert.ok(!out.includes('<'), `markup survived: ${out}`)
  assert.ok(out.includes('R&D'), out)
  assert.ok(out.includes('• Go'), out)

  assert.equal(stripHtml('<script>alert(1)</script>'), null)
  assert.equal(stripHtml(''), null)
  assert.equal(stripHtml(null), null)
})

// Lives here rather than a second test file: same rule, one runnable check per behaviour.
test('jobFunctions: an ML engineer is both engineering and data/ai', () => {
  const ml = jobFunctions('Senior Machine Learning Engineer')
  assert.ok(ml.includes('engineering') && ml.includes('data/ai'), ml.join(','))
  assert.deepEqual(jobFunctions('Associate Director, Finance'), ['other'])
  assert.deepEqual(jobFunctions('Product Designer'), ['design'])
  assert.ok(jobFunctions('Engineering Manager').includes('engineering'))
  assert.deepEqual(jobFunctions('Senior Accountant'), ['other'])
})
