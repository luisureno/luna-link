'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, CheckCircle2, XCircle, Download, Home, AlertTriangle, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'

// ─── Checklist ────────────────────────────────────────────────────────────────

const TRUCK_ITEMS = [
  { id: 'air_compressor',    label: 'Air Compressor',             description: 'Listen for proper pressure build-up (90–120 psi). Check lines and fittings for leaks.' },
  { id: 'air_lines',         label: 'Air Lines',                  description: 'Inspect for cracks, chafing, or improper connections. No air leaks when brakes are applied.' },
  { id: 'battery',           label: 'Battery',                    description: 'Check for secure mounting, no corrosion on terminals, and adequate fluid level.' },
  { id: 'brake_accessories', label: 'Brake Accessories',          description: 'Emergency brake equipment must be accessible and fully functional.' },
  { id: 'brakes',            label: 'Brakes',                     description: 'Check brake adjustment and air pressure (must exceed 90 psi). Test service and trailer brakes.' },
  { id: 'clutch',            label: 'Clutch',                     description: 'Test for smooth engagement and proper free play (1–2 inches).' },
  { id: 'defroster',         label: 'Defroster / Heater',         description: 'Verify defrost and heater operate correctly. Check blower, hoses, and controls.' },
  { id: 'drive_line',        label: 'Drive Line',                 description: 'Inspect U-joints for wear. Drive shaft must be secure with no cracks or missing parts.' },
  { id: 'engine',            label: 'Engine',                     description: 'Check oil, coolant, and power steering fluid. Look for leaks; inspect belts and hoses.' },
  { id: 'fifth_wheel',       label: 'Fifth Wheel',                description: 'Verify locking jaws fully engage around the kingpin. Check lubrication and mounting bolts.' },
  { id: 'front_axle',        label: 'Front Axle',                 description: 'Look for cracks, bends, or impact damage. Inspect bushings and alignment.' },
  { id: 'fuel_tanks',        label: 'Fuel Tanks',                 description: 'Inspect for leaks, ensure cap is secure, and check mounting straps.' },
  { id: 'horn',              label: 'Horn',                       description: 'Test both air horn and electric horn for proper operation.' },
  { id: 'lights',            label: 'Lights (Head, Stop, Tail, Turn)', description: 'Test all lights: headlights (high/low beam), brake lights, tail lights, turn signals, hazards, and marker lights.' },
  { id: 'mirrors',           label: 'Mirrors',                    description: 'Adjust for clear view of both sides and rear. Check for cracks or loose mounts.' },
  { id: 'muffler',           label: 'Muffler / Exhaust',          description: 'Check for secure mounting and no exhaust leaks into cab. Listen for unusual noise.' },
  { id: 'oil_pressure',      label: 'Oil Pressure',               description: 'Start engine and verify gauge reads within normal range (40–70 psi typically).' },
  { id: 'radiator',          label: 'Radiator',                   description: 'Check coolant level, inspect hoses for cracks or bulges, and verify cap is secure.' },
  { id: 'rear_end',          label: 'Rear End',                   description: 'Check for fluid leaks around the differential. Listen for unusual sounds.' },
  { id: 'reflectors',        label: 'Reflectors',                 description: 'Verify all required reflectors are present, clean, and properly positioned.' },
  { id: 'safety_equipment',  label: 'Safety Equipment',           description: 'Check fire extinguisher charge, warning triangles or flares, and spare fuses and bulbs.' },
  { id: 'springs',           label: 'Springs',                    description: 'Inspect for cracks, broken leaves, U-bolt damage, or improper alignment.' },
  { id: 'starter',           label: 'Starter',                    description: 'Engine should start without excessive cranking or unusual sounds.' },
  { id: 'steering',          label: 'Steering',                   description: 'Check for excessive play (max 10° or 2 inches at wheel). Inspect fluid level and steering hoses.' },
  { id: 'tires',             label: 'Tires',                      description: 'Check tread depth (min 4/32" steer axle, 2/32" others), inflation, sidewall damage, and valve stems.' },
  { id: 'transmission',      label: 'Transmission',               description: 'Check fluid level if accessible. Listen for unusual noises and ensure smooth shifting.' },
  { id: 'wheels_rims',       label: 'Wheels & Rims',              description: 'Inspect lug nuts for tightness. Check rims for cracks, bends, or missing hardware.' },
  { id: 'windows',           label: 'Windows / Windshield',       description: 'No cracks larger than allowable limits. Clear and clean for full visibility.' },
  { id: 'wipers',            label: 'Windshield Wipers',          description: 'Test wiper operation at all speeds and washer fluid. Check blade condition.' },
]

