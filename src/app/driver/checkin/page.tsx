'use client'

import { useState, useMemo  } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import type { LocationType } from '@/types'

const locationOptions: { type: LocationType; label: string; emoji: string }[] = [
  { type: 'yard', label: 'Arrived at Yard', emoji: '🏠' },
  { type: 'quarry', label: 'Arrived at Quarry', emoji: '⛏️' },
  { type: 'job_site', label: 'Arrived at Job Site', emoji: '🏗️' },
  { type: 'other', label: 'Other Location', emoji: '📍' },
]

export default function CheckInPage() {
  const { profile, accountType } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const homePath = accountType === 'solo' ? '/dashboard/solo' : '/driver'

  const [selected, setSelected] = useState<LocationType | null>(null)
  const [customLabel, setCustomLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [successTime, setSuccessTime] = useState('')

  async function handleCheckIn() {
    if (!selected || !profile) return
    setLoading(true)

    let latitude: number | null = null
    let longitude: number | null = null

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      )
      latitude = pos.coords.latitude
      longitude = pos.coords.longitude
    } catch {
      // GPS unavailable — proceed without coordinates
    }

    await supabase.from('check_ins').insert({
      company_id: profile.company_id,
      driver_id: profile.id,
      location_type: selected,
      location_label: selected === 'other' ? customLabel || 'Other' : null,
      latitude,
      longitude,
      notes: notes || null,
      checked_in_at: new Date().toISOString(),
    })

    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    setSuccessTime(time)
    setSuccess(true)
    setTimeout(() => router.push(homePath), 2000)
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-xl font-semibold text-gray-900">Checked In</h2>
        <p className="text-gray-500 mt-1">{locationOptions.find(o => o.type === selected)?.label} at {successTime}</p>
        <p className="text-xs text-gray-400 mt-4">Returning to home...</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Check In</h1>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {locationOptions.map(opt => (
          <button
            key={opt.type}
            onClick={() => setSelected(opt.type)}
            className={`flex flex-col items-center justify-center gap-2 p-5 rounded-lg border-2 min-h-[100px] text-sm font-medium transition-colors ${
              selected === opt.type
                ? 'border-[#1a1a1a] bg-gray-100 text-gray-900'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <span className="text-2xl">{opt.emoji}</span>
            {opt.label}
          </button>
        ))}
      </div>

      {selected === 'other' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
          <input
            type="text"
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            placeholder="Describe the location"
            className="w-full px-3 py-3 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      )}

      {selected && (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any notes..."
              className="w-full px-3 py-3 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>

          <button
            onClick={handleCheckIn}
            disabled={loading || (selected === 'other' && !customLabel)}
            className="w-full py-4 bg-[#16a34a] text-white text-base font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Checking in...' : 'Check In Now'}
          </button>
        </>
      )}
    </div>
  )
}
