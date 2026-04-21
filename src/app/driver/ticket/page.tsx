'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, FileText, PenLine, X, AlertTriangle } from 'lucide-react'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { enqueue, getPendingCount } from '@/lib/offline-queue'
import type { Dispatch, DispatchAssignment } from '@/types'

type EntryPath = 'scan_tag' | 'scan_invoice' | 'manual' | null

interface BillingConfig {
  id: string
  billing_type: 'per_load' | 'hourly' | 'per_ton'
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
  weight_tons: string
  material_type: string
  loads_count: string
  po_number: string
  notes: string
}

const empty: TicketForm = { tag_number: '', weight_tons: '', material_type: '', loads_count: '1', po_number: '', notes: '' }

export default function TicketPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dispatches, setDispatches] = useState<DispatchFull[]>([])
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchFull | null>(null)
  const [driverHourlyRate, setDriverHourlyRate] = useState<number | null>(null)
  const [driverPerTonRate, setDriverPerTonRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [entryPath, setEntryPath] = useState<EntryPath>(null)
  const [scanning, setScanning] = useState(false)
  const [scanWarning, setScanWarning] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [aiExtractedData, setAiExtractedData] = useState<Record<string, unknown> | null>(null)
  const [form, setForm] = useState<TicketForm>(empty)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ tagNumber: string; time: string } | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!profile?.id) return
    loadDispatches()
    setPendingCount(getPendingCount())
  }, [profile?.id])

  async function loadDispatches() {
    const [assignmentsRes, ratesRes] = await Promise.all([
      supabase
        .from('dispatch_assignments')
        .select('*, dispatches(*, clients(*), job_sites(*), client_billing_configs(*))')
        .eq('driver_id', profile!.id),
      supabase
        .from('driver_pay_rates')
        .select('hourly_rate, per_ton_rate')
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
      setDriverPerTonRate(rate.per_ton_rate ?? null)
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

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setScanning(true)
    setScanWarning(false)

    const fd = new FormData()
    fd.append('image', file)
    const endpoint = entryPath === 'scan_tag' ? '/api/scan/tag' : '/api/scan/invoice'

    try {
      const res = await fetch(endpoint, { method: 'POST', body: fd })
      const { extracted } = await res.json()
      if (extracted) {
        setAiExtractedData(extracted)
        const updates: Partial<TicketForm> = {}
        if (extracted.tag_number) updates.tag_number = String(extracted.tag_number)
        if (extracted.weight_tons) updates.weight_tons = String(extracted.weight_tons)
        if (extracted.material_type) updates.material_type = String(extracted.material_type)
        if (extracted.loads_completed) updates.loads_count = String(extracted.loads_completed)
        if (extracted.notes) updates.notes = String(extracted.notes)
        setForm(f => ({ ...f, ...updates }))
        setScanWarning(true)
      }
    } catch {}

    setScanning(false)
  }

  function calcBilling(): {
    client_charge_total: string | null
    driver_pay_total: string | null
    hours_billed_client: string | null
    hours_paid_driver: string | null
  } {
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
      if (cfg.billing_type === 'per_ton') {
        const tons = new Decimal(form.weight_tons || '0')
        const rate = new Decimal(cfg.client_rate_amount)
        const clientTotal = tons.times(rate).toFixed(2)
        let driverTotal: string | null = null
        if (cfg.driver_pay_type === 'per_ton' && driverPerTonRate) {
          driverTotal = tons.times(new Decimal(driverPerTonRate)).toFixed(2)
        } else if (cfg.driver_pay_type === 'hourly' && driverHourlyRate && form.loads_count) {
          driverTotal = new Decimal(form.loads_count).times(new Decimal(driverHourlyRate)).toFixed(2)
        }
        return { client_charge_total: clientTotal, driver_pay_total: driverTotal, hours_billed_client: null, hours_paid_driver: null }
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
      client_charge_total: billing.client_charge_total ? parseFloat(billing.client_charge_total) : null,
      driver_hourly_rate: driverHourlyRate,
      driver_hours_per_load: cfg?.driver_hours_per_load ?? null,
      driver_pay_total: billing.driver_pay_total ? parseFloat(billing.driver_pay_total) : null,
      hours_paid_driver: billing.hours_paid_driver ? parseFloat(billing.hours_paid_driver) : null,
      ai_extracted_data: aiExtractedData ?? null,
      form_data: { po_number: form.po_number, notes: form.notes },
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

    // Upload photo to Supabase Storage if present
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

    if (!error) {
      setSuccess({
        tagNumber: form.tag_number || 'Manual',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      })
    }
    setSubmitting(false)
  }

  function resetForAnother() {
    setForm(empty)
    setPhotoFile(null)
    setPhotoPreview(null)
    setAiExtractedData(null)
    setScanWarning(false)
    setSuccess(null)
    setEntryPath(null)
  }

  // ── Sync offline queue when online ──────────────────────────────────────────
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

  // ── Success screen ───────────────────────────────────────────────────────────
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
          <button onClick={() => router.push('/driver')} className="flex-1 py-3 bg-[#1a1a1a] text-white rounded-lg text-sm font-medium">Back to Today</button>
        </div>
      </div>
    )
  }

  const NO_DISPATCH = '__no_dispatch__'

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
                <span className={`inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${d.billing_config.billing_type === 'per_load' ? 'bg-blue-50 text-blue-700' : d.billing_config.billing_type === 'per_ton' ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'}`}>
                  {d.billing_config.job_type_name}
                </span>
              )}
              {d.notes && <p className="text-xs text-gray-400 mt-1">{d.notes}</p>}
            </button>
          ))}

          {/* No-dispatch option */}
          <button
            onClick={() => { setSelectedDispatch({ id: NO_DISPATCH } as any); setEntryPath(null) }}
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
      <div className="p-4">
        <button onClick={() => setSelectedDispatch(null)} className="text-sm text-gray-500 mb-3">← Back</button>
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
                if (path !== 'manual') setTimeout(() => fileInputRef.current?.click(), 100)
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => { if (entryPath) handlePhoto(e) }}
        />
      </div>
    )
  }

  // ── Step 3: ticket form ──────────────────────────────────────────────────────
  const cfg = selectedDispatch.billing_config
  const billing = calcBilling()

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => { setEntryPath(null); setPhotoFile(null); setPhotoPreview(null); setScanWarning(false) }} className="text-sm text-gray-500">← Back</button>
        <h1 className="text-lg font-semibold text-gray-900">Load Ticket</h1>
      </div>

      {/* Scan warning */}
      {scanWarning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5 mb-4">
          <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-medium">
            {entryPath === 'scan_tag' ? 'Tag scanned' : 'Invoice scanned'} — check every field before submitting. Tap any field to edit.
          </p>
        </div>
      )}

      {scanning && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 mb-4">
          <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-xs text-blue-700">Reading {entryPath === 'scan_tag' ? 'tag' : 'invoice'}…</p>
        </div>
      )}

      {/* Photo */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        {photoPreview ? (
          <div className="flex items-center gap-3">
            <img src={photoPreview} alt="Scanned" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900">Photo attached</p>
              <p className="text-xs text-gray-500 truncate">{photoFile?.name}</p>
            </div>
            <label className="text-xs text-gray-500 underline cursor-pointer">
              Retake
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            </label>
          </div>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer">
            <Camera size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500">Add photo</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </label>
        )}
      </div>

      {/* Billing context */}
      {cfg && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 text-xs text-gray-600 space-y-0.5">
          <p className="font-medium text-gray-800">{cfg.job_type_name}</p>
          <p>Client rate: <strong>${Number(cfg.client_rate_amount).toFixed(4)} {cfg.client_rate_unit.replace(/_/g, ' ')}</strong></p>
          {cfg.driver_hours_per_load && <p>Driver: <strong>{cfg.driver_hours_per_load} hrs/load</strong>{driverHourlyRate ? ` × $${driverHourlyRate}/hr` : ''}</p>}
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-3">
        {/* Tag number */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Tag Number</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.tag_number}
            onChange={e => setField('tag_number', e.target.value)}
            placeholder="e.g. 4421"
            className="w-full text-base text-gray-900 outline-none bg-transparent"
          />
        </div>

        {/* Weight */}
        {(cfg?.billing_type === 'per_ton' || !cfg) && (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">Weight (tons)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              value={form.weight_tons}
              onChange={e => setField('weight_tons', e.target.value)}
              placeholder="e.g. 22.8"
              className="w-full text-base text-gray-900 outline-none bg-transparent"
            />
          </div>
        )}

        {/* Material */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Material Type</label>
          <input
            type="text"
            value={form.material_type}
            onChange={e => setField('material_type', e.target.value)}
            placeholder="e.g. Concrete Sand"
            className="w-full text-base text-gray-900 outline-none bg-transparent"
          />
        </div>

        {/* Loads count */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Loads Count</label>
          <input
            type="number"
            inputMode="numeric"
            value={form.loads_count}
            onChange={e => setField('loads_count', e.target.value)}
            min="1"
            className="w-full text-base text-gray-900 outline-none bg-transparent"
          />
        </div>

        {/* PO */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">PO Number <span className="text-gray-400">(optional)</span></label>
          <input
            type="text"
            value={form.po_number}
            onChange={e => setField('po_number', e.target.value)}
            placeholder="Optional"
            className="w-full text-base text-gray-900 outline-none bg-transparent"
          />
        </div>

        {/* Notes */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
          <textarea
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
            rows={2}
            placeholder="Optional"
            className="w-full text-base text-gray-900 outline-none bg-transparent resize-none"
          />
        </div>

        {/* Billing preview */}
        {(billing.client_charge_total || billing.driver_pay_total) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs space-y-1">
            {billing.client_charge_total && <p className="text-blue-800">Client charge: <strong>${billing.client_charge_total}</strong></p>}
            {billing.driver_pay_total && <p className="text-blue-700">Driver pay: <strong>${billing.driver_pay_total}</strong></p>}
          </div>
        )}
      </div>

      {/* Actions — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3">
        <button
          onClick={() => { setForm(empty); setPhotoFile(null); setPhotoPreview(null); setScanWarning(false) }}
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