const TRAILER_ITEMS = [
  { id: 'tr_brake_connections', label: 'Brake Connections',    description: 'Check glad hands are locked. Hoses must not be leaking. Emergency and service lines properly connected.' },
  { id: 'tr_brakes',            label: 'Trailer Brakes',       description: 'Test brake adjustment and operation. Verify slack adjusters are within spec.' },
  { id: 'tr_coupling_chains',   label: 'Coupling Chains',      description: 'Verify safety chains are properly hooked and crossed with minimal slack.' },
  { id: 'tr_coupling_pin',      label: 'Coupling (King) Pin',  description: 'Inspect for wear or cracks. Confirm fifth wheel jaws are fully locked.' },
  { id: 'tr_doors',             label: 'Doors',                description: 'Check latches are secure, hinges in good condition, and doors seal properly.' },
  { id: 'tr_hitch',             label: 'Hitch',                description: 'Verify all hitch components are secure and connections properly made.' },
  { id: 'tr_landing_gear',      label: 'Landing Gear',         description: 'Must be fully raised and crank secured. Check for bends, damage, or loose mounting.' },
  { id: 'tr_lights',            label: 'Lights – All',         description: 'Test all trailer lights: running, brake, turn signals, and clearance lights.' },
  { id: 'tr_roof',              label: 'Roof',                 description: 'Inspect for damage, holes, or openings that could affect cargo or allow weather entry.' },
  { id: 'tr_springs',           label: 'Springs',              description: 'Inspect suspension springs for cracks or broken leaves.' },
  { id: 'tr_tarpaulin',         label: 'Tarpaulin',            description: 'If applicable, verify secure covering and proper tie-down straps.' },
  { id: 'tr_tires',             label: 'Tires',                description: 'Check tread depth, inflation, sidewall condition, and valve stems on all tires.' },
  { id: 'tr_wheels',            label: 'Wheels',               description: 'Inspect lug nuts for proper torque and rims for any damage.' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type VehicleType = 'tractor_only' | 'tractor_trailer'
type Phase = 'vehicle' | 'truck' | 'trailer' | 'sign' | 'done'
type ItemResult = { passed: boolean | null; note: string }
type InspectionState = Record<string, ItemResult>

// ─── Component ───────────────────────────────────────────────────────────────

export default function InspectionPage() {
  const { profile, accountType } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const homePath = '/driver'

  // Flow state
  const [phase, setPhase] = useState<Phase>('vehicle')
  const [itemIndex, setItemIndex] = useState(0)
  const [vehicleType, setVehicleType] = useState<VehicleType>(
    (profile as any)?.vehicle_type ?? 'tractor_trailer'
  )
  const [savingVehicle, setSavingVehicle] = useState(false)

  // Item results
  const [results, setResults] = useState<InspectionState>(() => {
    const init: InspectionState = {}
    ;[...TRUCK_ITEMS, ...TRAILER_ITEMS].forEach(i => { init[i.id] = { passed: null, note: '' } })
    return init
  })

  // Sign step
  const [condition, setCondition] = useState<'satisfactory' | 'defects_corrected' | 'no_correction_needed'>('satisfactory')
  const [signature, setSignature] = useState('')
  const [certified, setCertified] = useState(false)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [overallStatus, setOverallStatus] = useState<'passed' | 'failed'>('passed')

  // Sync vehicle type from profile once loaded
  useEffect(() => {
    if ((profile as any)?.vehicle_type) {
      setVehicleType((profile as any).vehicle_type)
    }
  }, [profile?.id])

  // ─── Navigation helpers ──────────────────────────────────────────────────────

  const currentItems = phase === 'truck' ? TRUCK_ITEMS : TRAILER_ITEMS
  const currentItem = currentItems[itemIndex]
  const currentResult = currentItem ? results[currentItem.id] : null

  function advance() {
    if (phase === 'truck') {
      if (itemIndex < TRUCK_ITEMS.length - 1) {
        setItemIndex(i => i + 1)
      } else if (vehicleType === 'tractor_trailer') {
        setPhase('trailer')
        setItemIndex(0)
      } else {
        setPhase('sign')
      }
    } else if (phase === 'trailer') {
      if (itemIndex < TRAILER_ITEMS.length - 1) {
        setItemIndex(i => i + 1)
      } else {
        setPhase('sign')
      }
    }
  }

  function goBack() {
    if (phase === 'truck') {
      if (itemIndex > 0) {
        setItemIndex(i => i - 1)
      } else {
        setPhase('vehicle')
      }
    } else if (phase === 'trailer') {
      if (itemIndex > 0) {
        setItemIndex(i => i - 1)
      } else {
        setPhase('truck')
        setItemIndex(TRUCK_ITEMS.length - 1)
      }
    } else if (phase === 'sign') {
      if (vehicleType === 'tractor_trailer') {
        setPhase('trailer')
        setItemIndex(TRAILER_ITEMS.length - 1)
      } else {
        setPhase('truck')
        setItemIndex(TRUCK_ITEMS.length - 1)
      }
    }
  }

  function handlePass() {
    if (!currentItem) return
    setResults(prev => ({ ...prev, [currentItem.id]: { ...prev[currentItem.id], passed: true } }))
    setTimeout(advance, 220)
  }

  function handleFail() {
    if (!currentItem) return
    setResults(prev => ({ ...prev, [currentItem.id]: { ...prev[currentItem.id], passed: false } }))
  }

  function setNote(note: string) {
    if (!currentItem) return
    setResults(prev => ({ ...prev, [currentItem.id]: { ...prev[currentItem.id], note } }))
  }

  // ─── Vehicle select ──────────────────────────────────────────────────────────

  async function selectVehicle(type: VehicleType) {
    setVehicleType(type)
    if (profile) {
      setSavingVehicle(true)
      await supabase.from('users').update({ vehicle_type: type } as any).eq('id', profile.id)
      setSavingVehicle(false)
    }
    setPhase('truck')
    setItemIndex(0)
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!profile) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const activeItems = [
        ...TRUCK_ITEMS.map(i => ({ ...i, category: 'truck' as const })),
        ...(vehicleType === 'tractor_trailer' ? TRAILER_ITEMS.map(i => ({ ...i, category: 'trailer' as const })) : []),
      ].map(i => ({
        id: i.id,
        label: i.label,
        passed: results[i.id]?.passed ?? null,
        note: results[i.id]?.note ?? '',
        photo_url: null,
        category: i.category,
      }))

      const failed = activeItems.filter(i => i.passed === false)
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
          items: activeItems,
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

      const { data: inspData, error: inspErr } = await supabase
        .from('pre_trip_inspections')
        .insert({
          company_id: profile.company_id,
          driver_id: profile.id,
          truck_number: profile.truck_number,
          items: activeItems,
          overall_status,
          inspected_at: now,
          pdf_url: pdfPublicUrl,
          signature,
        })
        .select()
        .single()

      if (inspErr) throw new Error(inspErr.message)

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
      setSubmitError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Progress calculation ─────────────────────────────────────────────────────

  const totalTruck = TRUCK_ITEMS.length
  const totalTrailer = vehicleType === 'tractor_trailer' ? TRAILER_ITEMS.length : 0
  const totalItems = totalTruck + totalTrailer
  const doneCount =
    phase === 'truck' ? itemIndex :
    phase === 'trailer' ? totalTruck + itemIndex :
    phase === 'sign' || phase === 'done' ? totalItems : 0
  const progressPct = totalItems > 0 ? (doneCount / totalItems) * 100 : 0

  const sectionLabel =
    phase === 'truck' ? `Truck & Tractor — ${itemIndex + 1} of ${totalTruck}` :
    phase === 'trailer' ? `Trailer — ${itemIndex + 1} of ${totalTrailer}` :
    phase === 'sign' ? 'Sign & Submit' : ''

  // ─── Render: Vehicle select ───────────────────────────────────────────────────

  if (phase === 'vehicle') {
    return (
      <div className="flex flex-col min-h-screen bg-[#F8F7F5]">
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-base font-semibold text-gray-900">Pre-Trip Inspection</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-sm mx-auto w-full">
          <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-6">
            <Truck size={28} className="text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">What are you operating today?</h2>
          <p className="text-sm text-gray-500 text-center mb-8">
            This determines which sections of the inspection you'll complete.
          </p>

          <div className="w-full space-y-3">
            <button
              onClick={() => selectVehicle('tractor_trailer')}
              disabled={savingVehicle}
              className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-colors ${
                vehicleType === 'tractor_trailer'
                  ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
                  : 'border-gray-200 bg-white hover:border-gray-400'
              }`}
            >
              <span className="text-2xl mt-0.5">🚛</span>
              <div>
                <p className={`font-semibold text-base ${vehicleType === 'tractor_trailer' ? 'text-white' : 'text-gray-900'}`}>
                  Tractor + Trailer
                </p>
                <p className={`text-sm mt-0.5 ${vehicleType === 'tractor_trailer' ? 'text-white/70' : 'text-gray-500'}`}>
                  Semi with a trailer attached — full inspection including trailer items
                </p>
              </div>
            </button>

            <button
              onClick={() => selectVehicle('tractor_only')}
              disabled={savingVehicle}
              className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-colors ${
                vehicleType === 'tractor_only'
                  ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
                  : 'border-gray-200 bg-white hover:border-gray-400'
              }`}
            >
              <span className="text-2xl mt-0.5">🚚</span>
              <div>
                <p className={`font-semibold text-base ${vehicleType === 'tractor_only' ? 'text-white' : 'text-gray-900'}`}>
                  Tractor Only
                </p>
                <p className={`text-sm mt-0.5 ${vehicleType === 'tractor_only' ? 'text-white/70' : 'text-gray-500'}`}>
                  Bobtail / no trailer — truck items only
                </p>
              </div>
            </button>
          </div>

          {(profile as any)?.vehicle_type && (
            <p className="text-xs text-gray-400 mt-5 text-center">
              Last used: {(profile as any).vehicle_type === 'tractor_only' ? 'Tractor Only' : 'Tractor + Trailer'}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ─── Render: Done ─────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const passed = overallStatus === 'passed'
    const failedCount = [...TRUCK_ITEMS, ...(vehicleType === 'tractor_trailer' ? TRAILER_ITEMS : [])].filter(
      i => results[i.id]?.passed === false
    ).length
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F7F5] p-6 text-center gap-5">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${passed ? 'bg-green-100' : 'bg-amber-100'}`}>
          {passed ? <CheckCircle2 size={48} className="text-green-600" /> : <AlertTriangle size={48} className="text-amber-600" />}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{passed ? 'Inspection Passed' : 'Issues Reported'}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {passed
              ? 'All items cleared. Have a safe day.'
              : `${failedCount} issue${failedCount !== 1 ? 's' : ''} flagged — dispatcher has been notified.`}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#1a1a1a] text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors"
            >
              <Download size={16} />
              Download Inspection Report (PDF)
            </a>
          )}
          <button
            onClick={() => router.push(homePath)}
            className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 text-gray-800 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            <Home size={16} />
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  // ─── Render: Sign & Submit ────────────────────────────────────────────────────

  if (phase === 'sign') {
    const allItems = [...TRUCK_ITEMS, ...(vehicleType === 'tractor_trailer' ? TRAILER_ITEMS : [])]
    const failedItems = allItems.filter(i => results[i.id]?.passed === false)
    const canSubmit = signature.trim().length >= 2 && certified

    return (
      <div className="flex flex-col min-h-screen bg-[#F8F7F5]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={goBack} className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100">
              <ChevronLeft size={20} />
            </button>
            <div>
              <p className="text-xs text-gray-400 font-medium">Final Step</p>
              <h1 className="text-base font-semibold text-gray-900">Sign & Submit</h1>
            </div>
          </div>
          <div className="h-1 bg-[#1a1a1a]" />
        </div>

        <div className="flex-1 px-4 pt-4 pb-32 max-w-lg mx-auto w-full space-y-5">
          {/* Summary */}
          <div className={`rounded-xl border p-4 ${failedItems.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}>
            <p className={`text-sm font-semibold ${failedItems.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
              {failedItems.length === 0
                ? `✓ All ${allItems.length} items passed — vehicle is ready for service.`
                : `⚠ ${failedItems.length} issue${failedItems.length !== 1 ? 's' : ''} flagged:`}
            </p>
            {failedItems.length > 0 && (
              <ul className="mt-2 space-y-1">
                {failedItems.map(i => (
                  <li key={i.id} className="text-xs text-amber-700 flex gap-1.5">
                    <span className="mt-0.5 flex-shrink-0">•</span>
                    <span><span className="font-medium">{i.label}</span>{results[i.id]?.note ? ` — ${results[i.id].note}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Overall condition */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Overall Vehicle Condition</p>
            <div className="space-y-2">
              {([
                ['satisfactory',        'Condition of vehicle is satisfactory.'],
                ['defects_corrected',   'Above defects have been corrected.'],
                ['no_correction_needed','Defects need NOT be corrected for safe operation.'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    condition === key ? 'border-[#1a1a1a] bg-[#1a1a1a]' : 'border-gray-300 group-hover:border-gray-500'
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
            <p className="text-xs text-gray-500 mb-3">Type your full legal name to sign this report.</p>
            <input
              type="text"
              value={signature}
              onChange={e => setSignature(e.target.value)}
              placeholder="Full legal name"
              className="w-full px-3 py-3 border border-gray-200 rounded-lg text-base italic text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]"
            />
            {signature.trim() && (
              <p className="mt-2 text-xs text-gray-400">Signed as: <span className="italic">{signature.trim()}</span></p>
            )}
          </div>

          {/* Certification */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={certified} onChange={e => setCertified(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#1a1a1a]" />
            <p className="text-xs text-gray-600 leading-relaxed">
              I certify that I have inspected the above vehicle(s) in accordance with applicable FMCSA requirements and to the best of my knowledge the vehicle is in the condition indicated above.
            </p>
          </label>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full py-3.5 bg-[#1a1a1a] text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
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
      </div>
    )
  }

  // ─── Render: Item-by-item ─────────────────────────────────────────────────────

  if (!currentItem) return null
  const isFail = currentResult?.passed === false
  const isPass = currentResult?.passed === true

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7F5]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={goBack} className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium">{sectionLabel}</p>
            <div className="text-xs text-gray-300 mt-0.5">
              {vehicleType === 'tractor_trailer'
                ? `${doneCount} of ${totalItems} total`
                : `${doneCount} of ${totalItems} items`}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div className="h-1 bg-[#1a1a1a] transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Item card — centered, large, easy to read */}
      <div className="flex-1 flex flex-col justify-between px-4 pt-8 pb-8 max-w-lg mx-auto w-full">
        <div className="flex-1 flex flex-col justify-center">
          {/* Category badge */}
          <span className="inline-flex self-start items-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            {phase === 'truck' ? '🚛 Truck & Tractor' : '🔗 Trailer'}
          </span>

          {/* Item name */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">{currentItem.label}</h2>

          {/* What to look for */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">What to check</p>
            <p className="text-sm text-blue-900 leading-relaxed">{currentItem.description}</p>
          </div>

          {/* Pass / Fail buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handlePass}
              className={`flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 font-semibold text-base transition-all ${
                isPass
                  ? 'border-green-500 bg-green-500 text-white scale-[0.98]'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-green-400 hover:bg-green-50 active:scale-[0.97]'
              }`}
            >
              <CheckCircle2 size={28} className={isPass ? 'text-white' : 'text-green-500'} />
              Pass
            </button>
            <button
              onClick={handleFail}
              className={`flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 font-semibold text-base transition-all ${
                isFail
                  ? 'border-red-500 bg-red-500 text-white scale-[0.98]'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-red-400 hover:bg-red-50 active:scale-[0.97]'
              }`}
            >
              <XCircle size={28} className={isFail ? 'text-white' : 'text-red-500'} />
              Fail
            </button>
          </div>

          {/* Notes — shown when fail */}
          {isFail && (
            <div className="mt-4 space-y-3">
              <textarea
                value={currentResult?.note ?? ''}
                onChange={e => setNote(e.target.value)}
                placeholder="Describe the issue (required)..."
                rows={3}
                autoFocus
                className="w-full px-4 py-3 border border-red-200 rounded-xl text-sm text-gray-900 bg-red-50 placeholder-red-300 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button
                onClick={advance}
                className="w-full py-3.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors"
              >
                Continue →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
