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

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) return []
  const data = await res.json()
  return data.results ?? []
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })
  if (!TOMTOM_KEY) return NextResponse.json({ error: 'TOMTOM_API_KEY not set' }, { status: 500 })

  const allResults = await Promise.all(QUERIES.map(q => searchOne(q, lat, lng)))

  // Deduplicate by TomTom id
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
    }))

  return NextResponse.json({ stations })
}
