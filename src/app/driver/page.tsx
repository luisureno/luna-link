'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MapPin, PlusCircle, List, Fuel, X, ChevronDown, ChevronUp, Download, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import type { AccountType } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DayStartModal } from '@/components/DayStartModal'
import type { LoadTicket, CheckIn, PreTripInspection, FuelLog, Dispatch } from '@/types'
import { formatDate } from '@/lib/format'
import { AppLoader } from '@/components/AppLoader'
import { Lightbox } from '@/components/ui/Lightbox'
import { useLanguage } from '@/context/LanguageContext'

export default function DriverTodayPage() {
  const { profile, accountType, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const isSolo = accountType === 'solo'
  const supabase = useMemo(() => createClient(), [])
  const today = new Date().toISOString().split('T')[0]

  const [tickets, setTickets] = useState<LoadTicket[]>([])
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null)
  const [inspection, setInspection] = useState<PreTripInspection | null | undefined>(undefined)
  const [fuelToday, setFuelToday] = useState<FuelLog[]>([])
  const [dispatches, setDispatches] = useState<(Dispatch & { clients: { name: string } | null, job_sites: { name: string } | null })[]>([])

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

    const [ticketsRes, checkInsRes, inspectionRes, fuelRes, dispatchRes] = await Promise.all([
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
      supabase
        .from('fuel_logs')
        .select('*')
        .eq('driver_id', id)
        .gte('logged_at', `${today}T00:00:00`),
      supabase
        .from('dispatch_assignments')
        .select('dispatches!inner(*, clients(name), job_sites(name))')
        .eq('driver_id', id)
        .eq('dispatches.scheduled_date', today)
        .in('dispatches.status', ['pending', 'active']),
    ])

    setTickets(ticketsRes.data ?? [])
    setLastCheckIn((checkInsRes.data ?? [])[0] ?? null)
    setInspection((inspectionRes.data ?? [])[0] ?? null)
    setFuelToday((fuelRes as { data: FuelLog[] }).data ?? [])
    const dispatchRows = (dispatchRes.data ?? []).map((r: any) => r.dispatches).filter(Boolean)
    setDispatches(dispatchRows)

    setLoading(false)
  }

  const firstCheckIn = lastCheckIn
  const hoursOnClock = firstCheckIn
    ? ((Date.now() - new Date(firstCheckIn.checked_in_at).getTime()) / 3600000).toFixed(1)
    : '0.0'

  const payType = profile?.pay_type ?? null
  const payRate = profile?.pay_rate ?? null

  // Sum hours_worked from today's tickets (hourly workers)
  const ticketHours = tickets.reduce((sum, t) => {
    const fw = (t.form_data ?? {}) as Record<string, unknown>
    const h = (t as any).hours_worked ?? (fw.hours_worked ? parseFloat(String(fw.hours_worked)) : 0)
    return sum + (Number(h) || 0)
  }, 0)

  const earnings = payType && payRate != null
    ? payType === 'per_load'
      ? payRate * tickets.length
      : payRate * ticketHours
    : null

  const companyName = (profile as any)?.companies?.name as string | undefined
  const firstName = profile?.full_name?.split(' ')[0] ?? ''
  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('greeting.morning') : hour < 17 ? t('greeting.afternoon') : t('greeting.evening')
  const fieldLabels: Record<string, string> = {
    ticket_date: t('field.ticketDate'), tag_number: t('field.tagNumber'), quarry_tag_number: t('field.quarryTagNumber'),
    client_name: t('field.clientName'), job_site: t('field.jobSite'), origin: t('field.origin'),
    destination: t('field.destination'), material_type: t('field.materialType'), weight_tons: t('field.weightTons'),
    gross_weight_lbs: t('field.grossWeightLbs'), tare_weight_lbs: t('field.tareWeightLbs'),
    loads_count: t('field.loadsCount'), hours_worked: t('field.hoursWorked'), truck_number: t('field.truckNumber'),
    trailer_number: t('field.trailerNumber'), driver_name: t('field.driverName'), po_number: t('field.poNumber'),
    rate_amount: t('field.rateAmount'), total_amount: t('field.totalAmount'), notes: t('field.notes'),
  }

  if (authLoading || loading) return <AppLoader message="Loading your day…" />

  return (
    <div className="p-4 pb-28 space-y-4">
      {/* Welcome header */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {firstName}</h1>
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
              <p className="text-sm font-semibold text-amber-800">{t('inspection.required')}</p>
              <p className="text-xs text-amber-600 mt-0.5">{t('inspection.completeBefore')}</p>
            </div>
            <span className="text-amber-700 font-medium text-sm">{t('inspection.startArrow')}</span>
          </div>
        </Link>
      )}
      {inspection?.overall_status === 'passed' && !inspectionDismissed && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-800">{t('inspection.passed')}</p>
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
            <p className="text-sm font-semibold text-red-800">{t('inspection.issuesReported')}</p>
            <p className="text-xs text-red-600 mt-0.5">{(inspection.items as any[]).filter(i => !i.passed).length} {t('inspection.itemsFlagged')}</p>
          </div>
        </div>
      )}

      {/* Status pill */}
      {!isSolo && (
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lastCheckIn ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className={`text-xs font-medium capitalize ${lastCheckIn ? 'text-green-700' : 'text-gray-400'}`}>
            {lastCheckIn ? lastCheckIn.location_type.replace('_', ' ') : t('status.notCheckedIn')}
          </span>
        </div>
      )}

      {/* Stat boxes */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <p className="text-2xl font-bold text-gray-900">{tickets.length}</p>
          <p className="text-xs text-gray-500 mt-1">{t('stats.loads')}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <p className="text-2xl font-bold text-gray-900">{earnings !== null ? `$${earnings.toFixed(0)}` : '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{t('stats.earned')}</p>
        </div>
      </div>



      {/* Dispatches */}
      {!isSolo && dispatches.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
            <Send size={13} className="text-gray-500" />
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {dispatches.length === 1 ? 'Your Dispatch Today' : `Your Dispatches Today — ${dispatches.length}`}
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {dispatches.map(d => (
              <div key={d.id} className="px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{d.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {d.clients?.name && <p className="text-xs text-gray-500">{d.clients.name}</p>}
                  {d.job_sites?.name && <><span className="text-gray-300">·</span><p className="text-xs text-gray-500">{d.job_sites.name}</p></>}
                  {d.notes && <><span className="text-gray-300">·</span><p className="text-xs text-gray-400 italic">{d.notes}</p></>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-col gap-3">
        {!isSolo && (
          <Link href="/driver/checkin" className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-6 hover:bg-gray-50">
            <MapPin size={26} className="text-gray-700" />
            <span className="text-sm font-semibold text-gray-700">{t('action.checkIn')}</span>
          </Link>
        )}
        <Link href="/driver/ticket" className="flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] text-white rounded-xl py-6 hover:opacity-90">
          <PlusCircle size={26} />
          <span className="text-sm font-semibold">{t('action.submitTicket')}</span>
        </Link>
        <Link href="/driver/fuel" className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-6 hover:bg-gray-50">
          <Fuel size={26} className="text-gray-700" />
          <span className="text-sm font-semibold text-gray-700">{t('action.logFuel')}</span>
        </Link>
      </div>

      {/* Today's Logs */}
      <div>
        <h2 className="text-base font-medium text-gray-900 mb-2">{t('today.logs')}</h2>
        <div className="space-y-2">

          {/* Pre-Trip Report */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <List size={14} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('inspection.title')}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {inspection === undefined
                      ? '…'
                      : inspection === null
                      ? t('inspection.notCompleted')
                      : inspection.overall_status === 'passed'
                      ? `${t('inspection.passedStatus')} · ${new Date(inspection.inspected_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                      : `${(inspection.items as any[]).filter((i: any) => !i.passed).length} ${t('inspection.itemsFlagged')}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {inspection === null ? (
                  <Link href="/driver/inspection" className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg font-medium">
                    {t('inspection.start')}
                  </Link>
                ) : inspection?.overall_status === 'passed' ? (
                  <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium">{t('inspection.passedStatus')}</span>
                ) : inspection?.overall_status === 'failed' ? (
                  <span className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-medium">{t('inspection.issuesStatus')}</span>
                ) : null}
                {inspection?.pdf_url && (
                  <a
                    href={inspection.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-medium min-w-[52px] justify-center"
                  >
                    <Download size={13} />
                    {t('inspection.pdf')}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Load Tickets */}
          {tickets.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                <PlusCircle size={13} className="text-gray-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('today.loadsSubmitted').replace('{count}', String(tickets.length))}</p>
              </div>
              <div className="divide-y divide-gray-100">
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
                    <div key={ticket.id}>
                      <button
                        onClick={() => {
                          if (!isOpen) initEdit(ticket)
                          setExpandedTicket(isOpen ? null : ticket.id)
                        }}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {tagNum ? `Tag #${tagNum}` : t('ticket.noTagNumber')}
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
                              <p className="text-xs text-center text-gray-400 py-1">{t('ticket.tapFullScreen')}</p>
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(fields).map(([key, value]) => (
                              <div key={key} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-gray-400 mb-0.5">{fieldLabels[key] ?? key.replace(/_/g, ' ')}</p>
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
                            {saving[ticket.id] ? t('ticket.saving') : t('ticket.saveChanges')}
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
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <PlusCircle size={13} className="text-gray-400 shrink-0" />
              <p className="text-sm text-gray-400">{t('today.noLoads')}</p>
            </div>
          )}

          {/* Fuel Logs */}
          {fuelToday.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                <Fuel size={13} className="text-gray-500" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Fuel — {fuelToday.length} log{fuelToday.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="divide-y divide-gray-100">
                {fuelToday.map(log => (
                  <div key={log.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{Number(log.gallons).toFixed(3)} gal · ${Number(log.price_per_gallon).toFixed(3)}/gal</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(log.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {(log as any).def_gallons ? ` · DEF: ${Number((log as any).def_gallons).toFixed(3)} gal` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 shrink-0">${Number(log.total_cost).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  )
}
