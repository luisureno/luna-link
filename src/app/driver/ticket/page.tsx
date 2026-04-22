'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, FileText, PenLine, CheckCircle, ArrowLeftRight } from 'lucide-react'
import { DocumentScanner } from '@/components/driver/DocumentScanner'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { enqueue, getPendingCount } from '@/lib/offline-queue'
import type { Dispatch, DispatchAssignment } from '@/types'

type EntryPath = 'scan_tag' | 'scan_invoice' | 'manual' | null

interface BillingConfig {
  id: string
  billing_type: 'per_load' | 'hourly'
  client_rate_amount: number
  client_rate_unit: string
  driver_hours_per_load: number | null
  driver_pay_type: string
  job_type_name: string
}

interface DispatchFull extends Dispatch {
  dispatch_assignments: DispatchAssignment[]
  billing_config: BillingConfig | null
  clients: { id: string; name: string } | null
  job_sites: { id: string; name: string } | null
}

interface TicketForm {
  tag_number: string
  quarry_tag_number: string
  weight_tons: string
  gross_weight_lbs: string
  tare_weight_lbs: string
  material_type: string
  loads_count: string
  po_number: string
  job_site: string
  client_name: string
  ticket_date: string
  truck_number: string
  trailer_number: string
  driver_name: string
  hours_worked: string
  rate_amount: string
  total_amount: string
  origin: string
  destination: string
  notes: string
}

const empty: TicketForm = {
  tag_number: '', quarry_tag_number: '', weight_tons: '', gross_weight_lbs: '', tare_weight_lbs: '',
  material_type: '', loads_count: '1', po_number: '', job_site: '',
  client_name: '', ticket_date: '', truck_number: '', trailer_number: '',
  driver_name: '', hours_worked: '', rate_amount: '', total_amount: '',
  origin: '', destination: '', notes: '',
}

// Fields the AI can return, in the order we want to show them in the review screen
const REVIEW_FIELDS: { key: string; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'tag_number', label: 'Tag / Ticket Number' },
  { key: 'client_name', label: 'Client Name' },
  { key: 'job_site', label: 'Job Site / Location' },
  { key: 'material_type', label: 'Material Type' },
  { key: 'weight_tons', label: 'Weight (tons)' },
  { key: 'weight_lbs', label: 'Weight (lbs)' },
  { key: 'gross_weight_lbs', label: 'Gross Weight (lbs)' },
  { key: 'tare_weight_lbs', label: 'Tare Weight (lbs)' },
  { key: 'loads_completed', label: 'Number of Loads' },
  { key: 'hours_worked', label: 'Hours Worked' },
  { key: 'truck_number', label: 'Truck Number' },
  { key: 'trailer_number', label: 'Trailer Number' },
  { key: 'driver_name', label: 'Driver Name' },
  { key: 'origin', label: 'Origin / Pickup' },
  { key: 'destination', label: 'Destination' },
  { key: 'po_number', label: 'PO / Order Number' },
  { key: 'rate_amount', label: 'Rate' },
  { key: 'total_amount', label: 'Amount Charged' },
  { key: 'notes', label: 'Notes' },
  { key: 'additional_text', label: 'Other Text on Invoice' },
]

