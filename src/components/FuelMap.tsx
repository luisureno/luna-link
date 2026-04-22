'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { FuelLog } from '@/types'

interface Props {
  logs: FuelLog[]
}

function priceColor(ppg: number, min: number, max: number): string {
  if (max === min) return '#6b7280'
  const ratio = (ppg - min) / (max - min)
  if (ratio < 0.33) return '#16a34a'
  if (ratio < 0.66) return '#d97706'
  return '#dc2626'
}

export default function FuelMap({ logs }: Props) {
  const logsWithCoords = logs.filter(l => l.latitude && l.longitude)
  const withPpg = logsWithCoords.filter(l => Number(l.price_per_gallon) > 0)
  const minPpg = withPpg.length ? Math.min(...withPpg.map(l => Number(l.price_per_gallon))) : 0
  const maxPpg = withPpg.length ? Math.max(...withPpg.map(l => Number(l.price_per_gallon))) : 0

  const center: [number, number] = logsWithCoords.length
    ? [Number(logsWithCoords[0].latitude), Number(logsWithCoords[0].longitude)]
    : [39.5, -98.35]

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ height: 400 }}>
        <MapContainer center={center} zoom={logsWithCoords.length === 1 ? 12 : 6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {logsWithCoords.map(log => {
            const ppg = Number(log.price_per_gallon)
            const color = ppg > 0 ? priceColor(ppg, minPpg, maxPpg) : '#6b7280'
            const grand = Number(log.total_cost ?? 0) + Number(log.def_total_cost ?? 0)
            const dt = new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            return (
              <CircleMarker
                key={log.id}
                center={[Number(log.latitude), Number(log.longitude)]}
                radius={10}
                pathOptions={{ color: 'white', weight: 2, fillColor: color, fillOpacity: 0.9 }}
              >
                <Popup>
                  <div className="text-sm min-w-[140px]">
                    <p className="font-semibold">{dt}</p>
                    {ppg > 0 && <p className="text-gray-600">${ppg.toFixed(3)}/gal</p>}
                    {Number(log.gallons) > 0 && <p className="text-gray-600">{Number(log.gallons).toFixed(1)} gal</p>}
                    <p className="font-bold mt-1">${grand.toFixed(2)} total</p>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      {/* legend */}
      {withPpg.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Price legend</p>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-600 inline-block" /> Cheapest (≤ ${(minPpg + (maxPpg - minPpg) * 0.33).toFixed(3)})</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-600 inline-block" /> Mid</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> Expensive (≥ ${(minPpg + (maxPpg - minPpg) * 0.66).toFixed(3)})</span>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">{logsWithCoords.length} fuel stop{logsWithCoords.length !== 1 ? 's' : ''} with location data</p>
    </div>
  )
}
