'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'

export default function FuelPage() {
  const { profile, accountType } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const homePath = '/driver'

  // Diesel
  const [gallons, setGallons] = useState('')
  const [pricePerGallon, setPricePerGallon] = useState('')
  const [totalOverride, setTotalOverride] = useState('') // when no gallons/ppg on receipt
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  // DEF
  const [addDef, setAddDef] = useState(false)
  const [defGallons, setDefGallons] = useState('')
  const [defPricePerGallon, setDefPricePerGallon] = useState('')
  const [defTotalOverride, setDefTotalOverride] = useState('')
  const [defReceiptFile, setDefReceiptFile] = useState<File | null>(null)
  const [defReceiptPreview, setDefReceiptPreview] = useState<string | null>(null)
  const [scanningDef, setScanningDef] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Calculated totals
  const dieselTotal = totalOverride
    ? parseFloat(totalOverride)
    : gallons && pricePerGallon
    ? parseFloat(gallons) * parseFloat(pricePerGallon)
    : null

  const defTotal = defTotalOverride
    ? parseFloat(defTotalOverride)
    : defGallons && defPricePerGallon
    ? parseFloat(defGallons) * parseFloat(defPricePerGallon)
    : null

  const grandTotal = ((dieselTotal ?? 0) + (addDef ? (defTotal ?? 0) : 0)) || null

  const canSubmit = dieselTotal !== null && dieselTotal > 0

  async function handleReceiptPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
    setScanning(true)

    const fd = new FormData()
    fd.append('image', file)
    try {
      const res = await fetch('/api/scan/receipt', { method: 'POST', body: fd })
      const { extracted } = await res.json()
      if (extracted?.gallons) setGallons(String(extracted.gallons))
      if (extracted?.price_per_gallon) setPricePerGallon(String(extracted.price_per_gallon))
      if (extracted?.total_cost) setTotalOverride(String(extracted.total_cost))
      if (extracted?.def_gallons || extracted?.def_price_per_gallon) {
        setAddDef(true)
        if (extracted.def_gallons) setDefGallons(String(extracted.def_gallons))
        if (extracted.def_price_per_gallon) setDefPricePerGallon(String(extracted.def_price_per_gallon))
      }
    } catch {}
    setScanning(false)
  }

  async function handleDefReceiptPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setDefReceiptFile(file)
    setDefReceiptPreview(URL.createObjectURL(file))
    setScanningDef(true)

    const fd = new FormData()
    fd.append('image', file)
    try {
      const res = await fetch('/api/scan/receipt', { method: 'POST', body: fd })
      const { extracted } = await res.json()
      if (extracted?.def_gallons) setDefGallons(String(extracted.def_gallons))
      if (extracted?.def_price_per_gallon) setDefPricePerGallon(String(extracted.def_price_per_gallon))
      if (extracted?.def_total_cost) setDefTotalOverride(String(extracted.def_total_cost))
      if (!extracted?.def_gallons && extracted?.gallons) setDefGallons(String(extracted.gallons))
      if (!extracted?.def_price_per_gallon && extracted?.price_per_gallon) setDefPricePerGallon(String(extracted.price_per_gallon))
      if (!extracted?.def_total_cost && extracted?.total_cost) setDefTotalOverride(String(extracted.total_cost))
    } catch {}
    setScanningDef(false)
  }

  async function handleSubmit() {
    if (!canSubmit || !profile) return
    setSubmitting(true)
    try {
      let latitude: number | null = null
      let longitude: number | null = null
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        )
        latitude = pos.coords.latitude
        longitude = pos.coords.longitude
      } catch {}

      let receipt_url: string | null = null
      if (receiptFile) {
        const path = `${profile.id}/${Date.now()}-${receiptFile.name}`
        const { data: uploadData } = await supabase.storage
          .from('fuel-receipts')
          .upload(path, receiptFile, { contentType: receiptFile.type })
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('fuel-receipts').getPublicUrl(uploadData.path)
          receipt_url = publicUrl
        }
      }

      let def_receipt_url: string | null = null
      if (addDef && defReceiptFile) {
        const path = `${profile.id}/def-${Date.now()}-${defReceiptFile.name}`
        const { data: uploadData } = await supabase.storage
          .from('fuel-receipts')
          .upload(path, defReceiptFile, { contentType: defReceiptFile.type })
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('fuel-receipts').getPublicUrl(uploadData.path)
          def_receipt_url = publicUrl
        }
      }

      const totalCost = dieselTotal!
      const defTotalCost = addDef ? defTotal : null
      const logDate = new Date().toISOString().split('T')[0]

      await supabase.from('fuel_logs').insert({
        company_id: profile.company_id,
        driver_id: profile.id,
        gallons: gallons ? parseFloat(gallons) : 0,
        price_per_gallon: pricePerGallon ? parseFloat(pricePerGallon) : 0,
        total_cost: totalCost,
        receipt_url,
        def_gallons: addDef && defGallons ? parseFloat(defGallons) : null,
        def_price_per_gallon: addDef && defPricePerGallon ? parseFloat(defPricePerGallon) : null,
        def_total_cost: defTotalCost,
        def_receipt_url,
        latitude,
        longitude,
        logged_at: new Date().toISOString(),
      })

      const { data: existing } = await supabase
        .from('daily_logs')
        .select('fuel_stops, total_fuel_cost')
        .eq('driver_id', profile.id)
        .eq('log_date', logDate)
        .single()

      await supabase.from('daily_logs').upsert({
        company_id: profile.company_id,
        driver_id: profile.id,
        log_date: logDate,
        fuel_stops: (existing?.fuel_stops ?? 0) + 1,
        total_fuel_cost: parseFloat(((existing?.total_fuel_cost ?? 0) + totalCost + (defTotalCost ?? 0)).toFixed(2)),
      }, { onConflict: 'driver_id,log_date' })

      setSuccess(true)
      setTimeout(() => router.push(homePath), 2000)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="text-5xl mb-4">⛽</div>
        <h2 className="text-xl font-semibold text-gray-900">Fuel Stop Logged</h2>
        <p className="text-gray-500 mt-1">
          ${dieselTotal?.toFixed(2)} diesel
          {addDef && defTotal ? ` + $${defTotal.toFixed(2)} DEF` : ''}
        </p>
        <p className="text-xs text-gray-400 mt-4">Returning to home…</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-gray-900">Log Fuel Stop</h1>

      {/* ── Hero: Snap Receipt ──────────────────────────────────────── */}
      {!receiptPreview ? (
        <label className="block cursor-pointer">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleReceiptPhoto}
            disabled={scanning}
          />
          <div className={`relative w-full rounded-2xl overflow-hidden border-2 border-dashed transition-colors ${scanning ? 'border-gray-300 bg-gray-50' : 'border-gray-400 bg-white hover:border-gray-600 hover:bg-gray-50'}`}
            style={{ minHeight: 180 }}>
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-4">
              {scanning ? (
                <>
                  <span className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-gray-500">Reading receipt…</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                    <Camera size={28} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-900">Snap fuel receipt</p>
                    <p className="text-sm text-gray-500 mt-0.5">Auto-fills gallons & price</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </label>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          <img src={receiptPreview} alt="Fuel receipt" className="w-full object-cover max-h-56" style={{ filter: 'contrast(1.06) brightness(1.03)' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className="text-white text-sm font-medium drop-shadow">Receipt captured ✓</span>
            <label className="cursor-pointer bg-white/90 text-gray-900 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-white">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptPhoto} />
              Replace
            </label>
          </div>
        </div>
      )}

      {/* ── Diesel fields ───────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">⛽ Diesel</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Gallons</label>
            <input
              type="number" inputMode="decimal" step="0.001" min="0" placeholder="0.000"
              value={gallons} onChange={e => { setGallons(e.target.value); setTotalOverride('') }}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Price / gal</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
              <input
                type="number" inputMode="decimal" step="0.001" min="0" placeholder="0.000"
                value={pricePerGallon} onChange={e => { setPricePerGallon(e.target.value); setTotalOverride('') }}
                className="w-full pl-7 pr-3 py-3 border border-gray-200 rounded-xl text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Total override — when receipt only shows total */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Total paid <span className="text-gray-400 font-normal">(enter directly if receipt has no gallons)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
            <input
              type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
              value={totalOverride} onChange={e => { setTotalOverride(e.target.value); setGallons(''); setPricePerGallon('') }}
              className="w-full pl-7 pr-3 py-3 border border-gray-200 rounded-xl text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        {dieselTotal !== null && dieselTotal > 0 && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-500">Diesel total</span>
            <span className="text-xl font-bold text-gray-900">${dieselTotal.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* ── DEF section ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl border-2 p-4 space-y-3 transition-colors ${addDef ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">🔵 DEF</p>
            <p className="text-sm font-medium text-gray-800">Diesel Exhaust Fluid</p>
          </div>
          <button
            type="button"
            onClick={() => setAddDef(v => !v)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${addDef ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {addDef ? 'Added ✓' : 'Add DEF'}
          </button>
        </div>

        {addDef && (
          <>
            {/* DEF snap receipt */}
            {!defReceiptPreview ? (
              <label className="block cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleDefReceiptPhoto} disabled={scanningDef} />
                <div className={`flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl text-sm font-medium transition-colors ${scanningDef ? 'border-blue-200 text-blue-300' : 'border-blue-400 text-blue-700 hover:border-blue-600'}`}>
                  {scanningDef
                    ? <><span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />Reading DEF receipt…</>
                    : <><Camera size={16} />Snap DEF receipt (optional)</>}
                </div>
              </label>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-blue-200">
                <img src={defReceiptPreview} alt="DEF receipt" className="w-full object-cover max-h-32" />
                <div className="absolute bottom-2 right-2">
                  <label className="cursor-pointer bg-white/90 text-gray-900 text-xs font-medium px-2 py-1 rounded-full">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleDefReceiptPhoto} />
                    Replace
                  </label>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-blue-800 mb-1">DEF Gallons</label>
                <input
                  type="number" inputMode="decimal" step="0.001" min="0" placeholder="0.000"
                  value={defGallons} onChange={e => { setDefGallons(e.target.value); setDefTotalOverride('') }}
                  className="w-full px-3 py-3 border border-blue-200 rounded-xl text-lg font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-800 mb-1">Price / gal</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                  <input
                    type="number" inputMode="decimal" step="0.001" min="0" placeholder="0.000"
                    value={defPricePerGallon} onChange={e => { setDefPricePerGallon(e.target.value); setDefTotalOverride('') }}
                    className="w-full pl-7 pr-3 py-3 border border-blue-200 rounded-xl text-lg font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-blue-800 mb-1">
                DEF total paid <span className="text-blue-400 font-normal">(if no gallons on receipt)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                  value={defTotalOverride} onChange={e => { setDefTotalOverride(e.target.value); setDefGallons(''); setDefPricePerGallon('') }}
                  className="w-full pl-7 pr-3 py-3 border border-blue-200 rounded-xl text-lg font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {defTotal !== null && defTotal > 0 && (
              <div className="flex items-center justify-between bg-blue-100 rounded-xl px-4 py-3">
                <span className="text-sm text-blue-700">DEF total</span>
                <span className="text-xl font-bold text-blue-900">${defTotal.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Grand total ─────────────────────────────────────────────── */}
      {grandTotal !== null && grandTotal > 0 && (
        <div className="bg-[#1a1a1a] rounded-2xl p-4 flex items-center justify-between">
          <span className="text-sm text-white/70">Total fuel spend</span>
          <span className="text-2xl font-bold text-white">${grandTotal.toFixed(2)}</span>
        </div>
      )}

      {/* ── Submit ──────────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full py-4 bg-[#1a1a1a] text-white text-base font-semibold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {submitting
          ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Logging…</>
          : 'Log Fuel Stop ✓'}
      </button>

      <div className="h-4" /> {/* BottomNav clearance */}
    </div>
  )
}
