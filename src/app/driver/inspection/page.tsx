'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Download, Home, AlertTriangle } from 'lucide-react'
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
  { id: 'starter',           label: 'Starter',                   description: 'Engine should start without excessive cranking or unusual sounds.' },
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

type ItemResult = { passed: boolean | null; note: string }
type InspectionState = Record<string, ItemResult>

const STEPS = [
  { key: 'truck',   label: 'Truck & Tractor', items: TRUCK_ITEMS },
  { key: 'trailer', label: 'Trailer',          items: TRAILER_ITEMS },
  { key: 'sign',    label: 'Sign & Submit',    items: [] },
] as const

// ─── Component ───────────────────────────────────────────────────────────────

export default function InspectionPage() {
  const { profile, accountType } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const homePath = accountType === 'solo' ? '/driver' : '/driver'

  // State
  const [step, setStep] = useState(0)
  const [results, setResults] = useState<InspectionState>(() => {
    const init: InspectionState = {}
    ;[...TRUCK_ITEMS, ...TRAILER_ITEMS].forEach(item => {
      init[item.id] = { passed: null, note: '' }
    })
    return init
  })
  const [condition, setCondition] = useState<'satisfactory' | 'defects_corrected' | 'no_correction_needed'>('satisfactory')
  const [signature, setSignature] = useState('')
  const [certified, setCertified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [overallStatus, setOverallStatus] = useState<'passed' | 'failed'>('passed')

  function setResult(id: string, patch: Partial<ItemResult>) {
    setResults(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  // Step validation
  const currentItems = STEPS[step].items as typeof TRUCK_ITEMS
  const answeredCount = currentItems.filter(i => results[i.id]?.passed !== null).length
  const stepComplete = step < 2 ? answeredCount === currentItems.length : (signature.trim().length >= 2 && certified)

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!profile) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const allItems = [
        ...TRUCK_ITEMS.map(i => ({ ...i, category: 'truck' as const })),
        ...TRAILER_ITEMS.map(i => ({ ...i, category: 'trailer' as const })),
      ].map(i => ({
        id: i.id,
        label: i.label,
        passed: results[i.id].passed,
        note: results[i.id].note,
        photo_url: null,
        category: i.category,
      }))

      const failed = allItems.filter(i => i.passed === false)
      const overall_status = failed.length === 0 ? 'passed' : 'failed'
      const now = new Date().toISOString()
      const logDate = now.split('T')[0]

      // Generate PDF via API route
      const pdfRes = await fetch('/api/inspection/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName: profile.full_name,
          driverId: profile.id,
          truckNumber: profile.truck_number,
          companyName: (profile as any)?.companies?.name ?? null,
          inspectedAt: now,
          items: allItems,
          overallCondition: condition,
          signature,
        }),
      })

      let pdfPublicUrl: string | null = null
      if (pdfRes.ok) {
        const { url } = await pdfRes.json()
        pdfPublicUrl = url ?? null
      }

      // Save inspection record
      const { data: inspData, error: inspErr } = await supabase
        .from('pre_trip_inspections')
        .insert({
          company_id: profile.company_id,
          driver_id: profile.id,
          truck_number: profile.truck_number,
          items: allItems,
          overall_status,
          inspected_at: now,
          pdf_url: pdfPublicUrl,
          signature,
        })
        .select()
        .single()

      if (inspErr) throw new Error(inspErr.message)

      // Update daily log
      await supabase.from('daily_logs').upsert({
        company_id: profile.company_id,
        driver_id: profile.id,
        log_date: logDate,
        pre_trip_status: overall_status,
        pre_trip_inspection_id: inspData?.id ?? null,
      }, { onConflict: 'driver_id,log_date' })

      setPdfUrl(pdfPublicUrl)
      setOverallStatus(overall_status)
      setDone(true)
    } catch (err: any) {
      setSubmitError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Done screen ─────────────────────────────────────────────────────────────

  if (done) {
    const passed = overallStatus === 'passed'
    const failedCount = [...TRUCK_ITEMS, ...TRAILER_ITEMS].filter(i => results[i.id]?.passed === false).length
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center gap-5">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${passed ? 'bg-green-100' : 'bg-amber-100'}`}>
          {passed
            ? <CheckCircle2 size={48} className="text-green-600" />
            : <AlertTriangle size={48} className="text-amber-600" />}
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
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#1a1a1a] text-white text-sm font-medium rounded-lg hover:bg-black transition-colors"
            >
              <Download size={16} />
              Download Inspection Report (PDF)
            </a>
          )}
          <button
            onClick={() => router.push(homePath)}
            className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Home size={16} />
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  // ─── Step render helpers ──────────────────────────────────────────────────────

  function renderItemStep(items: typeof TRUCK_ITEMS) {
    return (
      <div className="space-y-3 pb-4">
        {items.map(item => {
          const res = results[item.id]
          const isFail = res.passed === false
          const isPass = res.passed === true
          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl border transition-colors ${
                isFail ? 'border-red-300' : isPass ? 'border-green-300' : 'border-gray-200'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{item.description}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 mt-0.5">
                    <button
                      onClick={() => setResult(item.id, { passed: true })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isPass
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      Pass
                    </button>
                    <button
                      onClick={() => setResult(item.id, { passed: false })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isFail
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-700'
                      }`}
                    >
                      <XCircle size={13} />
                      Fail
                    </button>
                  </div>
                </div>

                {isFail && (
                  <textarea
                    value={res.note}
                    onChange={e => setResult(item.id, { note: e.target.value })}
                    placeholder="Describe the issue (required for failed items)..."
                    rows={2}
                    className="w-full mt-1 px-3 py-2 border border-red-200 rounded-lg text-sm text-gray-900 bg-red-50 placeholder-red-300 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderSignStep() {
    const allItems = [...TRUCK_ITEMS, ...TRAILER_ITEMS]
    const failedItems = allItems.filter(i => results[i.id]?.passed === false)

    return (
      <div className="space-y-5 pb-4">
        {/* Summary */}
        <div className={`rounded-xl border p-4 ${failedItems.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}>
          <p className={`text-sm font-semibold ${failedItems.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
            {failedItems.length === 0
              ? '✓ All items passed — vehicle is ready for service.'
              : `⚠ ${failedItems.length} issue${failedItems.length !== 1 ? 's' : ''} flagged:`}
          </p>
          {failedItems.length > 0 && (
            <ul className="mt-2 space-y-1">
              {failedItems.map(i => (
                <li key={i.id} className="text-xs text-amber-700 flex gap-1.5">
                  <span className="mt-0.5 flex-shrink-0">•</span>
                  <span><span className="font-medium">{i.label}</span>{results[i.id].note ? ` — ${results[i.id].note}` : ''}</span>
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
              ['satisfactory',          'Condition of vehicle is satisfactory.'],
              ['defects_corrected',      'Above defects have been corrected.'],
              ['no_correction_needed',   'Defects need NOT be corrected for safe operation.'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  condition === key ? 'border-[#1a1a1a] bg-[#1a1a1a]' : 'border-gray-300 group-hover:border-gray-500'
                }`}>
                  {condition === key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-sm text-gray-700">{label}</span>
                <input
                  type="radio"
                  name="condition"
                  value={key}
                  checked={condition === key}
                  onChange={() => setCondition(key)}
                  className="sr-only"
                />
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
          <div className="mt-0.5">
            <input
              type="checkbox"
              checked={certified}
              onChange={e => setCertified(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-[#1a1a1a]"
            />
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            I certify that I have inspected the above vehicle(s) in accordance with applicable requirements and to the best of my knowledge, the vehicle(s) is in the condition indicated above.
          </p>
        </label>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}
      </div>
    )
  }

  // ─── Layout ──────────────────────────────────────────────────────────────────

  const isLastStep = step === 2
  const totalItems = step === 0 ? TRUCK_ITEMS.length : step === 1 ? TRAILER_ITEMS.length : 0

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7F5]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
            className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium">Step {step + 1} of 3</p>
            <h1 className="text-base font-semibold text-gray-900 truncate">{STEPS[step].label}</h1>
          </div>
          {totalItems > 0 && (
            <span className="text-xs text-gray-400 font-medium flex-shrink-0">
              {answeredCount}/{totalItems}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-[#1a1a1a] transition-all duration-300"
            style={{ width: `${((step + (stepComplete ? 1 : answeredCount / Math.max(totalItems, 1))) / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-4 pb-32 max-w-lg mx-auto w-full">
        {step === 0 && renderItemStep(TRUCK_ITEMS)}
        {step === 1 && renderItemStep(TRAILER_ITEMS)}
        {step === 2 && renderSignStep()}
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 pb-safe">
        <div className="max-w-lg mx-auto">
          {isLastStep ? (
            <button
              onClick={handleSubmit}
              disabled={!stepComplete || submitting}
              className="w-full py-3.5 bg-[#1a1a1a] text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating report…
                </span>
              ) : (
                'Submit & Generate PDF Report'
              )}
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!stepComplete}
              className="w-full py-3.5 bg-[#1a1a1a] text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              Next: {STEPS[step + 1].label}
              <ChevronRight size={16} />
            </button>
          )}
          {!stepComplete && !isLastStep && (
            <p className="text-center text-xs text-gray-400 mt-2">
              {totalItems - answeredCount} item{totalItems - answeredCount !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
