'use client'

import { useEffect, useMemo , useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/format'
import type { LoadTicket, FuelLog, PreTripInspection } from '@/types'
import { Lightbox } from '@/components/ui/Lightbox'
import { useLanguage } from '@/context/LanguageContext'

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function HistoryPage() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const supabase = useMemo(() => createClient(), [])

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set())
  const [dayTickets, setDayTickets] = useState<LoadTicket[]>([])
  const [dayFuelLogs, setDayFuelLogs] = useState<FuelLog[]>([])
  const [dayInspection, setDayInspection] = useState<PreTripInspection | null>(null)
  const [loadingDay, setLoadingDay] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const fieldLabels: Record<string, string> = {
    ticket_date: t('field.ticketDate'), tag_number: t('field.tagNumber'), quarry_tag_number: t('field.quarryTagNumber'),
    client_name: t('field.clientName'), job_site: t('field.jobSite'), origin: t('field.origin'),
    destination: t('field.destination'), material_type: t('field.materialType'), weight_tons: t('field.weightTons'),
    gross_weight_lbs: t('field.grossWeightLbs'), tare_weight_lbs: t('field.tareWeightLbs'),
    loads_count: t('field.loadsCount'), hours_worked: t('field.hoursWorked'), truck_number: t('field.truckNumber'),
    trailer_number: t('field.trailerNumber'), driver_name: t('field.driverName'), po_number: t('field.poNumber'),
    rate_amount: t('field.rateAmount'), total_amount: t('field.totalAmount'), notes: t('field.notes'),
  }

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
  }

  useEffect(() => {
    if (!profile?.id) return
    loadActiveDays()
  }, [profile?.id, year, month])

  async function loadActiveDays() {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${getDaysInMonth(year, month)}`

    const { data } = await supabase
      .from('daily_logs')
      .select('log_date')
      .eq('driver_id', profile!.id)
      .gte('log_date', start)
      .lte('log_date', end)

    const days = new Set((data ?? []).map(d => d.log_date))
    setActiveDays(days)
  }

  async function selectDate(date: string) {
    setSelectedDate(date)
    setLoadingDay(true)

    const [ticketsRes, fuelRes, inspectionRes] = await Promise.all([
      supabase.from('load_tickets').select('*').eq('driver_id', profile!.id).gte('submitted_at', `${date}T00:00:00`).lte('submitted_at', `${date}T23:59:59`).order('submitted_at'),
      supabase.from('fuel_logs').select('*').eq('driver_id', profile!.id).gte('logged_at', `${date}T00:00:00`).lte('logged_at', `${date}T23:59:59`).order('logged_at'),
      supabase.from('pre_trip_inspections').select('*').eq('driver_id', profile!.id).gte('inspected_at', `${date}T00:00:00`).lte('inspected_at', `${date}T23:59:59`).order('inspected_at', { ascending: false }).limit(1),
    ])

    setDayTickets(ticketsRes.data ?? [])
    setDayFuelLogs(fuelRes.data ?? [])
    setDayInspection((inspectionRes.data ?? [])[0] ?? null)
    setLoadingDay(false)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else { setMonth(m => m - 1) }
    setSelectedDate(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else { setMonth(m => m + 1) }
    setSelectedDate(null)
  }

  const fuelTotal = dayFuelLogs.reduce((s, f) => s + Number(f.total_cost), 0)

  return (
    <div className="p-4 pb-28">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">{t('history.title')}</h1>

      {/* Calendar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={18} /></button>
          <span className="text-sm font-medium">{monthName}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={18} /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {[t('cal.su'), t('cal.mo'), t('cal.tu'), t('cal.we'), t('cal.th'), t('cal.fr'), t('cal.sa')].map(d => (
            <div key={d} className="text-xs text-gray-400 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {[...Array(firstDay)].map((_, i) => <div key={`e${i}`} />)}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const hasActivity = activeDays.has(dateStr)
            const isSelected = selectedDate === dateStr
            const isToday = dateStr === now.toISOString().split('T')[0]

            return (
              <button
                key={day}
                onClick={() => selectDate(dateStr)}
                className={`relative py-2 rounded text-sm font-medium ${
                  isSelected ? 'bg-[#1a1a1a] text-white' : isToday ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {day}
                {hasActivity && !isSelected && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day Detail */}
      {selectedDate && (
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-3">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>

          {loadingDay ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-gray-900">{dayTickets.length}</p>
                  <p className="text-xs text-gray-500">{t('history.loads')}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-gray-900">{dayFuelLogs.length}</p>
                  <p className="text-xs text-gray-500">{t('history.fuelStops')}</p>
                </div>
                <div className={`border rounded-lg p-3 text-center ${dayInspection?.overall_status === 'passed' ? 'bg-green-50 border-green-200' : dayInspection?.overall_status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                  <p className="text-xl font-semibold text-gray-900">
                    {dayInspection ? (dayInspection.overall_status === 'passed' ? '✓' : '⚠') : '—'}
                  </p>
                  <p className="text-xs text-gray-500">{t('history.inspection')}</p>
                </div>
              </div>

              {/* Pre-Trip Inspection */}
              {dayInspection && (
                <div className={`bg-white border rounded-lg p-4 ${dayInspection.overall_status === 'failed' ? 'border-red-200' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">{t('history.inspectionTitle')}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dayInspection.overall_status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {dayInspection.overall_status === 'passed' ? t('history.passed') : t('history.issuesFound')}
                      </span>
                      {dayInspection.pdf_url && (
                        <a
                          href={dayInspection.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-medium"
                        >
                          <Download size={13} />
                          {t('history.pdf')}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(dayInspection.items as any[]).map((item: any) => (
                      <div key={item.id} className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className={`text-xs font-bold mt-0.5 shrink-0 ${item.passed ? 'text-green-600' : 'text-red-600'}`}>{item.passed ? '✓' : '✗'}</span>
                          <div className="flex-1">
                            <span className="text-sm text-gray-700">{item.label}</span>
                            {item.note && <p className="text-xs text-red-600 mt-0.5">{item.note}</p>}
                          </div>
                        </div>
                        {item.photo_url && (
                          <button
                            type="button"
                            onClick={() => setLightbox(item.photo_url)}
                            className="block w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50 ml-4"
                          >
                            <img src={item.photo_url} alt={item.label} className="w-full object-cover h-28" />
                            <p className="text-[10px] text-center text-gray-400 py-1">Tap to view full screen</p>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Load Tickets */}
              {dayTickets.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-gray-900">{t('history.loadTickets')} · {dayTickets.length}</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dayTickets.map(ticket => {
                      const fd = (ticket.form_data ?? {}) as Record<string, unknown>
                      const tagNum = ticket.tag_number ?? (fd.tag_number ? String(fd.tag_number) : null)
                      const photoUrl = ticket.tag_photo_url ?? ticket.scanned_invoice_photo_url ?? (ticket.photo_urls ?? [])[0] ?? null
                      const isOpen = expandedTicket === ticket.id
                      const fields = editData[ticket.id] ?? {}
                      return (
                        <div key={ticket.id}>
                          <button
                            onClick={() => { if (!isOpen) initEdit(ticket); setExpandedTicket(isOpen ? null : ticket.id) }}
                            className="w-full flex items-center justify-between p-4 text-left"
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{tagNum ? `Tag #${tagNum}` : t('history.noTagNumber')}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{fmt(ticket.submitted_at)}</p>
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
                                  <p className="text-xs text-center text-gray-400 py-1">{t('history.tapFullScreen')}</p>
                                </button>
                              )}
                              {Object.keys(fields).length > 0 && (
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
                              )}
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

              {/* Fuel Logs */}
              {dayFuelLogs.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-gray-900">{t('history.fuelStopsTitle')} · {dayFuelLogs.length}</h3>
                    <span className="text-sm font-semibold text-gray-700">${fuelTotal.toFixed(2)}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dayFuelLogs.map(f => {
                      const defCost = Number((f as any).def_total_cost ?? 0)
                      const stopTotal = Number(f.total_cost) + defCost
                      return (
                        <div key={f.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{Number(f.gallons).toFixed(3)} gal · ${Number(f.price_per_gallon).toFixed(3)}/gal</p>
                              {(f as any).def_gallons && (
                                <p className="text-xs text-blue-600 mt-0.5">DEF: {Number((f as any).def_gallons).toFixed(3)} gal · ${Number((f as any).def_price_per_gallon ?? 0).toFixed(3)}/gal</p>
                              )}
                              <p className="text-xs text-gray-400 mt-0.5">{fmt(f.logged_at)}</p>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 flex-shrink-0">${stopTotal.toFixed(2)}</span>
                          </div>
                          {(f.receipt_url || (f as any).def_receipt_url) && (
                            <div className="flex gap-2">
                              {f.receipt_url && (
                                <button
                                  onClick={() => setLightbox(f.receipt_url!)}
                                  className="flex-1 rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                                >
                                  <img src={f.receipt_url} alt="Fuel receipt" className="w-full object-cover h-28" />
                                  <p className="text-[10px] text-center text-gray-400 py-1">{t('history.fuelReceipt')}</p>
                                </button>
                              )}
                              {(f as any).def_receipt_url && (
                                <button
                                  onClick={() => setLightbox((f as any).def_receipt_url)}
                                  className="flex-1 rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                                >
                                  <img src={(f as any).def_receipt_url} alt="DEF receipt" className="w-full object-cover h-28" />
                                  <p className="text-[10px] text-center text-gray-400 py-1">{t('history.defReceipt')}</p>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {dayTickets.length === 0 && dayFuelLogs.length === 0 && !dayInspection && (
                <p className="text-sm text-gray-500 text-center py-4">{t('history.noActivity')}</p>
              )}
            </div>
          )}
        </div>
      )}
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  )
}
