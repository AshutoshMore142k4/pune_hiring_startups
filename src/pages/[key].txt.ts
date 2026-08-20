import type { APIRoute, GetStaticPaths } from 'astro'

/**
 * The IndexNow ownership file. IndexNow fetches https://<host>/<key>.txt and checks the body
 * is the key — the filename *is* the key, so a fixed-name endpoint cannot serve it. Hence a
 * dynamic route with exactly one path baked in at build time.
 *
 * scripts/ping-index.ts sends keyLocation: <SITE>/<key>.txt. Until this file existed that URL
 * 404'd, so IndexNow answered 403 to every submission and the script logged it as a success.
 *
 * The key is a public verification token, not a secret — it is meant to be served to anyone.
 * Unset, or outside IndexNow's 8-128 characters of [a-zA-Z0-9-], and no file is emitted: a
 * malformed key fails verification just as silently as a missing one, so better to see the
 * absence at build time.
 *
 * Static routes win over dynamic ones in Astro, so /robots.txt, /llms.txt and /ads.txt are
 * unaffected by this pattern.
 */
const key: string | undefined = import.meta.env.PUBLIC_INDEXNOW_KEY
const valid = key && /^[a-zA-Z0-9-]{8,128}$/.test(key) ? key : null

export const getStaticPaths: GetStaticPaths = () => (valid ? [{ params: { key: valid } }] : [])

export const GET: APIRoute = () =>
  new Response(valid, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
