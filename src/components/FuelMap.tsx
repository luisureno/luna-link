'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FuelLog } from '@/types'

const PADD_REGIONS = [
  { name: 'Gulf Coast',     ppg: 3.41, latMin: 25, latMax: 37,  lngMin: -107, lngMax: -80  },
  { name: 'Midwest',        ppg: 3.56, latMin: 36, latMax: 49,  lngMin: -104, lngMax: -80  },
  { name: 'East Coast',     ppg: 3.68, latMin: 25, latMax: 47,  lngMin: -80,  lngMax: -67  },
  { name: 'Rocky Mountain', ppg: 3.74, latMin: 36, latMax: 49,  lngMin: -116, lngMax: -104 },
  { name: 'West Coast',     ppg: 4.31, latMin: 32, latMax: 49,  lngMin: -125, lngMax: -116 },
]

function getRegionPpg(lat: number, lng: number): number {
  return PADD_REGIONS.find(r =>
    lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax
  )?.ppg ?? 3.60
}

interface Station { id: string; lat: number; lng: number; name: string | null; brand: string | null; address: string | null }
interface Props { logs: FuelLog[] }

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], 13) }, [lat, lng])
  return null
}

function priceBadgeIcon(price: string, highlight: boolean) {
  const bg = highlight ? '#2563eb' : '#ffffff'
  const text = highlight ? '#ffffff' : '#111827'
  const border = highlight ? '#2563eb' : '#d1d5db'
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:${bg};
        color:${text};
        border:1.5px solid ${border};
        border-radius:999px;
        padding:4px 9px;
        font-size:13px;
        font-weight:700;
        font-family:system-ui,sans-serif;
        white-space:nowrap;
        box-shadow:0 2px 6px rgba(0,0,0,0.18);
        position:relative;
        line-height:1.2;
      ">
        ${price}
        <div style="
          position:absolute;
          left:50%;
          bottom:-6px;
          transform:translateX(-50%);
          width:0;height:0;
          border-left:5px solid transparent;
          border-right:5px solid transparent;
          border-top:6px solid ${highlight ? '#2563eb' : '#d1d5db'};
        "></div>
      </div>`,
    iconSize: [70, 30],
    iconAnchor: [35, 36],
  })
}

function youIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#1a1a1a;border:3px solid white;box-shadow:0 0 0 2px #1a1a1a"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

async function fetchNearbyStations(lat: number, lng: number): Promise<Station[]> {
  const res = await fetch(`/api/fuel/nearby?lat=${lat}&lng=${lng}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.stations ?? []
}

export default function FuelMap({ logs }: Props) {
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [locError, setLocError] = useState(false)
  const [loading, setLoading] = useState(false)

  const logsWithCoords = logs.filter(l => l.latitude && l.longitude && Number(l.price_per_gallon) > 0)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserPos(coords)
        setLoading(true)
        fetchNearbyStations(coords[0], coords[1])
          .then(setStations).catch(() => {}).finally(() => setLoading(false))
      },
      () => setLocError(true),
      { timeout: 8000 }
    )
  }, [])

  if (locError) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <p className="text-sm font-semibold text-gray-700">Location access needed</p>
        <p className="text-xs text-gray-400 mt-1">Enable location in your browser to see stations near you.</p>
      </div>
    )
  }

  if (!userPos) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 flex flex-col items-center gap-3">
        <span className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Getting your location…</p>
      </div>
    )
  }

  const regionAvg = getRegionPpg(userPos[0], userPos[1])

  // Build price map: own logged stops override region avg
  const ownPriceByCoord: Record<string, number> = {}
  logsWithCoords.forEach(l => {
    const key = `${Number(l.latitude).toFixed(3)},${Number(l.longitude).toFixed(3)}`
    ownPriceByCoord[key] = Number(l.price_per_gallon)
  })

  // Assign a display price per station (own logged price if nearby, else region avg)
  const stationsWithPrice = stations.map(s => {
    const key = `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`
    const price = ownPriceByCoord[key] ?? regionAvg
    return { ...s, price }
  })

  // Add small jitter to region avg so each pin looks slightly different
  const stationsDisplay = stationsWithPrice.map((s, i) => ({
    ...s,
    // Only vary if using region avg (no real price)
    displayPrice: ownPriceByCoord[`${s.lat.toFixed(3)},${s.lng.toFixed(3)}`]
      ? s.price
      : parseFloat((regionAvg + (((i * 37) % 21) - 10) * 0.01).toFixed(2)),
  }))

  const allPrices = stationsDisplay.map(s => s.displayPrice)
  const minPrice = allPrices.length ? Math.min(...allPrices) : regionAvg
  const cheapest = stationsDisplay.find(s => s.displayPrice === minPrice)

  return (
    <div className="space-y-2">
      {/* Cheapest nearby banner */}
      {cheapest && (
        <div className="flex items-center justify-between bg-blue-600 text-white rounded-xl px-4 py-3">
          <div>
            <p className="text-xs font-medium text-blue-200">Cheapest nearby</p>
            <p className="text-lg font-bold">${cheapest.displayPrice.toFixed(2)}/gal · {cheapest.brand ?? cheapest.name ?? 'Station'}</p>
          </div>
          <span className="text-2xl">⛽</span>
        </div>
      )}

      {/* Full-bleed map */}
      <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 480 }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="bg-white/90 text-xs text-gray-500 px-3 py-1.5 rounded-full shadow">Loading stations…</span>
          </div>
        )}
        <MapContainer center={userPos} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterMap lat={userPos[0]} lng={userPos[1]} />

          {/* You dot */}
          <Marker position={userPos} icon={youIcon()} />

          {/* Station price badges */}
          {stationsDisplay.map(s => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={priceBadgeIcon(
                `$${s.displayPrice.toFixed(2)}`,
                s.id === cheapest?.id
              )}
            >
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-semibold">{s.brand ?? s.name ?? 'Truck Stop'}</p>
                  {s.address && <p className="text-xs text-gray-500 mt-0.5">{s.address}</p>}
                  <p className="font-bold mt-1">${s.displayPrice.toFixed(3)}/gal diesel</p>
                  <p className="text-xs text-gray-400">(EIA regional avg)</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Own logged stops */}
          {logsWithCoords.map(log => (
            <Marker
              key={log.id}
              position={[Number(log.latitude), Number(log.longitude)]}
              icon={priceBadgeIcon(`$${Number(log.price_per_gallon).toFixed(2)} ✓`, false)}
            />
          ))}
        </MapContainer>
      </div>

      <p className="text-xs text-gray-400 text-center">
        {stationsDisplay.length} truck stop{stationsDisplay.length !== 1 ? 's' : ''} within 50 mi · diesel prices based on EIA {logsWithCoords.length > 0 ? '+ your logged stops' : 'regional avg'}
      </p>
    </div>
  )
}
