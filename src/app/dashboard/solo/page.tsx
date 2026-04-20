'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, PlusCircle, Fuel, ShieldCheck, DollarSign, FileText, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { LoadTicket, CheckIn, PreTripInspection, FuelLog } from '@/types'

export default function SoloTodayPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [tickets, setTickets] = useState<LoadTicket[]>([])
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null)
  const [inspection, setInspection] = useState<PreTripInspection | null | undefined>(undefined)
  const [fuelToday, setFuelToday] = useState<FuelLog[]>([])
  const [clientCount, setClientCount] = useState(0)
  const [weekRevenue, setWeekRevenue] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      supabase
        .from('fuel_logs')
        .select('*')
        .eq('driver_id', id)
        .gte('logged_at', `${today}T00:00:00`)
        .order('logged_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId),
      supabase
        .from('load_tickets')
        .select('id')
        .eq('driver_id', id)
        .gte('submitted_at', `${weekStartStr}T00:00:00`),
    ])

    setTickets(ticketsRes.data ?? [])
    setLastCheckIn((checkInsRes.data ?? [])[0] ?? null)
    setInspection((inspectionRes.data ?? [])[0] ?? null)
    setFuelToday(fuelRes.data ?? [])
    setClientCount(clientsRes.count ?? 0)
    // Weekly revenue placeholder: per-load rate from profile.pay_rate if set; otherwise count
    const payType = profile!.pay_type ?? null
    const payRate = profile!.pay_rate ?? null
    const weekLoads = (weekTicketsRes.data ?? []).length
    const estRev = payType === 'per_load' && payRate ? weekLoads * Number(payRate) : 0
    setWeekRevenue(estRev)

    setLoading(false)
  }

  const hoursOnClock = lastCheckIn
    ? ((Date.now() - new Date(lastCheckIn.checked_in_at).getTime()) / 3600000).toFixed(1)
    : '0.0'

  const payType = profile?.pay_type ?? null
  const payRate = profile?.pay_rate ?? null
  const todayEarnings = payType && payRate != null
    ? payType === 'per_load'
      ? Number(payRate) * tickets.length
      : Number(payRate) * parseFloat(hoursOnClock)
    : null

  const fuelSpend = fuelToday.reduce((sum, f) => sum + Number(f.total_cost ?? 0), 0)
  const today_label = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="p-4 space-y-4">
      {/* Pre-trip */}
      {inspection === null && (
        <Link href="/driver/inspection" className="block bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800">⚠️ Pre-Trip Inspection Required</p>
              <p className="text-xs text-amber-600 mt-0.5">Run through your checklist before today's first load</p>
            </div>
            <span className="text-amber-700 font-medium text-sm">Start →</span>
          </div>
        </Link>
      )}
      {inspection?.overall_status === 'passed' && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center gap-3">
          <ShieldCheck size={18} className="text-green-700" />
          <div>
            <p className="text-sm font-semibold text-green-800">Pre-Trip Passed</p>
            <p className="text-xs text-green-600 mt-0.5">{new Date(inspection.inspected_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
          </div>
        </div>
      )}
      {inspection?.overall_status === 'failed' && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <p className="text-sm font-semibold text-red-800">⚠️ Inspection flagged issues</p>
          <p className="text-xs text-red-600 mt-0.5">Review items before running loads.</p>
        </div>
      )}

      {/* Earnings hero */}
      <div className="bg-[#1a1a1a] rounded-lg p-5 text-white">
        <p className="text-xs text-gray-400 mb-1">{today_label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-4xl font-bold">
            {todayEarnings !== null ? `$${todayEarnings.toFixed(2)}` : `${tickets.length}`}
          </p>
          <p className="text-sm text-gray-400">
            {todayEarnings !== null
              ? `today — ${tickets.length} load${tickets.length === 1 ? '' : 's'}`
              : `load${tickets.length === 1 ? '' : 's'} today`}
          </p>
        </div>
        {todayEarnings === null && (
          <p className="text-[11px] text-gray-400 mt-2">
            Set your pay rate in Settings to see live earnings.
          </p>
        )}
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xl font-semibold text-gray-900">{hoursOnClock}h</p>
          <p className="text-[11px] text-gray-500">On clock</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xl font-semibold text-gray-900">${fuelSpend.toFixed(0)}</p>
          <p className="text-[11px] text-gray-500">Fuel today</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xl font-semibold text-gray-900">{lastCheckIn ? lastCheckIn.location_type.replace('_', ' ') : '—'}</p>
          <p className="text-[11px] text-gray-500 capitalize">Current</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/driver/checkin" className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg p-4 min-h-[90px] hover:bg-gray-50">
          <MapPin size={22} className="text-gray-700" />
          <span className="text-xs font-medium text-gray-700">Check In</span>
        </Link>
        <Link href="/driver/ticket" className="flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] text-white rounded-lg p-4 min-h-[90px] hover:bg-gray-800">
          <PlusCircle size={22} />
          <span className="text-xs font-medium">Submit Ticket</span>
        </Link>
        <Link href="/driver/fuel" className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg p-4 min-h-[90px] hover:bg-gray-50">
          <Fuel size={22} className="text-gray-700" />
          <span className="text-xs font-medium text-gray-700">Log Fuel</span>
        </Link>
        <Link href="/driver/inspection" className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg p-4 min-h-[90px] hover:bg-gray-50">
          <ShieldCheck size={22} className="text-gray-700" />
          <span className="text-xs font-medium text-gray-700">Pre-Trip</span>
        </Link>
      </div>

      {/* Owner quick glance */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Business snapshot</p>
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Building2 size={14} className="text-gray-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{clientCount}</p>
              <p className="text-[11px] text-gray-500">Client{clientCount === 1 ? '' : 's'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's loads */}
      {tickets.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Today's loads</h2>
            <Link href="/dashboard/solo/loads" className="text-xs font-medium text-gray-600 hover:text-gray-900">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {tickets.map(ticket => (
              <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <FileText size={14} className="text-gray-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(ticket.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-gray-500">Ticket #{ticket.id.slice(0, 8)}</p>
                  </div>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        !loading && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-sm text-gray-500">No loads submitted yet today.</p>
            <Link
              href="/driver/ticket"
              className="mt-3 inline-block px-4 py-2 bg-[#1a1a1a] text-white text-xs font-medium rounded hover:bg-gray-800"
            >
              Submit your first ticket
            </Link>
          </div>
        )
      )}
    </div>
  )
}