export default function TicketPage() {
  const { profile, accountType } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const homePath = accountType === 'solo' ? '/dashboard/solo' : '/driver'
  const today = new Date().toISOString().split('T')[0]
  const fileInputRef = useRef<HTMLInputElement>(null) // fallback for manual retake in form

  const [dispatches, setDispatches] = useState<DispatchFull[]>([])
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchFull | null>(null)
  const [driverHourlyRate, setDriverHourlyRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [entryPath, setEntryPath] = useState<EntryPath>(null)
  const [scanning, setScanning] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [aiExtractedData, setAiExtractedData] = useState<Record<string, unknown> | null>(null)
  // scanReview holds the raw AI extraction as editable strings for user review
  const [scanReview, setScanReview] = useState<Record<string, string> | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [form, setForm] = useState<TicketForm>(empty)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ tagNumber: string; time: string } | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!profile?.id) return
    if (accountType === 'solo') {
      setSelectedDispatch({ id: '__no_dispatch__' } as any)
      setPendingCount(getPendingCount())
      setLoading(false)
      return
    }
    loadDispatches()
    setPendingCount(getPendingCount())
  }, [profile?.id, accountType])

  async function loadDispatches() {
    const [assignmentsRes, ratesRes] = await Promise.all([
      supabase
        .from('dispatch_assignments')
        .select('*, dispatches(*, clients(*), job_sites(*), client_billing_configs(*))')
        .eq('driver_id', profile!.id),
      supabase
        .from('driver_pay_rates')
        .select('hourly_rate')
        .eq('driver_id', profile!.id)
        .order('effective_date', { ascending: false })
        .limit(1),
    ])

    const todayDispatches = (assignmentsRes.data ?? [])
      .filter(a => {
        const d = (a as any).dispatches
        return d?.scheduled_date === today && d?.status !== 'cancelled'
      })
      .map(a => {
        const d = (a as any).dispatches
        return {
          ...d,
          dispatch_assignments: [a],
          billing_config: d.client_billing_configs ?? null,
          clients: d.clients ?? null,
          job_sites: d.job_sites ?? null,
        }
      })

    setDispatches(todayDispatches)
    const rate = (ratesRes.data ?? [])[0]
    if (rate) {
      setDriverHourlyRate(rate.hourly_rate ?? null)
    }
    if (todayDispatches.length === 1) selectDispatch(todayDispatches[0])
    setLoading(false)
  }

  function selectDispatch(d: DispatchFull) {
    setSelectedDispatch(d)
    if (d.billing_config?.billing_type === 'hourly') {
      router.replace('/driver/timesheet')
      return
    }
    setEntryPath(null)
  }

  function setField(k: keyof TicketForm, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleFile(file: File) {
    setShowScanner(false)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setScanning(true)
    setScanReview(null)

    const fd = new FormData()
    fd.append('image', file)
    const endpoint = entryPath === 'scan_tag' ? '/api/scan/tag' : '/api/scan/invoice'

    try {
      const res = await fetch(endpoint, { method: 'POST', body: fd })
      const { extracted } = await res.json()
      if (extracted) {
        setAiExtractedData(extracted)
        const review: Record<string, string> = {}
        for (const [k, v] of Object.entries(extracted)) {
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            review[k] = String(v)
          }
        }
        setScanReview(review)
      } else {
        alert('Could not read the image — try better lighting or a clearer photo.')
      }
    } catch (err) {
      console.error('[scan]', err)
      alert('Scan failed — check your connection and try again.')
    }

    setScanning(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function confirmReview() {
    if (!scanReview) return
    const updates: Partial<TicketForm> = {}
    if (scanReview.date) updates.ticket_date = scanReview.date
    if (scanReview.tag_number) updates.tag_number = scanReview.tag_number
    if (scanReview.quarry_tag_number) updates.quarry_tag_number = scanReview.quarry_tag_number
    if (scanReview.client_name) updates.client_name = scanReview.client_name
    if (scanReview.job_site) updates.job_site = scanReview.job_site
    if (scanReview.material_type) updates.material_type = scanReview.material_type
    if (scanReview.weight_tons) updates.weight_tons = scanReview.weight_tons
    if (scanReview.gross_weight_lbs) updates.gross_weight_lbs = scanReview.gross_weight_lbs
    if (scanReview.tare_weight_lbs) updates.tare_weight_lbs = scanReview.tare_weight_lbs
    if (scanReview.loads_completed) updates.loads_count = scanReview.loads_completed
    if (scanReview.truck_number) updates.truck_number = scanReview.truck_number
    if (scanReview.trailer_number) updates.trailer_number = scanReview.trailer_number
    if (scanReview.driver_name) updates.driver_name = scanReview.driver_name
    if (scanReview.hours_worked) updates.hours_worked = scanReview.hours_worked
    if (scanReview.origin) updates.origin = scanReview.origin
    if (scanReview.destination) updates.destination = scanReview.destination
    if (scanReview.po_number) updates.po_number = scanReview.po_number
    if (scanReview.rate_amount) updates.rate_amount = scanReview.rate_amount
    if (scanReview.total_amount) updates.total_amount = scanReview.total_amount
    const noteParts = [scanReview.notes, scanReview.additional_text].filter(Boolean)
    if (noteParts.length) updates.notes = noteParts.join(' | ')
    setForm(f => ({ ...f, ...updates }))
    setScanReview(null)
  }

  function calcBilling() {
    const cfg = selectedDispatch?.billing_config
    if (!cfg) return { client_charge_total: null, driver_pay_total: null, hours_billed_client: null, hours_paid_driver: null }
    try {
      if (cfg.billing_type === 'per_load') {
        const loads = new Decimal(form.loads_count || '1')
        const rate = new Decimal(cfg.client_rate_amount)
        const clientTotal = loads.times(rate).toFixed(2)
        const hrsPerLoad = cfg.driver_hours_per_load ? new Decimal(cfg.driver_hours_per_load) : null
        const hourlyRate = driverHourlyRate ? new Decimal(driverHourlyRate) : null
        const driverTotal = hrsPerLoad && hourlyRate ? loads.times(hrsPerLoad).times(hourlyRate).toFixed(2) : null
        const driverHrs = hrsPerLoad ? loads.times(hrsPerLoad).toFixed(2) : null
        return { client_charge_total: clientTotal, driver_pay_total: driverTotal, hours_billed_client: null, hours_paid_driver: driverHrs }
      }
    } catch {}
    return { client_charge_total: null, driver_pay_total: null, hours_billed_client: null, hours_paid_driver: null }
  }

  async function handleSubmit() {
    if (!profile) return
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

    const billing = calcBilling()
    const hasDispatch = selectedDispatch && (selectedDispatch as any).id !== '__no_dispatch__'
    const cfg = hasDispatch ? selectedDispatch!.billing_config : null

    const manualCharge = (() => {
      const raw = (form.total_amount ?? '').toString().replace(/[$,\s]/g, '')
      const n = parseFloat(raw)
      return Number.isFinite(n) && n > 0 ? n : null
    })()

    const payload = {
      company_id: profile.company_id,
      driver_id: profile.id,
      dispatch_id: hasDispatch ? selectedDispatch!.id : null,
      client_id: hasDispatch ? selectedDispatch!.client_id : null,
      job_site_id: hasDispatch ? selectedDispatch!.job_site_id : null,
      ticket_template_id: hasDispatch ? selectedDispatch!.ticket_template_id : null,
      billing_type: cfg?.billing_type ?? null,
      submission_method: entryPath === 'scan_tag' ? 'tag_scan' : entryPath === 'scan_invoice' ? 'paper_scan' : 'manual',
      tag_number: form.tag_number || null,
      weight_tons: form.weight_tons ? parseFloat(form.weight_tons) : null,
      material_type: form.material_type || null,
      loads_count: parseInt(form.loads_count || '1'),
      client_rate_amount: cfg?.client_rate_amount ?? null,
      client_rate_unit: cfg?.client_rate_unit ?? null,
      client_charge_total: billing.client_charge_total ? parseFloat(billing.client_charge_total) : manualCharge,
      driver_hourly_rate: driverHourlyRate,
      driver_hours_per_load: cfg?.driver_hours_per_load ?? null,
      driver_pay_total: billing.driver_pay_total ? parseFloat(billing.driver_pay_total) : null,
      hours_paid_driver: billing.hours_paid_driver ? parseFloat(billing.hours_paid_driver) : null,
      ai_extracted_data: aiExtractedData ?? null,
      form_data: {
        ticket_date: form.ticket_date,
        quarry_tag_number: form.quarry_tag_number || undefined,
        job_site: form.job_site,
        client_name: form.client_name,
        origin: form.origin,
        destination: form.destination,
        po_number: form.po_number,
        truck_number: form.truck_number,
        trailer_number: form.trailer_number,
        driver_name: form.driver_name,
        hours_worked: form.hours_worked,
        gross_weight_lbs: form.gross_weight_lbs,
        tare_weight_lbs: form.tare_weight_lbs,
        rate_amount: form.rate_amount,
        total_amount: form.total_amount,
        notes: form.notes,
      },
      latitude,
      longitude,
      status: 'submitted',
    }

    const isOnline = typeof navigator !== 'undefined' && navigator.onLine

    if (!isOnline) {
      enqueue('ticket', payload)
      setPendingCount(getPendingCount())
      setSuccess({ tagNumber: form.tag_number || 'Manual', time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) })
      setSubmitting(false)
      return
    }

    let tagPhotoUrl: string | null = null
    if (photoFile) {
      const path = `tickets/${profile.company_id}/${Date.now()}_${photoFile.name}`
      const { data: uploadData } = await supabase.storage.from('ticket-photos').upload(path, photoFile)
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('ticket-photos').getPublicUrl(path)
        tagPhotoUrl = urlData.publicUrl
      }
    }

    const { error } = await supabase.from('load_tickets').insert({ ...payload, tag_photo_url: tagPhotoUrl })
    if (error) {
      console.error('[ticket] insert failed:', error)
      alert(`Failed to submit ticket: ${error.message}`)
      setSubmitting(false)
      return
    }
    setSuccess({ tagNumber: form.tag_number || 'Manual', time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) })
    setSubmitting(false)
  }

  function resetForAnother() {
    setForm(empty)
    setPhotoFile(null)
    setPhotoPreview(null)
    setAiExtractedData(null)
    setScanReview(null)
    setSuccess(null)
    setEntryPath(null)
  }

  useEffect(() => {
    async function syncQueue() {
      const { getPending, markSynced } = await import('@/lib/offline-queue')
      const pending = getPending()
      for (const item of pending) {
        if (item.type === 'ticket') {
          const { error } = await supabase.from('load_tickets').insert(item.payload)
          if (!error) markSynced(item.localId)
        }
      }
      setPendingCount(getPendingCount())
    }
    window.addEventListener('online', syncQueue)
    return () => window.removeEventListener('online', syncQueue)
  }, [])

  // ── Success ──────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <span className="text-3xl">✓</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Ticket Submitted</h2>
        {form.tag_number && <p className="text-sm text-gray-600 mt-1">Tag #{form.tag_number}</p>}
        {form.weight_tons && <p className="text-sm text-gray-500">{form.weight_tons} tons{form.material_type ? ` — ${form.material_type}` : ''}</p>}
        <p className="text-xs text-gray-400 mt-1">Submitted at {success.time} · GPS recorded</p>
        {pendingCount > 0 && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">{pendingCount} ticket{pendingCount > 1 ? 's' : ''} pending sync</p>
        )}
        <div className="flex gap-3 mt-8 w-full max-w-xs">
          <button onClick={resetForAnother} className="flex-1 py-3 border border-gray-300 rounded-lg text-sm font-medium">Submit Another</button>
          <button onClick={() => router.push(homePath)} className="flex-1 py-3 bg-[#1a1a1a] text-white rounded-lg text-sm font-medium">Back to Today</button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />)}</div>

  // ── Step 1: select dispatch ──────────────────────────────────────────────────
  if (!selectedDispatch) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">New Load Ticket</h1>
        <p className="text-sm text-gray-500 mb-4">
          {dispatches.length > 0 ? 'Select a dispatch or submit without one.' : 'No dispatches sent for today — you can still submit a ticket.'}
        </p>
        <div className="space-y-2">
          {dispatches.map(d => (
            <button key={d.id} onClick={() => selectDispatch(d)} className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 active:bg-gray-50">
              <p className="text-sm font-medium text-gray-900">{d.title}</p>
              {d.clients && <p className="text-xs text-gray-500 mt-0.5">{d.clients.name}</p>}
              {d.billing_config && (
                <span className={`inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${d.billing_config.billing_type === 'per_load' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                  {d.billing_config.job_type_name}
                </span>
              )}
              {d.notes && <p className="text-xs text-gray-400 mt-1">{d.notes}</p>}
            </button>
          ))}
          <button
            onClick={() => { setSelectedDispatch({ id: '__no_dispatch__' } as any); setEntryPath(null) }}
            className="w-full text-left bg-white border border-dashed border-gray-300 rounded-xl p-4 hover:border-gray-500 active:bg-gray-50"
          >
            <p className="text-sm font-medium text-gray-700">Submit without dispatch</p>
            <p className="text-xs text-gray-400 mt-0.5">No billing config — dispatcher will review</p>
          </button>
        </div>
      </div>
    )
  }

  // ── Step 2: choose entry path ────────────────────────────────────────────────
  if (!entryPath) {
    return (
      <>
        {showScanner && (
          <DocumentScanner
            onCapture={file => { handleFile(file) }}
            onCancel={() => { setShowScanner(false); setEntryPath(null) }}
          />
        )}
        <div className="p-4">
          <button onClick={() => accountType === 'solo' ? router.push(homePath) : setSelectedDispatch(null)} className="text-sm text-gray-500 mb-3">← Back</button>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">New Load Ticket</h1>
          {(selectedDispatch as any).id !== '__no_dispatch__' && selectedDispatch.title && (
            <p className="text-sm text-gray-500 mb-2">{selectedDispatch.title}</p>
          )}
          <p className="text-sm font-medium text-gray-700 mb-3">How do you want to submit this ticket?</p>
          <div className="space-y-3">
            {[
              { path: 'scan_tag' as EntryPath, icon: Camera, label: 'Scan Tag', desc: 'Photograph the quarry tag' },
              { path: 'scan_invoice' as EntryPath, icon: FileText, label: 'Scan Invoice', desc: 'Photograph a paper invoice' },
              { path: 'manual' as EntryPath, icon: PenLine, label: 'Fill Manually', desc: 'Type everything in yourself' },
            ].map(({ path, icon: Icon, label, desc }) => (
              <button
                key={path}
                onClick={() => {
                  setEntryPath(path)
                  if (path !== 'manual') setShowScanner(true)
                }}
                className="w-full flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 active:bg-gray-50 text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Icon size={20} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  // ── Scanning loading screen ──────────────────────────────────────────────────
  if (scanning) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <span className="w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-5" />
        <p className="text-base font-semibold text-gray-900">Reading {entryPath === 'scan_tag' ? 'tag' : 'invoice'}…</p>
        <p className="text-sm text-gray-500 mt-1">Extracting all fields from your photo</p>
      </div>
    )
  }

  // ── Step 2.5: scan review ────────────────────────────────────────────────────
  if (scanReview !== null) {
    const visibleFields = REVIEW_FIELDS.filter(f => scanReview[f.key] !== undefined && scanReview[f.key] !== '')
    return (
      <>
        {showScanner && (
          <DocumentScanner
            onCapture={file => { handleFile(file) }}
            onCancel={() => setShowScanner(false)}
          />
        )}
        <div className="p-4 pb-36 md:pb-24">
          <h1 className="text-lg font-semibold text-gray-900 mb-0.5">Review Scan</h1>
          <p className="text-xs text-gray-500 mb-4">Everything found on the invoice. Edit any field, then confirm.</p>

          {/* Document digital copy */}
          {photoPreview && (
            <div className="mb-5 flex justify-center">
              <div className="relative w-full max-w-sm shadow-2xl rounded-lg overflow-hidden bg-white border border-gray-200">
                <img
                  src={photoPreview}
                  alt="Scanned document"
                  className="w-full"
                  style={{ filter: 'contrast(1.08) brightness(1.04)', display: 'block' }}
                />
                {/* Page curl effect */}
                <div className="absolute bottom-0 right-0 w-8 h-8" style={{
                  background: 'linear-gradient(225deg, #e5e7eb 45%, #d1d5db 50%, #f9fafb 51%)',
                  borderTopLeftRadius: 4,
                }} />
              </div>
            </div>
          )}

          {/* Quarry tag — always present, separate from invoice tag */}
          <div className="bg-white border-2 border-blue-200 rounded-xl px-4 py-3 mb-2">
            <label className="block text-xs font-medium text-blue-600 mb-1">Quarry Tag Number</label>
            <input
              type="text"
              inputMode="numeric"
              value={scanReview['quarry_tag_number'] ?? ''}
              onChange={e => setScanReview(r => ({ ...r!, quarry_tag_number: e.target.value }))}
              placeholder="Quarry tag # (different from invoice tag)"
              className="w-full text-base text-gray-900 outline-none bg-transparent"
            />
          </div>

          {visibleFields.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
              No fields could be read. Try a clearer photo with better lighting.
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {visibleFields
                .filter(f => f.key !== 'destination')
                .map(({ key, label }) => {
                  if (key === 'origin') {
                    const hasDestination = scanReview['destination'] !== undefined && scanReview['destination'] !== ''
                    return (
                      <div key="haul-route" className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Origin / Pickup</label>
                          <input
                            type="text"
                            value={scanReview['origin']}
                            onChange={e => setScanReview(r => ({ ...r!, origin: e.target.value }))}
                            className="w-full text-base text-gray-900 outline-none bg-transparent"
                          />
                        </div>
                        {hasDestination && (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-px bg-gray-200" />
                              <button
                                type="button"
                                onClick={() => setScanReview(r => ({ ...r!, origin: r!['destination'], destination: r!['origin'] }))}
                                className="flex items-center gap-1.5 px-3 py-1 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
                              >
                                <ArrowLeftRight size={12} /> Swap
                              </button>
                              <div className="flex-1 h-px bg-gray-200" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Destination</label>
                              <input
                                type="text"
                                value={scanReview['destination']}
                                onChange={e => setScanReview(r => ({ ...r!, destination: e.target.value }))}
                                className="w-full text-base text-gray-900 outline-none bg-transparent"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div key={key} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                      <input
                        type="text"
                        value={scanReview[key]}
                        onChange={e => setScanReview(r => ({ ...r!, [key]: e.target.value }))}
                        className="w-full text-base text-gray-900 outline-none bg-transparent"
                      />
                    </div>
                  )
                })}
            </div>
          )}

          <div className="fixed bottom-14 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-3 md:bottom-0">
            <button
              onClick={() => { setScanReview(null); setPhotoFile(null); setPhotoPreview(null); setShowScanner(true) }}
              className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700"
            >
              Retake
            </button>
            <button
              onClick={confirmReview}
              className="flex-1 py-3 bg-[#1a1a1a] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} />
              Confirm & Fill Form
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Step 3: ticket form ──────────────────────────────────────────────────────
  const cfg = selectedDispatch.billing_config
  const billing = calcBilling()

  return (
    <div className="p-4 pb-36 md:pb-24">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => { setEntryPath(null); setPhotoFile(null); setPhotoPreview(null) }}
          className="text-sm text-gray-500"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Load Ticket</h1>
      </div>

      {/* Photo thumbnail */}
      {photoPreview && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <img src={photoPreview} alt="Scanned" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900">Photo attached</p>
            <p className="text-xs text-gray-500 truncate">{photoFile?.name}</p>
          </div>
          <button onClick={() => setShowScanner(true)} className="text-xs text-gray-500 underline flex-shrink-0">
            Retake
          </button>
        </div>
      )}
      {showScanner && (
        <DocumentScanner
          onCapture={file => { handleFile(file) }}
          onCancel={() => setShowScanner(false)}
        />
      )}

      {/* Billing context */}
      {cfg && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-xs text-gray-600 space-y-0.5">
          <p className="font-medium text-gray-800">{cfg.job_type_name}</p>
          <p>Client rate: <strong>${Number(cfg.client_rate_amount).toFixed(4)} {cfg.client_rate_unit.replace(/_/g, ' ')}</strong></p>
          {cfg.driver_hours_per_load && <p>Driver: <strong>{cfg.driver_hours_per_load} hrs/load</strong>{driverHourlyRate ? ` × $${driverHourlyRate}/hr` : ''}</p>}
        </div>
      )}

      <div className="space-y-3">
        {/* Date */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input type="date" value={form.ticket_date || today} onChange={e => setField('ticket_date', e.target.value)} className="w-full text-base text-gray-900 outline-none bg-transparent" />
        </div>

        {/* Tag */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Tag / Ticket Number</label>
          <input type="text" inputMode="numeric" value={form.tag_number} onChange={e => setField('tag_number', e.target.value)} placeholder="e.g. 4421" className="w-full text-base text-gray-900 outline-none bg-transparent" />
        </div>

        {/* Quarry Tag */}
        <div className="bg-white border border-blue-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-blue-600 mb-1">Quarry Tag Number <span className="text-gray-400 font-normal">(different from invoice tag)</span></label>
          <input type="text" inputMode="numeric" value={form.quarry_tag_number} onChange={e => setField('quarry_tag_number', e.target.value)} placeholder="e.g. 8843" className="w-full text-base text-gray-900 outline-none bg-transparent" />
        </div>

        {/* Client */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Client Name</label>
          <input type="text" value={form.client_name} onChange={e => setField('client_name', e.target.value)} placeholder="e.g. ABC Construction" className="w-full text-base text-gray-900 outline-none bg-transparent" />
        </div>

        {/* Job site */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Job Site / Location</label>
          <input type="text" value={form.job_site} onChange={e => setField('job_site', e.target.value)} placeholder="e.g. North Quarry" className="w-full text-base text-gray-900 outline-none bg-transparent" />
        </div>

        {/* Haul Route */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Origin / Pickup</label>
            <input type="text" value={form.origin} onChange={e => setField('origin', e.target.value)} placeholder="e.g. Mesa Rock Quarry" className="w-full text-base text-gray-900 outline-none bg-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, origin: f.destination, destination: f.origin }))}
              className="flex items-center gap-1.5 px-3 py-1 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <ArrowLeftRight size={12} /> Swap
            </button>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Destination</label>
            <input type="text" value={form.destination} onChange={e => setField('destination', e.target.value)} placeholder="e.g. Scottsdale Job Site" className="w-full text-base text-gray-900 outline-none bg-transparent" />
          </div>
        </div>

        {/* Material */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Material Type</label>
          <input type="text" value={form.material_type} onChange={e => setField('material_type', e.target.value)} placeholder="e.g. Concrete Sand" className="w-full text-base text-gray-900 outline-none bg-transparent" />
        </div>

        {/* Weight tons */}
        {!cfg && (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Weight (tons)</label>
            <input type="number" inputMode="decimal" step="0.001" value={form.weight_tons} onChange={e => setField('weight_tons', e.target.value)} placeholder="e.g. 22.8" className="w-full text-base text-gray-900 outline-none bg-transparent" />
          </div>
        )}

        {/* Gross / Tare weights */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Gross Weight (lbs)</label>
            <input type="number" inputMode="numeric" value={form.gross_weight_lbs} onChange={e => setField('gross_weight_lbs', e.target.value)} placeholder="Optional" className="w-full text-base text-gray-900 outline-none bg-transparent" />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Tare Weight (lbs)</label>
            <input type="number" inputMode="numeric" value={form.tare_weight_lbs} onChange={e => setField('tare_weight_lbs', e.target.value)} placeholder="Optional" className="w-full text-base text-gray-900 outline-none bg-transparent" />
          </div>
        </div>

        {/* Loads count */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Loads Count</label>
          <input type="number" inputMode="numeric" value={form.loads_count} onChange={e => setField('loads_count', e.target.value)} min="1" className="w-full text-base text-gray-900 outline-none bg-transparent" />
        </div>

        {/* Hours */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Hours Worked <span className="text-gray-400">(optional)</span></label>
          <input type="number" inputMode="decimal" step="0.25" value={form.hours_worked} onChange={e => setField('hours_worked', e.target.value)} placeholder="e.g. 8.5" className="w-full text-base text-gray-900 outline-none bg-transparent" />
        </div>

        {/* Truck / Trailer */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Truck #</label>
            <input type="text" value={form.truck_number} onChange={e => setField('truck_number', e.target.value)} placeholder="e.g. T-14" className="w-full text-base text-gray-900 outline-none bg-transparent" />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Trailer #</label>
            <input type="text" value={form.trailer_number} onChange={e => setField('trailer_number', e.target.value)} placeholder="Optional" className="w-full text-base text-gray-900 outline-none bg-transparent" />
          </div>
        </div>

        {/* Driver name */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Driver Name <span className="text-gray-400">(optional)</span></label>
          <input type="text" value={form.driver_name} onChange={e => setField('driver_name', e.target.value)} placeholder="e.g. John Smith" className="w-full text-base text-gray-900 outline-none bg-transparent" />
        </div>

        {/* PO */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">PO / Order Number <span className="text-gray-400">(optional)</span></label>
          <input type="text" value={form.po_number} onChange={e => setField('po_number', e.target.value)} placeholder="Optional" className="w-full text-base text-gray-900 outline-none bg-transparent" />
        </div>

        {/* Rate / Total */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Rate <span className="text-gray-400">(optional)</span></label>
            <input type="text" value={form.rate_amount} onChange={e => setField('rate_amount', e.target.value)} placeholder="e.g. $12/ton" className="w-full text-base text-gray-900 outline-none bg-transparent" />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount Charged <span className="text-gray-400">(appears on invoice)</span></label>
            <input type="text" inputMode="decimal" value={form.total_amount} onChange={e => setField('total_amount', e.target.value)} placeholder="e.g. 320.00" className="w-full text-base text-gray-900 outline-none bg-transparent" />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
          <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} placeholder="Any additional notes" className="w-full text-base text-gray-900 outline-none bg-transparent resize-none" />
        </div>

        {/* Billing preview */}
        {(billing.client_charge_total || billing.driver_pay_total) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs space-y-1">
            {billing.client_charge_total && <p className="text-blue-800">Client charge: <strong>${billing.client_charge_total}</strong></p>}
            {billing.driver_pay_total && <p className="text-blue-700">Driver pay: <strong>${billing.driver_pay_total}</strong></p>}
          </div>
        )}
      </div>

      <div className="fixed bottom-14 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 md:bottom-0">
        <button
          onClick={() => { setForm(empty); setPhotoFile(null); setPhotoPreview(null) }}
          className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700"
        >
          Clear all
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-3 bg-[#16a34a] text-white rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit Ticket ✓'}
        </button>
      </div>
    </div>
  )
}
