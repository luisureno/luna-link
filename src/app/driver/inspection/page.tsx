'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import type { InspectionItem } from '@/types'

const CHECKLIST: { id: string; label: string; icon: string }[] = [
  { id: 'brakes', label: 'Brakes', icon: '🛑' },
  { id: 'lights', label: 'Lights', icon: '💡' },
  { id: 'tires', label: 'Tires', icon: '🔵' },
  { id: 'mirrors', label: 'Mirrors', icon: '🪞' },
  { id: 'horn', label: 'Horn', icon: '📯' },
  { id: 'wipers', label: 'Wipers', icon: '🌧️' },
  { id: 'fluid_levels', label: 'Fluid Levels', icon: '🧴' },
]

export default function InspectionPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()

  const [items, setItems] = useState<InspectionItem[]>(
    CHECKLIST.map(c => ({ id: c.id, label: c.label, passed: null, note: '', photo_url: null }))
  )
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const allAnswered = items.every(i => i.passed !== null)
  const failedItems = items.filter(i => i.passed === false)

  function setPassed(id: string, passed: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, passed } : i))
  }

  function setNote(id: string, note: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, note } : i))
  }

  async function handlePhoto(id: string, file: File) {
    if (!profile) return
    setUploadingId(id)
    const path = `inspections/${profile.id}/${Date.now()}-${id}.jpg`
    const { data } = await supabase.storage.from('fuel-receipts').upload(path, file, { upsert: true, contentType: file.type })
    if (data) {
      const { data: { publicUrl } } = supabase.storage.from('fuel-receipts').getPublicUrl(data.path)
      setItems(prev => prev.map(i => i.id === id ? { ...i, photo_url: publicUrl } : i))
    }
    setUploadingId(null)
  }

  async function handleSubmit() {
    if (!profile || !allAnswered) return
    setSubmitting(true)

    const overall_status = failedItems.length === 0 ? 'passed' : 'failed'
    const logDate = new Date().toISOString().split('T')[0]

    const { data: inspectionData } = await supabase.from('pre_trip_inspections').insert({
      company_id: profile.company_id,
      driver_id: profile.id,
      truck_number: profile.truck_number,
      items,
      overall_status,
      inspected_at: new Date().toISOString(),
    }).select().single()

    await supabase.from('daily_logs').upsert({
      company_id: profile.company_id,
      driver_id: profile.id,
      log_date: logDate,
      pre_trip_status: overall_status,
      pre_trip_inspection_id: inspectionData?.id ?? null,
    }, { onConflict: 'driver_id,log_date' })

    setDone(true)
    setTimeout(() => router.push('/driver'), 2000)
  }

  if (done) {
    const passed = failedItems.length === 0
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="text-5xl mb-4">{passed ? '✅' : '⚠️'}</div>
        <h2 className="text-xl font-semibold text-gray-900">{passed ? 'Inspection Passed' : 'Issues Reported'}</h2>
        <p className="text-gray-500 mt-1 text-sm">
          {passed ? 'All items cleared. Have a safe day.' : `${failedItems.length} issue${failedItems.length > 1 ? 's' : ''} reported — dispatcher has been notified.`}
        </p>
        <p className="text-xs text-gray-400 mt-4">Returning to home...</p>
      </div>
    )
  }

  return (
    <div className="p-4 pb-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Pre-Trip Inspection</h1>
        <p className="text-sm text-gray-500 mt-0.5">{profile?.truck_number ? `Truck ${profile.truck_number}` : 'Check each item before starting your day'}</p>
      </div>

      <div className="space-y-3 mb-8">
        {CHECKLIST.map(({ id, label, icon }) => {
          const item = items.find(i => i.id === id)!
          const failed = item.passed === false
          return (
            <div key={id} className={`bg-white border rounded-lg overflow-hidden transition-colors ${failed ? 'border-red-300' : item.passed ? 'border-green-300' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 p-4">
                <span className="text-2xl">{icon}</span>
                <span className="flex-1 text-sm font-medium text-gray-900">{label}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPassed(id, true)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${item.passed === true ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-50'}`}
                  >
                    Pass ✓
                  </button>
                  <button
                    onClick={() => setPassed(id, false)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${item.passed === false ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-50'}`}
                  >
                    Fail ✗
                  </button>
                </div>
              </div>

              {failed && (
                <div className="border-t border-red-100 bg-red-50 p-4 space-y-3">
                  <textarea
                    value={item.note}
                    onChange={e => setNote(id, e.target.value)}
                    placeholder="Describe the issue..."
                    rows={2}
                    className="w-full px-3 py-2 border border-red-200 rounded text-sm text-gray-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <label className={`flex items-center gap-2 text-sm cursor-pointer font-medium ${uploadingId === id ? 'text-gray-400' : 'text-red-700'}`}>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploadingId === id}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(id, f) }}
                    />
                    {uploadingId === id ? (
                      <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />Uploading...</>
                    ) : item.photo_url ? (
                      <><img src={item.photo_url} alt="" className="h-8 w-8 object-cover rounded" />Photo attached — tap to replace</>
                    ) : (
                      <>📷 Add Photo</>
                    )}
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {failedItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-red-800">⚠️ {failedItems.length} issue{failedItems.length > 1 ? 's' : ''} flagged — dispatcher will be notified immediately upon submission.</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className={`w-full py-4 text-white text-base font-medium rounded-lg disabled:opacity-40 transition-colors ${failedItems.length > 0 ? 'bg-red-600' : 'bg-[#16a34a]'}`}
      >
        {submitting ? 'Submitting...' : allAnswered ? `Submit Inspection${failedItems.length > 0 ? ` (${failedItems.length} issue${failedItems.length > 1 ? 's' : ''})` : ' — All Clear'}` : 'Check all items to continue'}
      </button>
    </div>
  )
}
