'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MapPin, PlusCircle, List, Fuel, DollarSign, Building2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import type { AccountType } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DayStartModal } from '@/components/DayStartModal'
import type { LoadTicket, CheckIn, PreTripInspection, FuelLog } from '@/types'

export default function DriverTodayPage() {
  const { profile, accountType } = useAuth()
  const isSolo = accountType === 'solo'
  const supabase = useMemo(() => createClient(), [])
  const today = new Date().toISOString().split('T')[0]

  const [tickets, setTickets] = useState<LoadTicket[]>([])
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null)
  const [inspection, setInspection] = useState<PreTripInspection | null | undefined>(undefined)
  const [fuelToday, setFuelToday] = useState<FuelLog[]>([])
  const [clientCount, setClientCount] = useState(0)
  const [weekRevenue, setWeekRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [inspectionDismissed, setInspectionDismissed] = useState(false)
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    loadData()
  }, [profile?.id])

  async function loadData() {
    const id = profile!.id
    const companyId = profile!.company_id
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    const weekStartStr = weekStart.toISOString().split('T')[0]

    const [ticketsRes, checkInsRes, inspectionRes, fuelRes, clientsRes, weekTicketsRes] = await Promise.all([
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
      isSolo && companyId
        ? supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
        : Promise.resolve({ count: 0 }),
      isSolo
        ? supabase
            .from('load_tickets')
            .select('id')
            .eq('driver_id', id)
            .gte('submitted_at', `${weekStartStr}T00:00:00`)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ])

    setTickets(ticketsRes.data ?? [])
    setLastCheckIn((checkInsRes.data ?? [])[0] ?? null)
    setInspection((inspectionRes.data ?? [])[0] ?? null)
    setFuelToday((fuelRes as { data: FuelLog[] }).data ?? [])
    setClientCount((clientsRes as { count: number | null }).count ?? 0)

    const payTypeLocal = profile!.pay_type ?? null
    const payRateLocal = profile!.pay_rate ?? null
    const weekLoads = ((weekTicketsRes as { data: { id: string }[] }).data ?? []).length
    const estRev = payTypeLocal === 'per_load' && payRateLocal ? weekLoads * Number(payRateLocal) : 0
    setWeekRevenue(estRev)

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

  return (
    <div className="p-4 pb-28 space-y-4">
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
              <p className="text-sm font-semibold text-amber-800">⚠️ Pre-Trip Inspection Required</p>
              <p className="text-xs text-amber-600 mt-0.5">Complete before starting your day</p>
            </div>
            <span className="text-amber-700 font-medium text-sm">Start →</span>
          </div>
        </Link>
      )}
      {inspection?.overall_status === 'passed' && !inspectionDismissed && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-800">✅ Pre-Trip Inspection Passed</p>
            <p className="text-xs text-green-600 mt-0.5">{new Date(inspection.inspected_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
          </div>
          <button onClick={() => setInspectionDismissed(true)} className="p-1 text-green-600 hover:text-green-800 ml-3 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}
      {inspection?.overall_status === 'failed' && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-800">⚠️ Issues Reported — Dispatcher Notified</p>
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
        <div className="flex items-center gap-6 mt-2">
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

      {/* Business snapshot — solo only */}
      {isSolo && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Business snapshot</p>
            <Link href="/dashboard/solo/invoices" className="text-xs font-medium text-gray-600 hover:text-gray-900">
              Invoices →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <DollarSign size={14} className="text-gray-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">${weekRevenue.toFixed(0)}</p>
                <p className="text-[11px] text-gray-500">Est. 7-day revenue</p>
              </div>
            </div>
            <Link href="/dashboard/solo/clients" className="flex items-center gap-2 hover:opacity-80">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Building2 size={14} className="text-gray-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{clientCount}</p>
                <p className="text-[11px] text-gray-500">Client{clientCount === 1 ? '' : 's'}</p>
              </div>
            </Link>
          </div>
        </div>
      )}

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
              const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              const photoUrl = ticket.tag_photo_url ?? (ticket as any).scanned_invoice_photo_url ?? null
              const isOpen = expandedTicket === ticket.id

              return (
                <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedTicket(isOpen ? null : ticket.id)}
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
                          className="block w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
                        >
                          <img src={photoUrl} alt="Scanned ticket" className="w-full object-contain max-h-48" />
                          <p className="text-xs text-center text-gray-400 py-1">Tap to view full screen</p>
                        </button>
                      )}
                      <div className="space-y-1.5">
                        {Object.entries(fd)
                          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
                          .map(([key, value]) => (
                            <div key={key} className="flex justify-between gap-4 text-sm">
                              <span className="text-gray-500 flex-shrink-0 capitalize">{key.replace(/_/g, ' ')}</span>
                              <span className="text-gray-900 font-medium text-right">{String(value)}</span>
                            </div>
                          ))}
                        {ticket.loads_count != null && !fd.loads_count && (
                          <div className="flex justify-between gap-4 text-sm">
                            <span className="text-gray-500 flex-shrink-0">Loads</span>
                            <span className="text-gray-900 font-medium text-right">{ticket.loads_count}</span>
                          </div>
                        )}
                        {ticket.weight_tons && !fd.weight_tons && (
                          <div className="flex justify-between gap-4 text-sm">
                            <span className="text-gray-500 flex-shrink-0">Weight (tons)</span>
                            <span className="text-gray-900 font-medium text-right">{ticket.weight_tons}</span>
                          </div>
                        )}
                        {ticket.material_type && !fd.material_type && (
                          <div className="flex justify-between gap-4 text-sm">
                            <span className="text-gray-500 flex-shrink-0">Material</span>
                            <span className="text-gray-900 font-medium text-right">{ticket.material_type}</span>
                          </div>
                        )}
                        {ticket.tag_number && !fd.tag_number && (
                          <div className="flex justify-between gap-4 text-sm">
                            <span className="text-gray-500 flex-shrink-0">Tag #</span>
                            <span className="text-gray-900 font-medium text-right">{ticket.tag_number}</span>
                          </div>
                        )}
                      </div>
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
