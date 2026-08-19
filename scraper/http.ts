// Contact URL in the UA so anyone rate-limiting us can find out who we are.
const UA = 'StartupRadar/0.1 (+https://github.com/startup-radar/startup-radar; Pune startup hiring map)'

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'user-agent': UA, accept: 'application/json', ...(init.headers as Record<string, string>) },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`)
  return (await res.json()) as T
}
