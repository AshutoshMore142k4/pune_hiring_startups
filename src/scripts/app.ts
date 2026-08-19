import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * The only JavaScript on the site. Everything it touches is already rendered in the HTML —
 * this adds the map and narrows an existing list. With JS off the page still works, which
 * is also exactly what a crawler sees.
 */

type MapPoint = { slug: string; name: string; lat: number; lng: number; jobs: number }

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}
const PUNE: L.LatLngTuple = [18.5204, 73.8567]
const PANEL_W = 384
const isDesktop = () => window.matchMedia('(min-width: 901px)').matches

const theme = (): 'light' | 'dark' => {
  const set = document.documentElement.dataset.theme
  if (set === 'dark' || set === 'light') return set
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/**
 * Seed coordinates are area centroids, so every Hinjawadi company lands on one pixel and
 * ten markers read as one. A deterministic offset per slug keeps them distinct and stops
 * them jumping between renders.
 * ponytail: delete once companies carry real street-level coordinates.
 */
function spread(slug: string): [number, number] {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0
  const angle = ((h % 360) * Math.PI) / 180
  const radius = 0.004 + ((Math.abs(h) % 100) / 100) * 0.005
  return [Math.sin(angle) * radius, Math.cos(angle) * radius]
}

function initMap(host: HTMLElement, points: MapPoint[]) {
  const map = L.map(host, { zoomControl: false }).setView(PUNE, 11)

  // Default position is top-left, and .leaflet-control-container sits at z-index 1000 —
  // it would render on top of the floating panel.
  L.control.zoom({ position: 'topright' }).addTo(map)

  const tiles = L.tileLayer(TILES[theme()], {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  }).addTo(map)

  const markers = new Map<string, L.CircleMarker>()
  const layer = L.layerGroup().addTo(map)

  for (const p of points) {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue
    const [dLat, dLng] = spread(p.slug)
    const marker = L.circleMarker([p.lat + dLat, p.lng + dLng], {
      radius: p.jobs ? Math.min(7 + p.jobs, 18) : 5,
      weight: 1.5,
      fillOpacity: 0.35,
    })
      .bindTooltip(`${p.name} — ${p.jobs ? `${p.jobs} open` : 'careers page'}`)
      .on('click', () => select(p.slug, false))
    marker.addTo(layer)
    markers.set(p.slug, marker)
  }

  /** Colours come from the stylesheet, so a theme flip re-resolves them from one source. */
  function paint() {
    const live = cssVar('--live') || '#16a34a'
    const idle = cssVar('--idle') || '#b8b4ae'
    for (const p of points) {
      const m = markers.get(p.slug)
      if (!m) continue
      const colour = p.jobs ? live : idle
      const active = document.querySelector(`.card[data-slug="${p.slug}"][data-active="true"]`)
      m.setStyle({
        color: colour,
        fillColor: colour,
        weight: active ? 3 : 1.5,
        fillOpacity: active ? 0.65 : 0.35,
      })
    }
  }
  paint()

  document.addEventListener('themechange', () => {
    tiles.setUrl(TILES[theme()])
    paint()
  })
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!document.documentElement.dataset.theme) {
      tiles.setUrl(TILES[theme()])
      paint()
    }
  })

  function select(slug: string, fromCard: boolean) {
    for (const card of document.querySelectorAll<HTMLElement>('.card')) {
      const on = card.dataset.slug === slug
      card.dataset.active = String(on)
      const details = card.querySelector('details')
      if (details && on) details.open = true
    }

    if (!fromCard) {
      const card = document.querySelector<HTMLElement>(`.card[data-slug="${slug}"]`)
      card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      panel?.setAttribute('data-open', 'true')
    } else {
      const p = points.find((x) => x.slug === slug)
      if (p) {
        const [dLat, dLng] = spread(p.slug)
        // Keep the marker clear of the floating panel rather than centring it underneath.
        map.panInside(L.latLng(p.lat + dLat, p.lng + dLng), {
          paddingTopLeft: isDesktop() ? [PANEL_W + 40, 90] : [30, 60],
          paddingBottomRight: [40, isDesktop() ? 40 : 140],
        })
      }
    }
    paint()
  }

  const panel = document.querySelector<HTMLElement>('.panel')

  document.querySelectorAll<HTMLElement>('.card').forEach((card) => {
    card.addEventListener('click', () => card.dataset.slug && select(card.dataset.slug, true))
  })

  return { markers, paint }
}

/* --------------------------------------------------------------- filters -- */

function initFilters(sync: (visible: Set<string>) => void) {
  const search = document.querySelector<HTMLInputElement>('#search')
  const chips = [...document.querySelectorAll<HTMLButtonElement>('.chip[data-filter]')]
  const cards = [...document.querySelectorAll<HTMLElement>('.card')]
  const count = document.querySelector<HTMLElement>('#result-count')
  const empty = document.querySelector<HTMLElement>('#empty')

  function apply() {
    const q = (search?.value ?? '').trim().toLowerCase()
    const on = chips.filter((c) => c.getAttribute('aria-pressed') === 'true')
    const tags = on.filter((c) => c.dataset.filter === 'tag').map((c) => c.dataset.value!)
    const flags = on.filter((c) => c.dataset.filter === 'flag').map((c) => c.dataset.value!)

    const visible = new Set<string>()
    let jobs = 0

    for (const card of cards) {
      const d = card.dataset
      const hit =
        (!q || (d.search ?? '').includes(q)) &&
        (!tags.length || tags.some((t) => (d.tags ?? '').split(' ').includes(t))) &&
        flags.every((f) => d[f] === '1')

      card.hidden = !hit
      if (hit) {
        visible.add(d.slug!)
        jobs += Number(d.jobs ?? 0)
      }
    }

    if (count) {
      count.textContent = `${visible.size} ${visible.size === 1 ? 'startup' : 'startups'} · ${jobs} ${jobs === 1 ? 'role' : 'roles'}`
    }
    if (empty) empty.hidden = visible.size > 0
    sync(visible)
  }

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')
      apply()
    }),
  )
  search?.addEventListener('input', apply)

  // Two clear buttons (toolbar + empty state); ids must be unique, so bind by attribute.
  document.querySelectorAll('[data-clear]').forEach((btn) =>
    btn.addEventListener('click', () => {
      chips.forEach((c) => c.setAttribute('aria-pressed', 'false'))
      if (search) search.value = ''
      apply()
    }),
  )

  apply()
}

/* ----------------------------------------------------------------- boot -- */

const host = document.getElementById('map')
const payload = document.getElementById('map-data')?.textContent

if (host && payload) {
  const points = JSON.parse(payload) as MapPoint[]
  const { markers, paint } = initMap(host, points)

  initFilters((visible) => {
    for (const [slug, marker] of markers) {
      const el = marker.getElement() as SVGElement | null
      if (el) el.style.display = visible.has(slug) ? '' : 'none'
    }
    paint()
  })
}

// Bottom sheet: tap the grip to toggle.
// ponytail: no drag gesture — that is ~150 lines of pointer maths for one interaction.
document.querySelector('.grip')?.addEventListener('click', () => {
  const panel = document.querySelector<HTMLElement>('.panel')
  if (!panel) return
  panel.dataset.open = panel.dataset.open === 'true' ? 'false' : 'true'
})

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  document.querySelector<HTMLElement>('.panel')?.setAttribute('data-open', 'false')
  document.querySelectorAll<HTMLElement>('.card[data-active="true"]').forEach((c) => {
    c.dataset.active = 'false'
  })
})
