import type { APIRoute } from 'astro'

/**
 * ads.txt is not mandatory for AdSense ("not mandatory, but it's highly recommended"), but it
 * is one of the three accepted site-ownership checks — so this is what verifies the domain
 * before any ad script ships.
 *
 * With PUBLIC_ADSENSE_CLIENT unset we emit no file at all. A half-written ads.txt is worse
 * than none: unauthorised-seller checks read it literally, and a file declaring no sellers
 * suppresses bids on every ad on the domain.
 *
 * The env var is the AdSense client (ca-pub-…); ads.txt wants the bare publisher ID (pub-…).
 * f08c47fec0942fa0 is Google's TAG certification-authority ID and is the same for everyone.
 */
const client: string | undefined = import.meta.env.PUBLIC_ADSENSE_CLIENT
const pub = /^(ca-)?pub-\d{16}$/.test(client ?? '') ? client!.replace(/^ca-/, '') : null

export const GET: APIRoute = () =>
  pub
    ? new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    : new Response(null, { status: 404 })
