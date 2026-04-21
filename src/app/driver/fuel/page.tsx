'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'

export default function FuelPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()

  const [gallons, setGallons] = useState('')
  const [pricePerGallon, setPricePerGallon] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const total = gallons && pricePerGallon
    ? (parseFloat(gallons) * parseFloat(pricePerGallon)).toFixed(2)
    : null

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
    } catch {}
    setScanning(false)
  }

  async function handleSubmit() {
    if (!gallons || !pricePerGallon || !profile) return
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

    const totalCost = parseFloat(gallons) * parseFloat(pricePerGallon)
    const logDate = new Date().toISOString().split('T')[0]

    await supabase.from('fuel_logs').insert({
      company_id: profile.company_id,
      driver_id: profile.id,
      gallons: parseFloat(gallons),
      price_per_gallon: parseFloat(pricePerGallon),
      receipt_url,
      latitude,
      longitude,
      logged_at: new Date().toISOString(),
    })

    // Pull current daily log to increment fuel totals
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
      total_fuel_cost: parseFloat(((existing?.total_fuel_cost ?? 0) + totalCost).toFixed(2)),
    }, { onConflict: 'driver_id,log_date' })

    setSuccess(true)
    setTimeout(() => router.push('/driver'), 2000)
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="text-5xl mb-4">⛽</div>
        <h2 className="text-xl font-semibold text-gray-900">Fuel Stop Logged</h2>
        <p className="text-gray-500 mt-1">{gallons} gal @ ${pricePerGallon}/gal = <strong>${total}</strong></p>
        <p className="text-xs text-gray-400 mt-4">Returning to home...</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Log Fuel Stop</h1>

      {/* Scan Receipt */}
      <label className={`flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed rounded-lg cursor-pointer text-sm font-medium mb-6 transition-colors ${scanning ? 'border-gray-300 text-gray-400' : 'border-gray-400 text-gray-700 hover:border-gray-600'}`}>
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptPhoto} disabled={scanning} />
        {scanning ? (
          <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />Reading receipt...</>
        ) : receiptPreview ? (
          <>
            <img src={receiptPreview} alt="Receipt" className="h-8 w-8 object-cover rounded" />
            <span className="text-green-700">Receipt scanned — tap to replace</span>
          </>
        ) : (
          <>📷 Snap Receipt (auto-fills fields)</>
        )}
      </label>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gallons</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            placeholder="0.000"
            value={gallons}
            onChange={e => setGallons(e.target.value)}
            className="w-full px-3 py-4 border border-gray-300 rounded text-2xl text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price per Gallon</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-semibold text-gray-400">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              placeholder="0.000"
              value={pricePerGallon}
              onChange={e => setPricePerGallon(e.target.value)}
              className="w-full pl-8 pr-3 py-4 border border-gray-300 rounded text-2xl text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        {total && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">Total Cost</span>
            <span className="text-2xl font-bold text-gray-900">${total}</span>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!gallons || !pricePerGallon || submitting}
        className="w-full py-4 bg-[#1a1a1a] text-white text-base font-medium rounded-lg disabled:opacity-40"
      >
        {submitting ? 'Logging...' : 'Log Fuel Stop'}
      </button>
    </div>
  )
}
