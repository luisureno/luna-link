'use client'

import { useEffect, useMemo , useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { CheckIn, LoadTicket, FuelLog, PreTripInspection } from '@/types'

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
  const supabase = useMemo(() => createClient(), [])

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set())
  const [dayCheckIns, setDayCheckIns] = useState<CheckIn[]>([])
  const [dayTickets, setDayTickets] = useState<LoadTicket[]>([])
  const [dayFuelLogs, setDayFuelLogs] = useState<FuelLog[]>([])
  const [dayInspection, setDayInspection] = useState<PreTripInspection | null>(null)
  const [loadingDay, setLoadingDay] = useState(false)

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

    const [checkInsRes, ticketsRes, fuelRes, inspectionRes] = await Promise.all([
      supabase.from('check_ins').select('*').eq('driver_id', profile!.id).gte('checked_in_at', `${date}T00:00:00`).lte('checked_in_at', `${date}T23:59:59`).order('checked_in_at'),
      supabase.from('load_tickets').select('*').eq('driver_id', profile!.id).gte('submitted_at', `${date}T00:00:00`).lte('submitted_at', `${date}T23:59:59`).order('submitted_at'),
      supabase.from('fuel_logs').select('*').eq('driver_id', profile!.id).gte('logged_at', `${date}T00:00:00`).lte('logged_at', `${date}T23:59:59`).order('logged_at'),
      supabase.from('pre_trip_inspections').select('*').eq('driver_id', profile!.id).gte('inspected_at', `${date}T00:00:00`).lte('inspected_at', `${date}T23:59:59`).order('inspected_at', { ascending: false }).limit(1),
    ])

    setDayCheckIns(checkInsRes.data ?? [])
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
    <div className="p-4">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">History</h1>

      {/* Calendar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={18} /></button>
          <span className="text-sm font-medium">{monthName}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={18} /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
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
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-gray-900">{dayTickets.length}</p>
                  <p className="text-xs text-gray-500">Loads</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-gray-900">{dayCheckIns.length}</p>
                  <p className="text-xs text-gray-500">Check-ins</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-xl font-semibold text-gray-900">{dayFuelLogs.length}</p>
                  <p className="text-xs text-gray-500">Fuel Stops</p>
                </div>
                <div className={`border rounded-lg p-3 text-center ${dayInspection?.overall_status === 'passed' ? 'bg-green-50 border-green-200' : dayInspection?.overall_status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                  <p className="text-xl font-semibold text-gray-900">
                    {dayInspection ? (dayInspection.overall_status === 'passed' ? '✓' : '⚠') : '—'}
                  </p>
                  <p className="text-xs text-gray-500">Inspection</p>
                </div>
              </div>

              {/* Pre-Trip Inspection */}
              {dayInspection && (
                <div className={`bg-white border rounded-lg p-4 ${dayInspection.overall_status === 'failed' ? 'border-red-200' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Pre-Trip Inspection</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dayInspection.overall_status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {dayInspection.overall_status === 'passed' ? '✓ Passed' : '⚠ Issues Found'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {(dayInspection.items as any[]).map((item: any) => (
                      <div key={item.id} className="flex items-start gap-2">
                        <span className={`text-xs font-bold mt-0.5 ${item.passed ? 'text-green-600' : 'text-red-600'}`}>{item.passed ? '✓' : '✗'}</span>
                        <div className="flex-1">
                          <span className="text-sm text-gray-700">{item.label}</span>
                          {item.note && <p className="text-xs text-red-600 mt-0.5">{item.note}</p>}
                          {item.photo_url && <a href={item.photo_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline block">View Photo</a>}
                        </div>
                        <span className="text-xs text-gray-400">{fmt(dayInspection.inspected_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Check-ins */}
              {dayCheckIns.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Check-ins</h3>
                  <div className="space-y-2">
                    {dayCheckIns.map(c => (
                      <div key={c.id} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <p className="text-sm text-gray-700 capitalize flex-1">{c.location_type.replace('_', ' ')}{c.location_label ? ` — ${c.location_label}` : ''}</p>
                        <span className="text-xs text-gray-500">{fmt(c.checked_in_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Load Tickets */}
              {dayTickets.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Load Tickets</h3>
                  <div className="space-y-2">
                    {dayTickets.map(t => (
                      <div key={t.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-700">#{t.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-xs text-gray-500">{fmt(t.submitted_at)}</p>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fuel Logs */}
              {dayFuelLogs.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Fuel Stops</h3>
                    <span className="text-sm font-semibold text-gray-700">${fuelTotal.toFixed(2)} total</span>
                  </div>
                  <div className="space-y-2">
                    {dayFuelLogs.map(f => (
                      <div key={f.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-700">{Number(f.gallons).toFixed(3)} gal @ ${Number(f.price_per_gallon).toFixed(3)}/gal</p>
                          <p className="text-xs text-gray-500">{fmt(f.logged_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">${Number(f.total_cost).toFixed(2)}</span>
                          {f.receipt_url && <a href={f.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Receipt</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dayCheckIns.length === 0 && dayTickets.length === 0 && dayFuelLogs.length === 0 && !dayInspection && (
                <p className="text-sm text-gray-500 text-center py-4">No activity on this day.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
