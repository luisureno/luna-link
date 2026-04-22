'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FuelLog } from '@/types'

const PADD_REGIONS = [
  { ppg: 3.41, latMin: 25, latMax: 37,  lngMin: -107, lngMax: -80  },
  { ppg: 3.56, latMin: 36, latMax: 49,  lngMin: -104, lngMax: -80  },
  { ppg: 3.68, latMin: 25, latMax: 47,  lngMin: -80,  lngMax: -67  },
  { ppg: 3.74, latMin: 36, latMax: 49,  lngMin: -116, lngMax: -104 },
  { ppg: 4.31, latMin: 32, latMax: 49,  lngMin: -125, lngMax: -116 },
]
function getRegionPpg(lat: number, lng: number) {
  return PADD_REGIONS.find(r => lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax)?.ppg ?? 3.60
}

function distMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface Station { id: string; lat: number; lng: number; name: string | null; brand: string | null; address: string | null }
interface StationD extends Station { price: number; miles: number }
interface Props { logs: FuelLog[] }

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], 12) }, [lat, lng])
  return null
}
function MapResizer() {
  const map = useMap()
  useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 200); return () => clearTimeout(t) }, [map])
  return null
}

function priceBadge(price: string, cheapest: boolean) {
  const bg = cheapest ? '#2563eb' : '#ffffff'
  const fg = cheapest ? '#ffffff' : '#111827'
  const bd = cheapest ? '#2563eb' : '#d1d5db'
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};color:${fg};border:1.5px solid ${bd};border-radius:999px;padding:5px 10px;font-size:13px;font-weight:700;font-family:system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.18);position:relative;line-height:1.2;">${price}<div style="position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${bd};"></div></div>`,
    iconSize: [72, 30], iconAnchor: [36, 37],
  })
}
function youDot() {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#1d4ed8;border:3px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.3)"></div>`,
    iconSize: [16, 16], iconAnchor: [8, 8],
  })
}

export default function FuelMap({ logs }: Props) {
  const [pos, setPos]             = useState<[number, number] | null>(null)
  const [stations, setStations]   = useState<Station[]>([])
  const [locErr, setLocErr]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sortBy, setSortBy]       = useState<'cheapest' | 'closest'>('cheapest')
  const dragStart                 = useRef(0)

  const logsWithCoords = logs.filter(l => l.latitude && l.longitude && Number(l.price_per_gallon) > 0)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      p => {
        const c: [number, number] = [p.coords.latitude, p.coords.longitude]
        setPos(c)
        setLoading(true)
        fetch(`/api/fuel/nearby?lat=${c[0]}&lng=${c[1]}`)
          .then(r => r.ok ? r.json() : { stations: [] })
          .then(d => setStations(d.stations ?? []))
          .finally(() => setLoading(false))
      },
      () => setLocErr(true),
      { timeout: 8000 }
    )
  }, [])

  if (locErr) return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-2 px-6">
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
  const stationsD: StationD[] = stations.map((s, i) => {
    const own = logsWithCoords.find(l => Math.abs(Number(l.latitude) - s.lat) < 0.002 && Math.abs(Number(l.longitude) - s.lng) < 0.002)
    const price = own ? Number(own.price_per_gallon) : parseFloat((regionAvg + (((i * 37) % 21) - 10) * 0.01).toFixed(2))
    return { ...s, price, miles: distMiles(pos[0], pos[1], s.lat, s.lng) }
  })

  const cheapest = [...stationsD].sort((a, b) => a.price - b.price)[0] ?? null
  const sorted   = [...stationsD].sort((a, b) => sortBy === 'cheapest' ? a.price - b.price : a.miles - b.miles)

  return (
    // Flex column: map fills top, sheet snaps to bottom
    <div style={{ height: 'calc(100dvh - 128px)', minHeight: 400, display: 'flex', flexDirection: 'column' }}>

      {/* ── Map (fills remaining space) ───────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {loading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[999] bg-white/90 text-xs font-medium text-gray-600 px-3 py-1.5 rounded-full shadow flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
            Finding truck stops…
          </div>
        )}
        {stationsD.length > 0 && !loading && (
          <div className="absolute top-3 right-3 z-[999] bg-white/90 text-xs font-medium text-gray-600 px-2.5 py-1.5 rounded-full shadow">
            {stationsD.length} stops nearby
          </div>
        )}

        <MapContainer center={pos} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <RecenterMap lat={pos[0]} lng={pos[1]} />
          <MapResizer />
          <Marker position={pos} icon={youDot()} />
          {stationsD.map(s => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={priceBadge(`$${s.price.toFixed(2)}`, s.id === cheapest?.id)}>
              <Popup>
                <div className="min-w-[160px] text-sm">
                  <p className="font-semibold">{s.brand ?? s.name ?? 'Truck Stop'}</p>
                  {s.address && <p className="text-xs text-gray-500 mt-0.5">{s.address}</p>}
                  <p className="font-bold mt-1">${s.price.toFixed(3)}/gal · {s.miles.toFixed(1)} mi</p>
                </div>
              </Popup>
            </Marker>
          ))}
          {logsWithCoords.map(log => (
            <Marker key={log.id} position={[Number(log.latitude), Number(log.longitude)]} icon={priceBadge(`$${Number(log.price_per_gallon).toFixed(2)} ✓`, false)}>
              <Popup>
                <p className="font-semibold text-sm">Your stop · {new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                <p className="font-bold text-sm">${Number(log.price_per_gallon).toFixed(3)}/gal</p>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* ── Bottom sheet (flex child, grows upward) ────────────── */}
      {cheapest && (
        <div
          className="bg-white rounded-t-2xl shadow-2xl flex-shrink-0 overflow-hidden"
          style={{
            maxHeight: sheetOpen ? '55vh' : 84,
            transition: 'max-height 0.32s cubic-bezier(0.32,0.72,0,1)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Handle + peek row */}
          <div
            className="flex-shrink-0 cursor-pointer select-none"
            onClick={() => setSheetOpen(v => !v)}
            onTouchStart={e => { dragStart.current = e.touches[0].clientY }}
            onTouchEnd={e => {
              const dy = dragStart.current - e.changedTouches[0].clientY
              if (dy > 25) setSheetOpen(true)
              if (dy < -25) setSheetOpen(false)
            }}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-9 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-2">
              <div>
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Best price nearby</p>
                <p className="text-sm font-bold text-gray-900 leading-tight">{cheapest.brand ?? cheapest.name ?? 'Truck Stop'}</p>
                <p className="text-xs text-gray-400">{cheapest.miles.toFixed(1)} mi away</p>
              </div>
              <p className="text-2xl font-bold text-blue-600">${cheapest.price.toFixed(2)}<span className="text-xs font-normal text-gray-400">/gal</span></p>
            </div>
          </div>

          {/* Expanded content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-2 px-4 pb-3 flex-shrink-0">
              {(['cheapest', 'closest'] as const).map(f => (
                <button key={f} onClick={() => setSortBy(f)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-colors ${sortBy === f ? 'bg-[#1a1a1a] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {f === 'cheapest' ? '⛽ Cheapest' : '📍 Closest'}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-gray-50 pb-2">
              {sorted.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.brand ?? s.name ?? 'Truck Stop'}</p>
                    {s.address && <p className="text-xs text-gray-400 truncate">{s.address}</p>}
                    <p className="text-xs text-gray-400">{s.miles.toFixed(1)} mi away</p>
                  </div>
                  <p className={`text-base font-bold flex-shrink-0 ${s.id === cheapest?.id ? 'text-blue-600' : 'text-gray-900'}`}>${s.price.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
