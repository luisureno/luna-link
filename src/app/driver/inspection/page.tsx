'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, CheckCircle2, XCircle, Download, Home, AlertTriangle, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'

// ─── 6 categories (+ trailer if applicable) ───────────────────────────────────

const TRUCK_CATEGORIES = [
  {
    id: 'engine',
    label: 'Engine Compartment',
    emoji: '🔧',
    checklist: ['Fluid levels (oil, coolant, power steering, brake fluid)', 'No leaks under hood or on ground', 'Belts — no cracks or fraying', 'Hoses — no wear, cracks, or loose clamps'],
  },
  {
    id: 'steering_suspension',
    label: 'Steering & Suspension',
    emoji: '🔩',
    checklist: ['Steering box and hoses — secure, no leaks', 'Steering linkage — no excessive play or wear', 'Springs, shocks, or air bags — no cracks or damage'],
  },
  {
    id: 'braking',
    label: 'Braking System',
    emoji: '🛑',
    checklist: ['Slack adjusters and pushrods — within spec (≤1" movement)', 'Brake drums — no cracks; linings not worn through', 'Air lines — no leaks, chafing, or improper connections'],
  },
  {
    id: 'tires_wheels',
    label: 'Tires, Wheels & Rims',
    emoji: '🔵',
    checklist: ['Tire condition — no cuts, bulges, or exposed cord', 'Tread depth — min 4/32" steer axle, 2/32" drive/trailer', 'Lug nuts — all present and tight', 'Valve stems — not missing or damaged'],
  },
  {
    id: 'lighting',
    label: 'Lighting & Reflectors',
    emoji: '💡',
    checklist: ['Front — headlights (high/low), turn signals, markers', 'Side — clearance lights and reflectors', 'Rear — brake lights, tail lights, reverse, turn signals'],
  },
  {
    id: 'in_cab',
    label: 'In-Cab Inspection',
    emoji: '🪟',
    checklist: ['Emergency kit — triangles, fire extinguisher, first aid', 'Windshield clear (no obstructing cracks); mirrors adjusted', 'Air brake test — proper pressure build-up, low-pressure warning works'],
  },
]

const TRAILER_CATEGORY = {
  id: 'trailer',
  label: 'Trailer Check',
  emoji: '🔗',
  checklist: [
    'Coupling (king pin) — fifth wheel jaws fully locked',
    'Brake connections (glad hands) — no leaks, properly connected',
    'Trailer lights — all running, brake, and turn signals working',
    'Tires and wheels — condition, tread, lug nuts',
    'Doors or tarps — latches secure, no damage',
    'Landing gear — fully raised, crank secured',
  ],
}

// ─── Types ────────────────────────────────────────────────────────────────────

type VehicleType = 'tractor_only' | 'tractor_trailer'
type Phase = 'vehicle' | 'items' | 'sign' | 'done'
type CategoryResult = { passed: boolean | null; note: string }
type InspectionState = Record<string, CategoryResult>

// ─── Component ───────────────────────────────────────────────────────────────

