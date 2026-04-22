import { NextRequest, NextResponse } from 'next/server'

const TOMTOM_KEY = process.env.TOM_TOM_API_KEY

// TomTom POI category 9910 = Truck Stop, 7311 = Petrol Station
const CATEGORY_SET = '9910,7311'

const TRUCK_BRANDS = ['pilot', 'flying j', "love's", 'loves', 'ta ', 'travelcenters', 'travel centers', 'petro', 'sapp bros', 'speedco', 'ambest', 'kwik trip', 'casey']

function isTruckFriendly(name: string | null, categories: string[]): boolean {
  if (!name) return false
  const lower = name.toLowerCase()
  return TRUCK_BRANDS.some(b => lower.includes(b))
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })

  if (!TOMTOM_KEY) {
    return NextResponse.json({ error: 'TOM_TOM_API_KEY not set' }, { status: 500 })
  }

  const url = new URL('https://api.tomtom.com/search/2/nearbySearch/.json')
  url.searchParams.set('key', TOMTOM_KEY)
  url.searchParams.set('lat', lat)
  url.searchParams.set('lon', lng)
  url.searchParams.set('radius', '80000') // 50 miles
  url.searchParams.set('categorySet', CATEGORY_SET)
  url.searchParams.set('limit', '50')
  url.searchParams.set('language', 'en-US')

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) {
    return NextResponse.json({ error: 'TomTom error', status: res.status }, { status: 502 })
  }

  const data = await res.json()

  const results = (data.results ?? [])
    .filter((r: any) => {
      const cats: string[] = r.poi?.categorySet?.map((c: any) => String(c.id)) ?? []
      const name: string = r.poi?.name ?? ''
      // Keep if it's category 9910 (truck stop) or a known truck brand
      return cats.includes('9910') || isTruckFriendly(name, cats)
    })
    .map((r: any) => ({
      id: r.id,
      lat: r.position.lat,
      lng: r.position.lon,
      name: r.poi?.name ?? null,
      brand: r.poi?.brands?.[0]?.name ?? null,
      address: r.address?.freeformAddress ?? null,
    }))

  return NextResponse.json({ stations: results })
}
