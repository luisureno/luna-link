'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import type { Dispatch, DispatchAssignment, TemplateField } from '@/types'

type DispatchWithAssignment = Dispatch & { dispatch_assignments: DispatchAssignment[] }

export default function TicketPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [step, setStep] = useState(1)
  const [dispatches, setDispatches] = useState<DispatchWithAssignment[]>([])
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchWithAssignment | null>(null)
  const [fields, setFields] = useState<TemplateField[]>([])
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [photoUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [scanning, setScanning] = useState(false)
  const [scanPreview, setScanPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    loadDispatches()
  }, [profile?.id])

  async function loadDispatches() {
    const assignments = await supabase
      .from('dispatch_assignments')
      .select('*, dispatches(*, ticket_templates(*))')
      .eq('driver_id', profile!.id)

    const todayDispatches = (assignments.data ?? [])
      .filter(a => (a as any).dispatches?.scheduled_date === today && (a as any).dispatches?.status !== 'cancelled')
      .map(a => ({ ...(a as any).dispatches, dispatch_assignments: [a] }))

    setDispatches(todayDispatches)
    if (todayDispatches.length === 1) {
      await selectDispatch(todayDispatches[0])
    }
    setLoading(false)
  }

  async function selectDispatch(dispatch: DispatchWithAssignment) {
    setSelectedDispatch(dispatch)
    const templateFields = (dispatch as any).ticket_templates?.fields ?? []
    setFields(templateFields)
    setStep(2)
  }

  async function handleScanTag(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanPreview(URL.createObjectURL(file))
    setScanning(true)

    const fd = new FormData()
    fd.append('image', file)
    fd.append('fields', JSON.stringify(fields))

    try {
      const res = await fetch('/api/scan-tag', { method: 'POST', body: fd })
      const { extracted } = await res.json()
      if (extracted) {
        setFormData(prev => ({ ...prev, ...extracted }))
      }
    } catch {}
    setScanning(false)
  }

  function updateField(fieldId: string, value: unknown) {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
    setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n })
  }

  function validate() {
    const newErrors: Record<string, string> = {}
    fields.forEach(field => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = 'This field is required'
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate() || !selectedDispatch || !profile) return
    setSubmitting(true)

    let latitude: number | null = null
    let longitude: number | null = null
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      )
      latitude = pos.coords.latitude
      longitude = pos.coords.longitude
    } catch {}

    const { data, error } = await supabase.from('load_tickets').insert({
      company_id: profile.company_id,
      driver_id: profile.id,
      dispatch_id: selectedDispatch.id,
      client_id: selectedDispatch.client_id,
      job_site_id: selectedDispatch.job_site_id,
      ticket_template_id: selectedDispatch.ticket_template_id,
      form_data: formData,
      photo_urls: photoUrls,
      latitude,
      longitude,
    }).select().single()

    if (!error && data) {
      // Upsert daily log (increment total_loads)
      await supabase.from('daily_logs').upsert({
        company_id: profile.company_id,
        driver_id: profile.id,
        log_date: today,
        total_loads: 1,
        first_check_in: new Date().toISOString(),
        last_check_in: new Date().toISOString(),
      }, { onConflict: 'driver_id,log_date', ignoreDuplicates: false })

      setSuccess(data.id.slice(0, 8).toUpperCase())
    }
    setSubmitting(false)
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-xl font-semibold text-gray-900">Ticket Submitted</h2>
        <p className="text-sm text-gray-500 mt-1">Ticket #{success}</p>
        <p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
        <div className="flex gap-3 mt-8 w-full max-w-xs">
          <button onClick={() => { setSuccess(null); setFormData({}); setStep(dispatches.length === 1 ? 2 : 1) }} className="flex-1 py-3 border border-gray-300 rounded-lg text-sm font-medium">
            Submit Another
          </button>
          <button onClick={() => router.push('/driver')} className="flex-1 py-3 bg-[#1a1a1a] text-white rounded-lg text-sm font-medium">
            Back to Today
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="p-4 animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-lg" />)}</div>
  }

  if (dispatches.length === 0) {
    return (
      <div className="p-4 text-center mt-12">
        <p className="text-gray-500 text-sm">No active dispatches for today.</p>
        <button onClick={() => router.push('/driver')} className="mt-4 text-sm text-gray-700 underline">Back to Today</button>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Step 1: Select dispatch */}
      {step === 1 && (
        <>
          <h1 className="text-xl font-semibold text-gray-900 mb-4">Select Dispatch</h1>
          <div className="space-y-2">
            {dispatches.map(dispatch => (
              <button
                key={dispatch.id}
                onClick={() => selectDispatch(dispatch)}
                className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400"
              >
                <p className="text-sm font-medium text-gray-900">{dispatch.title}</p>
                {dispatch.notes && <p className="text-xs text-gray-500 mt-0.5">{dispatch.notes}</p>}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 2: Fill form */}
      {step === 2 && selectedDispatch && (
        <>
          <div className="flex items-center gap-3 mb-6">
            {dispatches.length > 1 && (
              <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
            )}
            <h1 className="text-xl font-semibold text-gray-900">Load Ticket</h1>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Dispatch</p>
            <p className="text-sm font-medium">{selectedDispatch.title}</p>
          </div>

          {/* Scan Tag */}
          <div className="mb-4">
            <label className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed rounded-lg cursor-pointer text-sm font-medium transition-colors ${scanning ? 'border-gray-300 text-gray-400' : 'border-gray-400 text-gray-700 hover:border-gray-600'}`}>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanTag} disabled={scanning} />
              {scanning ? (
                <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />Scanning tag...</>
              ) : (
                <>📷 Scan Tag / Invoice</>
              )}
            </label>
            {scanPreview && !scanning && (
              <div className="mt-2 flex items-center gap-2">
                <img src={scanPreview} alt="Scanned tag" className="h-12 w-12 object-cover rounded border border-gray-200" />
                <span className="text-xs text-green-700 font-medium">Fields auto-filled — review below</span>
              </div>
            )}
          </div>

          <div className="space-y-4 mb-6">
            {fields.map(field => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>

                {field.type === 'text' && (
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={(formData[field.id] as string) ?? ''}
                    onChange={e => updateField(field.id, e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={field.placeholder}
                    value={(formData[field.id] as string) ?? ''}
                    onChange={e => updateField(field.id, e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                )}

                {field.type === 'dropdown' && (
                  <select
                    value={(formData[field.id] as string) ?? ''}
                    onChange={e => updateField(field.id, e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  >
                    <option value="">Select...</option>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}

                {field.type === 'checkbox' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(formData[field.id])}
                      onChange={e => updateField(field.id, e.target.checked)}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-gray-700">{field.label}</span>
                  </label>
                )}

                {field.type === 'date' && (
                  <input
                    type="date"
                    value={(formData[field.id] as string) ?? ''}
                    onChange={e => updateField(field.id, e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                )}

                {field.type === 'photo' && (
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={e => updateField(field.id, e.target.files?.[0]?.name ?? null)}
                    className="w-full text-sm text-gray-700"
                  />
                )}

                {errors[field.id] && (
                  <p className="mt-1 text-xs text-red-600">{errors[field.id]}</p>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 bg-[#16a34a] text-white text-base font-medium rounded-lg disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </>
      )}
    </div>
  )
}
