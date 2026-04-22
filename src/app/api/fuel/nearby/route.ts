import { NextRequest, NextResponse } from 'next/server'

const TOMTOM_KEY = process.env.TOMTOM_API_KEY

const QUERIES = [
  'Pilot Flying J',
  "Love's Travel Stop",
  'TA Travel Center',
  'Petro Stopping Center',
  'Sapp Bros',
  'truck stop',
]

async function searchOne(query: string, lat: string, lng: string): Promise<any[]> {
  const url = new URL(`https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`)
  url.searchParams.set('key', TOMTOM_KEY!)
  url.searchParams.set('lat', lat)
  url.searchParams.set('lon', lng)
  url.searchParams.set('radius', '50000')
  url.searchParams.set('limit', '20')
  url.searchParams.set('language', 'en-US')
  url.searchParams.set('openingHours', 'nextSevenDays')

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) return []
  return (await res.json()).results ?? []
}

function parseHours(poi: any): string | null {
  try {
    const periods = poi?.openingHours?.timeRanges
    if (!periods?.length) return null
    const now = new Date()
    const todayIdx = now.getDay() // 0=Sun
    const todayPeriod = periods.find((p: any) => {
      const d = new Date(p.startTime?.date ?? '')
      return d.getDay() === todayIdx
    })
    if (!todayPeriod) return null
    const s = todayPeriod.startTime?.time ?? ''
    const e = todayPeriod.endTime?.time ?? ''
    if (!s && !e) return '24 hours'
    const fmt = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      const ampm = h >= 12 ? 'PM' : 'AM'
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
    }
    return `${fmt(s)} – ${fmt(e)}`
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })
  if (!TOMTOM_KEY) return NextResponse.json({ error: 'TOMTOM_API_KEY not set' }, { status: 500 })

  const allResults = await Promise.all(QUERIES.map(q => searchOne(q, lat, lng)))

  const seen = new Set<string>()
  const stations = allResults.flat()
    .filter(r => {
      if (!r.id || seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
    .map(r => ({
      id: r.id,
      lat: r.position.lat,
      lng: r.position.lon,
      name: r.poi?.name ?? null,
      brand: r.poi?.brands?.[0]?.name ?? null,
      address: r.address?.freeformAddress ?? null,
      phone: r.poi?.phone ?? null,
      hours: parseHours(r.poi),
    }))

  return NextResponse.json({ stations })
}
