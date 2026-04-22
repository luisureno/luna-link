'use client'

import { useEffect, useMemo , useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, FileText, CheckCircle, AlertTriangle, X } from 'lucide-react'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { enqueue, getPendingCount } from '@/lib/offline-queue'
import type { Dispatch, DispatchAssignment } from '@/types'

type SubmitPath = 'scan_invoice' | 'digital' | null

interface BillingConfig {
  id: string
  billing_type: 'hourly'
  client_rate_amount: number
  client_rate_unit: string
  job_type_name: string
}

interface DispatchFull extends Dispatch {
  dispatch_assignments: DispatchAssignment[]
  billing_config: BillingConfig | null
  clients: { id: string; name: string } | null
  job_sites: { id: string; name: string; address?: string } | null
}

interface TimesheetForm {
  arrived_at: string
  departed_at: string
  notes: string
  client_signer_name: string
}

const emptyForm: TimesheetForm = {
  arrived_at: '',
  departed_at: '',
  notes: '',
  client_signer_name: '',
}

function calcHours(arrived: string, departed: string): number | null {
  if (!arrived || !departed) return null
  const a = new Date(arrived).getTime()
  const d = new Date(departed).getTime()
  if (isNaN(a) || isNaN(d) || d <= a) return null
  return parseFloat(new Decimal(d - a).div(3600000).toFixed(2))
}

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TimesheetPage() {
  const { profile, accountType } = useAuth()
  const homePath = accountType === 'solo' ? '/dashboard/solo' : '/driver'
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sigPadRef = useRef<{ drawing: boolean; lastX: number; lastY: number }>({ drawing: false, lastX: 0, lastY: 0 })

  const [dispatches, setDispatches] = useState<DispatchFull[]>([])
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchFull | null>(null)
  const [submitPath, setSubmitPath] = useState<SubmitPath>(null)
  const [form, setForm] = useState<TimesheetForm>(emptyForm)
  const [aiWarning, setAiWarning] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(true)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const [scannedInvoiceUrl, setScannedInvoiceUrl] = useState<string | null>(null)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const up = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  useEffect(() => {
    setPendingCount(getPendingCount())
  }, [])

  useEffect(() => {
    if (!profile) return
    async function load() {
      const { data } = await supabase
        .from('dispatches')
        .select(`
          *,
          dispatch_assignments!inner(driver_id, status),
          billing_config:billing_config_id(*),
          clients(id, name),
          job_sites(id, name, address)
        `)
        .eq('dispatch_assignments.driver_id', profile!.id)
        .eq('work_date', today)
        .in('status', ['active', 'pending'])
      // Only show hourly billing dispatches on this page
      const hourly = ((data ?? []) as unknown as DispatchFull[]).filter(
        d => (d.billing_config as BillingConfig | null)?.billing_type === 'hourly'
      )
      setDispatches(hourly)
      if (hourly.length === 1) setSelectedDispatch(hourly[0])
    }
    load()
  }, [profile, today])

  // Signature canvas setup
  useEffect(() => {
    if (submitPath !== 'digital') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function getPos(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect()
      const src = 'touches' in e ? e.touches[0] : e
      const scaleX = canvas!.width / rect.width
      const scaleY = canvas!.height / rect.height
      return {
        x: (src.clientX - rect.left) * scaleX,
        y: (src.clientY - rect.top) * scaleY,
      }
    }

    function onStart(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      const { x, y } = getPos(e)
      sigPadRef.current = { drawing: true, lastX: x, lastY: y }
    }
    function onMove(e: MouseEvent | TouchEvent) {
      e.preventDefault()
      if (!sigPadRef.current.drawing) return
      const { x, y } = getPos(e)
      ctx!.beginPath()
      ctx!.moveTo(sigPadRef.current.lastX, sigPadRef.current.lastY)
      ctx!.lineTo(x, y)
      ctx!.strokeStyle = '#1a1a1a'
      ctx!.lineWidth = 2
      ctx!.lineCap = 'round'
      ctx!.stroke()
      sigPadRef.current.lastX = x
      sigPadRef.current.lastY = y
      setHasSignature(true)
    }
    function onEnd() {
      sigPadRef.current.drawing = false
    }

    canvas.addEventListener('mousedown', onStart)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseup', onEnd)
    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    canvas.addEventListener('touchend', onEnd)

    return () => {
      canvas.removeEventListener('mousedown', onStart)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseup', onEnd)
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove', onMove)
      canvas.removeEventListener('touchend', onEnd)
    }
  }, [submitPath])

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    setSignatureDataUrl(null)
  }

  async function handleScanInvoice(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    try {
      // Upload photo to storage so dispatcher can view it
      if (profile) {
        const path = `timesheets/${profile.company_id}/${Date.now()}-invoice.jpg`
        const { data: uploadData } = await supabase.storage
          .from('ticket-photos')
          .upload(path, file, { contentType: file.type })
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('ticket-photos').getPublicUrl(uploadData.path)
          setScannedInvoiceUrl(publicUrl)
        }
      }

      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/scan/invoice', { method: 'POST', body: fd })
      const { extracted } = await res.json()
      if (extracted) {
        setForm(prev => ({
          ...prev,
          notes: extracted.notes ?? prev.notes,
          arrived_at: extracted.date ? `${extracted.date}T07:00` : prev.arrived_at,
        }))
        setAiWarning(true)
      }
    } catch {
      // ignore
    } finally {
      setScanning(false)
    }
  }

  async function captureGps(): Promise<{ lat: number; lng: number } | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      )
    })
  }

  async function uploadSignature(): Promise<string | null> {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return null
    return new Promise(resolve => {
      canvas.toBlob(async blob => {
        if (!blob) return resolve(null)
        const path = `signatures/${profile!.company_id}/${Date.now()}.png`
        const { data } = await supabase.storage.from('ticket-photos').upload(path, blob, { contentType: 'image/png' })
        if (!data) return resolve(null)
        const { data: { publicUrl } } = supabase.storage.from('ticket-photos').getPublicUrl(data.path)
        resolve(publicUrl)
      }, 'image/png')
    })
  }

  async function handleSubmit() {
    if (!selectedDispatch || !form.arrived_at || !form.departed_at) return
    setSubmitting(true)
    try {
      const hours = calcHours(form.arrived_at, form.departed_at)
      const config = selectedDispatch.billing_config
      const clientRate = config ? new Decimal(config.client_rate_amount) : new Decimal(0)
      const clientCharge = hours !== null ? clientRate.mul(hours).toDecimalPlaces(2).toNumber() : null

      const gps = await captureGps()
      const sigUrl = isOnline ? await uploadSignature() : null

      const payload = {
        company_id: profile!.company_id,
        driver_id: profile!.id,
        dispatch_id: selectedDispatch.id,
        client_id: selectedDispatch.client_id,
        job_site_id: selectedDispatch.job_site_id,
        work_date: today,
        arrived_at: new Date(form.arrived_at).toISOString(),
        departed_at: new Date(form.departed_at).toISOString(),
        hours_worked: hours,
        hours_billed_client: hours,
        client_rate_per_hour: config?.client_rate_amount ?? null,
        client_charge_total: clientCharge,
        submission_method: submitPath === 'scan_invoice' ? 'paper_scan' : 'digital',
        scanned_invoice_photo_url: scannedInvoiceUrl,
        client_signature_url: sigUrl,
        client_signer_name: form.client_signer_name || null,
        notes: form.notes || null,
        gps_lat: gps?.lat ?? null,
        gps_lng: gps?.lng ?? null,
        status: 'submitted',
      }

      if (!isOnline) {
        enqueue('timesheet', payload)
        setPendingCount(getPendingCount())
        setSuccess(true)
        return
      }

      const { error } = await supabase.from('daily_timesheets').insert(payload)
      if (!error) {
        setSuccess(true)
      } else {
        enqueue('timesheet', payload)
        setPendingCount(getPendingCount())
        setSuccess(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const hours = calcHours(form.arrived_at, form.departed_at)
  const config = selectedDispatch?.billing_config
  const clientCharge = hours !== null && config
    ? new Decimal(config.client_rate_amount).mul(hours).toDecimalPlaces(2).toNumber()
    : null

  // ── SUCCESS SCREEN ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-[calc(100vh-160px)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Timesheet Submitted</h2>
        {hours !== null && (
          <p className="text-gray-500 text-sm mb-1">{hours} hours worked</p>
        )}
        {clientCharge !== null && (
          <p className="text-gray-500 text-sm mb-4">
            Client charge: ${clientCharge.toFixed(2)}
          </p>
        )}
        {pendingCount > 0 && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            {pendingCount} record(s) pending sync — will upload when online
          </div>
        )}
        <button
          onClick={() => router.push(homePath)}
          className="px-6 py-3 bg-[#1a1a1a] text-white rounded-xl font-medium"
        >
          Back to Home
        </button>
      </div>
    )
  }

  // ── STEP 1: SELECT DISPATCH ──────────────────────────────────────────────────
  if (!selectedDispatch) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Log Time</h1>
        </div>

        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Offline — timesheet will sync when reconnected
          </div>
        )}

        {dispatches.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">No hourly dispatches found for today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Select a dispatch to log time for:</p>
            {dispatches.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDispatch(d)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{d.clients?.name ?? 'Unknown client'}</p>
                    <p className="text-sm text-gray-500">{d.job_sites?.name ?? 'No job site'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                      Hourly
                    </span>
                    {d.billing_config && (
                      <p className="text-xs text-gray-500 mt-1">
                        ${d.billing_config.client_rate_amount}/hr
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── STEP 2: CHOOSE SUBMIT PATH ───────────────────────────────────────────────
  if (!submitPath) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setSelectedDispatch(null)} className="text-gray-500 hover:text-gray-900">
            <X className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Log Time</h1>
            <p className="text-sm text-gray-500">{selectedDispatch.clients?.name} · {selectedDispatch.job_sites?.name}</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 font-medium">How would you like to submit?</p>

        <button
          onClick={() => { setSubmitPath('scan_invoice'); fileInputRef.current?.click() }}
          className="w-full flex items-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-gray-400 transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
            <Camera className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Scan Paper Invoice</p>
            <p className="text-sm text-gray-500">Take a photo — AI will pre-fill the form</p>
          </div>
        </button>

        <button
          onClick={() => {
            setSubmitPath('digital')
            const now = new Date()
            setForm(prev => ({
              ...prev,
              arrived_at: toLocalDatetimeValue(now),
            }))
          }}
          className="w-full flex items-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-gray-400 transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Create Digital Timesheet</p>
            <p className="text-sm text-gray-500">Enter times manually and capture signature</p>
          </div>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleScanInvoice}
        />
      </div>
    )
  }

  // ── STEP 3: TIMESHEET FORM ───────────────────────────────────────────────────
  return (
    <div className="p-4 pb-32 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setSubmitPath(null)} className="text-gray-500 hover:text-gray-900">
          <X className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Timesheet</h1>
          <p className="text-sm text-gray-500">{selectedDispatch.clients?.name} · {selectedDispatch.job_sites?.name}</p>
        </div>
      </div>

      {scanning && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Reading invoice with AI...
        </div>
      )}

      {aiWarning && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>AI extracted times — review carefully before submitting.</span>
        </div>
      )}

      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Offline — will sync when reconnected
        </div>
      )}

      {/* Times */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Work Hours</h3>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Arrived</label>
          <input
            type="datetime-local"
            value={form.arrived_at}
            onChange={e => setForm(prev => ({ ...prev, arrived_at: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Departed</label>
          <input
            type="datetime-local"
            value={form.departed_at}
            onChange={e => setForm(prev => ({ ...prev, departed_at: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {hours !== null && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <span className="text-sm text-gray-600">Hours worked</span>
            <span className="font-semibold text-gray-900">{hours}h</span>
          </div>
        )}
      </div>

      {/* Billing preview */}
      {hours !== null && config && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Billing Preview</h3>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Client rate</span>
            <span className="font-medium">${config.client_rate_amount}/hr</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Hours</span>
            <span className="font-medium">{hours}h</span>
          </div>
          {clientCharge !== null && (
            <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2">
              <span>Client charge</span>
              <span>${clientCharge.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-1">
        <label className="text-xs font-medium text-gray-600">Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
          placeholder="Any notes about the job..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
        />
      </div>

      {/* Signature (digital path only) */}
      {submitPath === 'digital' && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Client Signature</h3>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Signer name</label>
            <input
              type="text"
              value={form.client_signer_name}
              onChange={e => setForm(prev => ({ ...prev, client_signer_name: e.target.value }))}
              placeholder="Client representative name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Signature</label>
              {hasSignature && (
                <button onClick={clearSignature} className="text-xs text-red-500 hover:text-red-700">Clear</button>
              )}
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
              <canvas
                ref={canvasRef}
                width={600}
                height={160}
                className="w-full touch-none"
                style={{ height: 160 }}
              />
            </div>
            {!hasSignature && (
              <p className="text-xs text-gray-400 text-center">Sign in the box above</p>
            )}
          </div>
        </div>
      )}

      {/* Fixed bottom bar */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-200 flex gap-3">
        <button
          onClick={() => {
            setForm(emptyForm)
            clearSignature()
            setAiWarning(false)
          }}
          className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Clear
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !form.arrived_at || !form.departed_at || hours === null || hours <= 0}
          className="flex-[2] py-3 bg-[#1a1a1a] text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Submit Timesheet ✓'
          )}
        </button>
      </div>
    </div>
  )
}
