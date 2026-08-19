import type { APIRoute } from 'astro'

/**
 * All AI crawlers allowed — the content is public job listings, and being the cited source
 * for "who is hiring in Pune" is worth more than withholding it.
 */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'meta-externalagent',
  'Bytespider',
  'cohere-ai',
  'Amazonbot',
  'DuckAssistBot',
  'MistralAI-User',
]

export const GET: APIRoute = ({ site }) => {
  const body = `# Startup Radar — Pune startup hiring map
# Every page is server-rendered static HTML. No JavaScript is needed to read any content.

User-agent: *
Allow: /

${AI_CRAWLERS.map((bot) => `User-agent: ${bot}\nAllow: /`).join('\n\n')}

# Full dataset in one request, rather than crawling ~125 pages:
# ${new URL('/data/jobs.json', site).href}
# Guidance for LLMs: ${new URL('/llms.txt', site).href}

Sitemap: ${new URL('/sitemap.xml', site).href}
`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
