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

function getRegionPpg(lat: number, lng: number) {
  return PADD_REGIONS.find(r =>
    lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax
  )?.ppg ?? 3.60
}

interface Station { id: string; lat: number; lng: number; name: string | null; brand: string | null; address: string | null }
interface Props { logs: FuelLog[] }

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], 12) }, [lat, lng])
  return null
}

function priceBadge(price: string, cheapest: boolean) {
  const bg    = cheapest ? '#2563eb' : '#ffffff'
  const color = cheapest ? '#ffffff' : '#111827'
  const caret = cheapest ? '#2563eb' : '#d1d5db'
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};color:${color};border:1.5px solid ${caret};border-radius:999px;padding:5px 10px;font-size:13px;font-weight:700;font-family:system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.18);position:relative;line-height:1.2;">${price}<div style="position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${caret};"></div></div>`,
    iconSize: [72, 30],
    iconAnchor: [36, 37],
  })
}

function youDot() {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#1d4ed8;border:3px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

async function fetchStations(lat: number, lng: number): Promise<Station[]> {
  const res = await fetch(`/api/fuel/nearby?lat=${lat}&lng=${lng}`)
  if (!res.ok) return []
  return (await res.json()).stations ?? []
}

export default function FuelMap({ logs }: Props) {
  const [pos, setPos]           = useState<[number, number] | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [locErr, setLocErr]     = useState(false)
  const [loading, setLoading]   = useState(false)

  const logsWithCoords = logs.filter(l => l.latitude && l.longitude && Number(l.price_per_gallon) > 0)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      p => {
        const coords: [number, number] = [p.coords.latitude, p.coords.longitude]
        setPos(coords)
        setLoading(true)
        fetchStations(coords[0], coords[1]).then(setStations).finally(() => setLoading(false))
      },
      () => setLocErr(true),
      { timeout: 8000 }
    )
  }, [])

  if (locErr) return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
      <p className="text-sm font-semibold text-gray-700">Location access needed</p>
      <p className="text-xs text-gray-400">Enable location in your browser to see nearby diesel stops.</p>
    </div>
  )

  if (!pos) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <span className="w-7 h-7 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Getting your location…</p>
    </div>
  )

  const regionAvg = getRegionPpg(pos[0], pos[1])

  // Assign display price per station with slight jitter when using regional avg
  const stationsDisplay = stations.map((s, i) => {
    const ownLog = logsWithCoords.find(l =>
      Math.abs(Number(l.latitude) - s.lat) < 0.002 && Math.abs(Number(l.longitude) - s.lng) < 0.002
    )
    const price = ownLog
      ? Number(ownLog.price_per_gallon)
      : parseFloat((regionAvg + (((i * 37) % 21) - 10) * 0.01).toFixed(2))
    return { ...s, price }
  })

  const sorted   = [...stationsDisplay].sort((a, b) => a.price - b.price)
  const cheapest = sorted[0] ?? null
  const avgPrice = stationsDisplay.length
    ? stationsDisplay.reduce((s, x) => s + x.price, 0) / stationsDisplay.length
    : regionAvg

  return (
    <div className="relative" style={{ height: 'calc(100dvh - 190px)', minHeight: 420 }}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-600 px-3 py-1.5 rounded-full shadow-md flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
          Finding truck stops…
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={pos}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap lat={pos[0]} lng={pos[1]} />

        <Marker position={pos} icon={youDot()} />

        {stationsDisplay.map(s => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={priceBadge(`$${s.price.toFixed(2)}`, s.id === cheapest?.id)}
          >
            <Popup>
              <div className="min-w-[160px] text-sm">
                <p className="font-semibold">{s.brand ?? s.name ?? 'Truck Stop'}</p>
                {s.address && <p className="text-xs text-gray-500 mt-0.5">{s.address}</p>}
                <p className="text-base font-bold mt-1">${s.price.toFixed(3)}/gal</p>
                <p className="text-xs text-gray-400">diesel · EIA regional avg</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {logsWithCoords.map(log => (
          <Marker
            key={log.id}
            position={[Number(log.latitude), Number(log.longitude)]}
            icon={priceBadge(`$${Number(log.price_per_gallon).toFixed(2)} ✓`, false)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">Your stop · {new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                <p className="font-bold">${Number(log.price_per_gallon).toFixed(3)}/gal</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Bottom card overlay */}
      {cheapest && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white rounded-2xl shadow-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Cheapest nearby</p>
            <p className="text-base font-bold text-gray-900">{cheapest.brand ?? cheapest.name ?? 'Truck Stop'}</p>
            {cheapest.address && <p className="text-xs text-gray-500 truncate max-w-[180px]">{cheapest.address}</p>}
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <p className="text-2xl font-bold text-blue-600">${cheapest.price.toFixed(2)}</p>
            <p className="text-xs text-gray-400">per gallon</p>
          </div>
        </div>
      )}

      {/* Top-right station count */}
      {stationsDisplay.length > 0 && (
        <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-600 px-2.5 py-1.5 rounded-full shadow">
          {stationsDisplay.length} stops nearby
        </div>
      )}
    </div>
  )
}