export default function InspectionPage() {
  const { profile, accountType } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('vehicle')
  const [itemIndex, setItemIndex] = useState(0)
  const [vehicleType, setVehicleType] = useState<VehicleType>('tractor_trailer')
  const [savingVehicle, setSavingVehicle] = useState(false)

  const [results, setResults] = useState<InspectionState>(() => {
    const init: InspectionState = {}
    ;[...TRUCK_CATEGORIES, TRAILER_CATEGORY].forEach(c => { init[c.id] = { passed: null, note: '' } })
    return init
  })

  const [condition, setCondition] = useState<'satisfactory' | 'defects_corrected' | 'no_correction_needed'>('satisfactory')
  const [signature, setSignature] = useState('')
  const [certified, setCertified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [overallStatus, setOverallStatus] = useState<'passed' | 'failed'>('passed')

  useEffect(() => {
    if ((profile as any)?.vehicle_type) setVehicleType((profile as any).vehicle_type)
  }, [profile?.id])

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const activeCategories = [
    ...TRUCK_CATEGORIES,
    ...(vehicleType === 'tractor_trailer' ? [TRAILER_CATEGORY] : []),
  ]
  const total = activeCategories.length
  const currentCat = activeCategories[itemIndex]
  const currentResult = currentCat ? results[currentCat.id] : null
  const isFail = currentResult?.passed === false
  const isPass = currentResult?.passed === true

  function advance() {
    if (itemIndex < total - 1) {
      setItemIndex(i => i + 1)
    } else {
      setPhase('sign')
    }
  }

  function goBack() {
    if (phase === 'items') {
      if (itemIndex > 0) setItemIndex(i => i - 1)
      else setPhase('vehicle')
    } else if (phase === 'sign') {
      setPhase('items')
      setItemIndex(total - 1)
    }
  }

  function handlePass() {
    if (!currentCat) return
    setResults(prev => ({ ...prev, [currentCat.id]: { ...prev[currentCat.id], passed: true } }))
    setTimeout(advance, 220)
  }

  function handleFail() {
    if (!currentCat) return
    setResults(prev => ({ ...prev, [currentCat.id]: { ...prev[currentCat.id], passed: false } }))
  }

  async function selectVehicle(type: VehicleType) {
    setVehicleType(type)
    if (profile) {
      setSavingVehicle(true)
      await supabase.from('users').update({ vehicle_type: type } as any).eq('id', profile.id)
      setSavingVehicle(false)
    }
    setPhase('items')
    setItemIndex(0)
  }

  async function handleSubmit() {
    if (!profile) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const items = activeCategories.map(c => ({
        id: c.id,
        label: c.label,
        passed: results[c.id]?.passed ?? null,
        note: results[c.id]?.note ?? '',
        photo_url: null,
        category: c.id === 'trailer' ? 'trailer' : 'truck',
      }))

      const failed = items.filter(i => i.passed === false)
      const overall_status = failed.length === 0 ? 'passed' : 'failed'
      const now = new Date().toISOString()
      const logDate = now.split('T')[0]

      const pdfRes = await fetch('/api/inspection/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName: profile.full_name,
          driverId: profile.id,
          truckNumber: profile.truck_number,
          companyName: (profile as any)?.companies?.name ?? null,
          inspectedAt: now,
          items,
          overallCondition: condition,
          signature,
          vehicleType,
        }),
      })

      let pdfPublicUrl: string | null = null
      if (pdfRes.ok) {
        const { url } = await pdfRes.json()
        pdfPublicUrl = url ?? null
      }

      // Insert without pdf_url/signature first (columns may not exist yet)
      const { data: inspData, error: inspErr } = await supabase
        .from('pre_trip_inspections')
        .insert({
          company_id: profile.company_id,
          driver_id: profile.id,
          truck_number: profile.truck_number,
          items,
          overall_status,
          inspected_at: now,
        })
        .select()
        .single()

      if (inspErr) throw new Error(inspErr.message)

      // Best-effort: attach pdf_url and signature if columns exist
      if (inspData?.id) {
        await supabase
          .from('pre_trip_inspections')
          .update({ pdf_url: pdfPublicUrl, signature } as any)
          .eq('id', inspData.id)
        // Silently ignore error — columns may not be migrated yet
      }

      await supabase.from('daily_logs').upsert({
        company_id: profile.company_id,
        driver_id: profile.id,
        log_date: logDate,
        pre_trip_status: overall_status,
        pre_trip_inspection_id: inspData?.id ?? null,
      }, { onConflict: 'driver_id,log_date' })

      setPdfUrl(pdfPublicUrl)
      setOverallStatus(overall_status)
      setPhase('done')
    } catch (err: any) {
      setSubmitError(err.message ?? 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Vehicle select ───────────────────────────────────────────────────────────

  if (phase === 'vehicle') {
    return (
      <div className="px-4 pt-6 pb-8">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <ChevronLeft size={16} /> Back
        </button>

        <div className="max-w-sm mx-auto flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-5">
            <Truck size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Pre-Trip Inspection</h1>
          <p className="text-sm text-gray-500 mb-8">What are you operating today?</p>

          <div className="space-y-3 w-full">
            <button
              onClick={() => selectVehicle('tractor_trailer')}
              disabled={savingVehicle}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left bg-white transition-all ${
                vehicleType === 'tractor_trailer' ? 'border-[#1a1a1a]' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <span className="text-2xl">🚛</span>
              <div>
                <p className="font-semibold text-gray-900">Tractor + Trailer</p>
                <p className="text-xs mt-0.5 text-gray-500">Full inspection — truck and trailer</p>
              </div>
              {vehicleType === 'tractor_trailer' && (
                <div className="ml-auto w-4 h-4 rounded-full bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              )}
            </button>

            <button
              onClick={() => selectVehicle('tractor_only')}
              disabled={savingVehicle}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left bg-white transition-all ${
                vehicleType === 'tractor_only' ? 'border-[#1a1a1a]' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <span className="text-2xl">🚚</span>
              <div>
                <p className="font-semibold text-gray-900">Tractor Only</p>
                <p className="text-xs mt-0.5 text-gray-500">Bobtail — truck items only</p>
              </div>
              {vehicleType === 'tractor_only' && (
                <div className="ml-auto w-4 h-4 rounded-full bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Done ─────────────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const passed = overallStatus === 'passed'
    const failedCount = activeCategories.filter(c => results[c.id]?.passed === false).length
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center gap-5 min-h-[60vh]">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${passed ? 'bg-green-100' : 'bg-amber-100'}`}>
          {passed ? <CheckCircle2 size={48} className="text-green-600" /> : <AlertTriangle size={48} className="text-amber-600" />}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{passed ? 'Inspection Passed' : 'Issues Reported'}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {passed ? 'All clear — have a safe day.' : `${failedCount} area${failedCount !== 1 ? 's' : ''} flagged.`}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#1a1a1a] text-white text-sm font-semibold rounded-xl">
              <Download size={16} /> Download PDF Report
            </a>
          )}
          <button onClick={() => router.push('/driver')}
            className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 text-gray-800 text-sm font-semibold rounded-xl">
            <Home size={16} /> Return to Home
          </button>
        </div>
      </div>
    )
  }

  // ─── Sign & Submit ────────────────────────────────────────────────────────────

  if (phase === 'sign') {
    const failedCats = activeCategories.filter(c => results[c.id]?.passed === false)
    const canSubmit = signature.trim().length >= 2 && certified

    return (
      <div>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
            <ChevronLeft size={20} />
          </button>
          <div>
            <p className="text-xs text-gray-400">Final Step</p>
            <h1 className="text-base font-semibold text-gray-900">Sign & Submit</h1>
          </div>
          <div className="ml-auto h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#1a1a1a] rounded-full w-full" />
          </div>
        </div>

        <div className="px-4 pt-4 pb-28 max-w-lg mx-auto space-y-4">
          {/* Summary */}
          <div className={`rounded-xl border p-4 ${failedCats.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}>
            <p className={`text-sm font-semibold ${failedCats.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
              {failedCats.length === 0
                ? `✓ All ${activeCategories.length} areas passed — vehicle is ready.`
                : `⚠ ${failedCats.length} area${failedCats.length !== 1 ? 's' : ''} flagged:`}
            </p>
            {failedCats.length > 0 && (
              <ul className="mt-2 space-y-1">
                {failedCats.map(c => (
                  <li key={c.id} className="text-xs text-amber-700">
                    • <span className="font-medium">{c.label}</span>
                    {results[c.id]?.note ? ` — ${results[c.id].note}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Condition */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Overall Vehicle Condition</p>
            <div className="space-y-2.5">
              {([
                ['satisfactory',         'Vehicle condition is satisfactory.'],
                ['defects_corrected',    'Above defects have been corrected.'],
                ['no_correction_needed', 'Defects need NOT be corrected for safe operation.'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                    condition === key ? 'border-[#1a1a1a] bg-[#1a1a1a]' : 'border-gray-300'
                  }`}>
                    {condition === key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm text-gray-700">{label}</span>
                  <input type="radio" name="condition" value={key} checked={condition === key} onChange={() => setCondition(key)} className="sr-only" />
                </label>
              ))}
            </div>
          </div>

          {/* Signature */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900 mb-1">Driver's Signature</p>
            <p className="text-xs text-gray-500 mb-3">Type your full legal name to sign.</p>
            <input
              type="text"
              value={signature}
              onChange={e => setSignature(e.target.value)}
              placeholder="Full legal name"
              className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base italic text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]"
            />
          </div>

          {/* Certify */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={certified} onChange={e => setCertified(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#1a1a1a]" />
            <p className="text-xs text-gray-600 leading-relaxed">
              I certify that I have inspected this vehicle in accordance with FMCSA requirements and it is in the condition indicated above.
            </p>
          </label>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-4 bg-[#1a1a1a] text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating report…
              </span>
            ) : 'Submit & Generate PDF Report'}
          </button>
        </div>
      </div>
    )
  }

  // ─── Item-by-item ─────────────────────────────────────────────────────────────

  if (!currentCat) return null

  return (
    <div>
      {/* Sticky header with progress */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={goBack} className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium">{itemIndex + 1} of {total}</p>
          </div>
          {/* Dot progress */}
          <div className="flex items-center gap-1.5">
            {activeCategories.map((c, i) => (
              <div key={c.id} className={`rounded-full transition-all ${
                i < itemIndex ? 'w-2 h-2 bg-green-500' :
                i === itemIndex ? 'w-2.5 h-2.5 bg-[#1a1a1a]' :
                'w-2 h-2 bg-gray-200'
              }`} />
            ))}
          </div>
        </div>
        <div className="h-0.5 bg-gray-100">
          <div className="h-0.5 bg-[#1a1a1a] transition-all duration-300"
            style={{ width: `${((itemIndex) / total) * 100}%` }} />
        </div>
      </div>

      {/* Item content */}
      <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
        {/* Category label */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {currentCat.emoji} {currentCat.label}
        </p>

        {/* Checklist — what to look for */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-2">What to check</p>
          <ul className="space-y-1.5">
            {currentCat.checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-900">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Pass / Fail */}
        <p className="text-sm font-medium text-gray-500 text-center mb-3">How does it look?</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handlePass}
            className={`flex flex-col items-center justify-center gap-2 py-7 rounded-2xl border-2 font-semibold text-base transition-all active:scale-95 ${
              isPass
                ? 'border-green-500 bg-green-500 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50'
            }`}
          >
            <CheckCircle2 size={30} className={isPass ? 'text-white' : 'text-green-500'} />
            Good
          </button>
          <button
            onClick={handleFail}
            className={`flex flex-col items-center justify-center gap-2 py-7 rounded-2xl border-2 font-semibold text-base transition-all active:scale-95 ${
              isFail
                ? 'border-red-500 bg-red-500 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'
            }`}
          >
            <XCircle size={30} className={isFail ? 'text-white' : 'text-red-500'} />
            Issue
          </button>
        </div>

        {/* Notes — shown on fail */}
        {isFail && (
          <div className="mt-4 space-y-3">
            <textarea
              value={currentResult?.note ?? ''}
              onChange={e => setResults(prev => ({ ...prev, [currentCat.id]: { ...prev[currentCat.id], note: e.target.value } }))}
              placeholder="Describe the issue..."
              rows={3}
              autoFocus
              className="w-full px-4 py-3 border border-red-200 rounded-xl text-sm text-gray-900 bg-red-50 placeholder-red-300 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button
              onClick={advance}
              className="w-full py-4 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors"
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
