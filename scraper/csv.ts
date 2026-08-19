// Minimal RFC4180 CSV. Node has no CSV parser and this file is ~30 lines; a dependency
// for it would be the worse trade.

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = [] }
    else if (c !== '\r') field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ''))
  const head = (nonEmpty.shift() ?? []).map((h) => h.trim())
  return nonEmpty.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

export function toCsv(rows: Record<string, string>[], headers: string[]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => cell(r[h] ?? '')).join(',')),
  ].join('\n') + '\n'
}
