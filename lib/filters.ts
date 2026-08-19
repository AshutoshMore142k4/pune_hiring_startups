/**
 * Trailing \w* is deliberate: "Engineering", "Designer" and "Researcher" are the common
 * forms, and a bare \b after the stem misses every one of them.
 */
export const FUNCTIONS = {
  engineering:
    /\b(engineer\w*|developer\w*|sde|software|back[\s-]?end|front[\s-]?end|full[\s-]?stack|devops|sre|platform|qa|test\w*|android|ios|mobile|architect\w*)\b/i,
  'data/ai': /\b(data|machine\s*learning|ml|ai|analy\w*|scientist\w*|nlp|llm|research\w*)\b/i,
  product: /\b(product\s*(manager|owner)|program\s*manager|tpm|pm)\b/i,
  design: /\b(design\w*|ux|ui)\b/i,
  // "account" alone swallows Accountant and Accounting, which are finance, not GTM.
  'sales/gtm':
    /\b(sales|account\s*(executive|manager|director)|market\w*|growth|business\s*development|bdr|sdr|customer\s*success|partner\w*)\b/i,
} as const

export type FunctionTag = keyof typeof FUNCTIONS

/**
 * All matching tags, not the first. "Senior Machine Learning Engineer" is both
 * engineering and data/ai; returning only the first match would hide every ML role
 * behind whichever pattern happened to be listed earlier.
 */
export function jobFunctions(title: string): (FunctionTag | 'other')[] {
  const tags = Object.entries(FUNCTIONS)
    .filter(([, re]) => re.test(title))
    .map(([tag]) => tag as FunctionTag)
  return tags.length ? tags : ['other']
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
