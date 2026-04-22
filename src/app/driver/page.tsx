'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MapPin, PlusCircle, List, Fuel, X, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import type { AccountType } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DayStartModal } from '@/components/DayStartModal'
import type { LoadTicket, CheckIn, PreTripInspection, FuelLog } from '@/types'
import { formatDate } from '@/lib/format'

const FIELD_LABELS: Record<string, string> = {
  ticket_date: 'Date', tag_number: 'Tag #', quarry_tag_number: 'Quarry Tag #', client_name: 'Client',
  job_site: 'Job Site', origin: 'Origin', destination: 'Destination',
  material_type: 'Material', weight_tons: 'Weight (tons)',
  gross_weight_lbs: 'Gross (lbs)', tare_weight_lbs: 'Tare (lbs)',
  loads_count: 'Loads', hours_worked: 'Hours', truck_number: 'Truck #',
  trailer_number: 'Trailer #', driver_name: 'Driver', po_number: 'PO #',
  rate_amount: 'Rate', total_amount: 'Total', notes: 'Notes',
}

export default function DriverTodayPage() {
  const { profile, accountType } = useAuth()
  const isSolo = accountType === 'solo'
  const supabase = useMemo(() => createClient(), [])
  const today = new Date().toISOString().split('T')[0]

  const [tickets, setTickets] = useState<LoadTicket[]>([])
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null)
  const [inspection, setInspection] = useState<PreTripInspection | null | undefined>(undefined)
  const [fuelToday, setFuelToday] = useState<FuelLog[]>([])

  const [loading, setLoading] = useState(true)
  const [inspectionDismissed, setInspectionDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('inspection_dismissed') === today
  })
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  function initEdit(ticket: LoadTicket) {
    if (editData[ticket.id]) return
    const fd = (ticket.form_data ?? {}) as Record<string, unknown>
    const merged: Record<string, string> = {}
    Object.entries(fd).forEach(([k, v]) => {
      if (v !== null && v !== undefined && String(v).trim() !== '') merged[k] = String(v)
    })
    if (ticket.tag_number && !merged.tag_number) merged.tag_number = ticket.tag_number
    if (ticket.weight_tons != null && !merged.weight_tons) merged.weight_tons = String(ticket.weight_tons)
    if (ticket.material_type && !merged.material_type) merged.material_type = ticket.material_type
    if ((ticket as any).loads_count != null && !merged.loads_count) merged.loads_count = String((ticket as any).loads_count)
    setEditData(prev => ({ ...prev, [ticket.id]: merged }))
  }

  async function saveTicket(ticketId: string) {
    const data = editData[ticketId]
    if (!data) return
    setSaving(prev => ({ ...prev, [ticketId]: true }))
    const update: Record<string, unknown> = { form_data: data }
    if (data.tag_number !== undefined) update.tag_number = data.tag_number || null
    if (data.weight_tons !== undefined) update.weight_tons = data.weight_tons ? parseFloat(data.weight_tons) : null
    if (data.material_type !== undefined) update.material_type = data.material_type || null
    if (data.loads_count !== undefined) update.loads_count = data.loads_count ? parseInt(data.loads_count) : null
    await supabase.from('load_tickets').update(update).eq('id', ticketId)
    setSaving(prev => ({ ...prev, [ticketId]: false }))
    loadData()
  }

  useEffect(() => {
    if (!profile?.id || accountType === null) return
    loadData()
  }, [profile?.id, accountType])

  async function loadData() {
    const id = profile!.id

    const [ticketsRes, checkInsRes, inspectionRes, fuelRes] = await Promise.all([
      supabase
        .from('load_tickets')
        .select('*')
        .eq('driver_id', id)
        .gte('submitted_at', `${today}T00:00:00`)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('check_ins')
        .select('*')
        .eq('driver_id', id)
        .gte('checked_in_at', `${today}T00:00:00`)
        .order('checked_in_at', { ascending: false })
        .limit(1),
      supabase
        .from('pre_trip_inspections')
        .select('*')
        .eq('driver_id', id)
        .gte('inspected_at', `${today}T00:00:00`)
        .order('inspected_at', { ascending: false })
        .limit(1),
      isSolo
        ? supabase
            .from('fuel_logs')
            .select('*')
            .eq('driver_id', id)
            .gte('logged_at', `${today}T00:00:00`)
        : Promise.resolve({ data: [] as FuelLog[] }),
    ])

    setTickets(ticketsRes.data ?? [])
    setLastCheckIn((checkInsRes.data ?? [])[0] ?? null)
    setInspection((inspectionRes.data ?? [])[0] ?? null)
    setFuelToday((fuelRes as { data: FuelLog[] }).data ?? [])

    setLoading(false)
  }

  const firstCheckIn = lastCheckIn
  const hoursOnClock = firstCheckIn
    ? ((Date.now() - new Date(firstCheckIn.checked_in_at).getTime()) / 3600000).toFixed(1)
    : '0.0'

  const payType = profile?.pay_type ?? null
  const payRate = profile?.pay_rate ?? null
  const earnings = payType && payRate != null
    ? payType === 'per_load'
      ? payRate * tickets.length
      : payRate * parseFloat(hoursOnClock)
    : null

  const companyName = (profile as any)?.companies?.name as string | undefined
  const firstName = profile?.full_name?.split(' ')[0] ?? ''
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-4 pb-28 space-y-4">
      {/* Welcome header */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{greeting}</p>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {firstName}</h1>
        {isSolo && companyName && (
          <p className="text-sm text-gray-500 mt-0.5">{companyName}</p>
        )}
      </div>

      {profile && inspection !== undefined && (
        <DayStartModal
          name={profile.full_name}
          userId={profile.id}
          inspectionDone={inspection !== null}
        />
      )}

      {/* Pre-Trip Inspection Card */}
      {inspection === null && (
        <Link href="/driver/inspection" className="block bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800">Pre-Trip Inspection Required</p>
              <p className="text-xs text-amber-600 mt-0.5">Complete before starting your day</p>
            </div>
            <span className="text-amber-700 font-medium text-sm">Start →</span>
          </div>
        </Link>
      )}
      {inspection?.overall_status === 'passed' && !inspectionDismissed && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-800">Pre-Trip Inspection Passed</p>
            <p className="text-xs text-green-600 mt-0.5">{new Date(inspection.inspected_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
          </div>
          <button onClick={() => { localStorage.setItem('inspection_dismissed', today); setInspectionDismissed(true) }} className="p-1 text-green-600 hover:text-green-800 ml-3 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}
      {inspection?.overall_status === 'failed' && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-800">Issues Reported — Dispatcher Notified</p>
            <p className="text-xs text-red-600 mt-0.5">{(inspection.items as any[]).filter(i => !i.passed).length} item(s) flagged</p>
          </div>
        </div>
      )}

      {/* Earnings Card */}
      {earnings !== null && (
        <div className="bg-[#1a1a1a] rounded-lg p-5">
          <p className="text-xs text-gray-400 mb-1">Today's Earnings</p>
          <p className="text-4xl font-bold text-white">${earnings.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {payType === 'per_load'
              ? `$${Number(payRate).toFixed(2)}/load × ${tickets.length} load${tickets.length !== 1 ? 's' : ''}`
              : `$${Number(payRate).toFixed(2)}/hr × ${hoursOnClock}h`}
          </p>
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-xs text-gray-500 mb-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <div>
            <p className="text-3xl font-semibold text-gray-900">{tickets.length}</p>
            <p className="text-xs text-gray-500">Loads today</p>
          </div>
          {isSolo && (
            <div>
              <p className="text-3xl font-semibold text-gray-900">
                ${fuelToday.reduce((sum, f) => sum + Number(f.total_cost ?? 0) + Number((f as any).def_total_cost ?? 0), 0).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500">Fuel today</p>
            </div>
          )}
          {!isSolo && (
            <div>
              <p className="text-3xl font-semibold text-gray-900">{hoursOnClock}h</p>
              <p className="text-xs text-gray-500">On the clock</p>
            </div>
          )}
          {!isSolo && lastCheckIn && (
            <div>
              <p className="text-sm font-medium text-green-600 capitalize">{lastCheckIn.location_type.replace('_', ' ')}</p>
              <p className="text-xs text-gray-500">Current status</p>
            </div>
          )}
        </div>
      </div>



      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {!isSolo && (
          <Link href="/driver/checkin" className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg p-4 min-h-[80px] hover:bg-gray-50">
            <MapPin size={22} className="text-gray-700" />
            <span className="text-xs font-medium text-gray-700">Check In</span>
          </Link>
        )}
        <Link href="/driver/ticket" className={`flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] text-white rounded-lg p-4 min-h-[80px] hover:bg-gray-800 ${isSolo ? 'col-span-2' : ''}`}>
          <PlusCircle size={22} />
          <span className="text-xs font-medium">Submit Ticket</span>
        </Link>
        <Link href="/driver/fuel" className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg p-4 min-h-[80px] hover:bg-gray-50">
          <Fuel size={22} className="text-gray-700" />
          <span className="text-xs font-medium text-gray-700">Log Fuel</span>
        </Link>
        <Link href="/driver/loads" className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg p-4 min-h-[80px] hover:bg-gray-50">
          <List size={22} className="text-gray-700" />
          <span className="text-xs font-medium text-gray-700">My Loads</span>
        </Link>
        {isSolo && (
          <Link href="/dashboard/solo/fuel" className="col-span-2 flex items-center justify-between gap-3 bg-blue-600 text-white rounded-lg px-5 py-4 hover:bg-blue-700">
            <div>
              <p className="text-xs font-medium text-blue-200">Diesel near you</p>
              <p className="text-sm font-semibold">Find Cheap Fuel</p>
            </div>
            <MapPin size={22} className="text-blue-200" />
          </Link>
        )}
      </div>

      {/* Today's Load History */}
      {tickets.length > 0 && (
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-2">Today's Loads</h2>
          <div className="space-y-2">
            {tickets.map(ticket => {
              const fd = (ticket.form_data ?? {}) as Record<string, unknown>
              const tagNum = fd.tag_number || ticket.tag_number
              const dt = new Date(ticket.submitted_at)
              const dateStr = formatDate(dt)
              const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              const photoUrl = ticket.tag_photo_url ?? ticket.scanned_invoice_photo_url ?? (ticket.photo_urls ?? [])[0] ?? null
              const isOpen = expandedTicket === ticket.id
              const fields = editData[ticket.id] ?? {}

              return (
                <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => {
                      if (!isOpen) initEdit(ticket)
                      setExpandedTicket(isOpen ? null : ticket.id)
                    }}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {tagNum ? `Tag #${tagNum}` : 'No tag number'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{dateStr} · {timeStr}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={ticket.status} />
                      {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 p-4 space-y-3">
                      {photoUrl && (
                        <button
                          onClick={() => setLightbox(photoUrl)}
                          className="block w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                        >
                          <img src={photoUrl} alt="Scanned ticket" className="w-full object-contain max-h-48" />
                          <p className="text-xs text-center text-gray-400 py-1">Tap to view full screen</p>
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(fields).map(([key, value]) => (
                          <div key={key} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-400 mb-0.5">{FIELD_LABELS[key] ?? key.replace(/_/g, ' ')}</p>
                            <input
                              value={key === 'ticket_date' ? formatDate(value) : value}
                              onChange={e => setEditData(prev => ({ ...prev, [ticket.id]: { ...prev[ticket.id], [key]: e.target.value } }))}
                              className="w-full text-sm text-gray-900 outline-none bg-transparent"
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => saveTicket(ticket.id)}
                        disabled={saving[ticket.id]}
                        className="w-full py-2.5 bg-[#1a1a1a] text-white rounded-xl text-sm font-semibold disabled:opacity-60"
                      >
                        {saving[ticket.id] ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && tickets.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-500">No loads submitted yet today.</p>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2">
            <X size={24} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
