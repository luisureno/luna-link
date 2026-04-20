'use client'

import { useEffect, useState } from 'react'
import { Users, FileText, Clock, Send, Fuel } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { LoadTicket, CheckIn, User, PreTripInspection } from '@/types'

interface DriverActivity {
  driver: User
  lastCheckIn: CheckIn | null
  loadsToday: number
  inspectionStatus: 'passed' | 'failed' | null
}

interface MetricCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
}

function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [activeDrivers, setActiveDrivers] = useState(0)
  const [loadsToday, setLoadsToday] = useState(0)
  const [pendingConfirmations, setPendingConfirmations] = useState(0)
  const [openDispatches, setOpenDispatches] = useState(0)
  const [driverActivity, setDriverActivity] = useState<DriverActivity[]>([])
  const [recentTickets, setRecentTickets] = useState<(LoadTicket & { users: User })[]>([])
  const [failedInspections, setFailedInspections] = useState<(PreTripInspection & { users: User })[]>([])
  const [fuelSpendToday, setFuelSpendToday] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.company_id) return
    loadDashboard()
    const cleanup = setupRealtime()
    return cleanup
  }, [profile?.company_id])

  async function loadDashboard() {
    const cid = profile!.company_id
    setLoading(true)

    const [driversRes, ticketsRes, dispatchesRes, checkInsRes, inspectionsRes, fuelRes] = await Promise.all([
      supabase.from('users').select('*').eq('company_id', cid).eq('role', 'driver').eq('is_active', true),
      supabase.from('load_tickets').select('*, users(*)').eq('company_id', cid).gte('submitted_at', `${today}T00:00:00`).order('submitted_at', { ascending: false }),
      supabase.from('dispatches').select('*').eq('company_id', cid).eq('scheduled_date', today).in('status', ['pending', 'active']),
      supabase.from('check_ins').select('*').eq('company_id', cid).gte('checked_in_at', `${today}T00:00:00`),
      supabase.from('pre_trip_inspections').select('*, users(*)').eq('company_id', cid).gte('inspected_at', `${today}T00:00:00`),
      supabase.from('fuel_logs').select('total_cost').eq('company_id', cid).gte('logged_at', `${today}T00:00:00`),
    ])

    const drivers = driversRes.data ?? []
    const tickets = (ticketsRes.data ?? []) as (LoadTicket & { users: User })[]
    const dispatches = dispatchesRes.data ?? []
    const checkIns = checkInsRes.data ?? []
    const inspections = (inspectionsRes.data ?? []) as (PreTripInspection & { users: User })[]
    const fuelLogs = fuelRes.data ?? []

    const activeDriverIds = new Set(checkIns.map(c => c.driver_id))
    setActiveDrivers(activeDriverIds.size)
    setLoadsToday(tickets.length)
    setPendingConfirmations(tickets.filter(t => t.status === 'submitted').length)
    setOpenDispatches(dispatches.length)
    setRecentTickets(tickets.slice(0, 10))
    setFailedInspections(inspections.filter(i => i.overall_status === 'failed'))
    setFuelSpendToday(fuelLogs.reduce((s, f) => s + Number(f.total_cost), 0))

    const inspectionByDriver: Record<string, 'passed' | 'failed'> = {}
    inspections.forEach(i => { inspectionByDriver[i.driver_id] = i.overall_status })

    const activity: DriverActivity[] = drivers.map(driver => {
      const driverCheckIns = checkIns.filter(c => c.driver_id === driver.id).sort(
        (a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime()
      )
      const driverLoads = tickets.filter(t => t.driver_id === driver.id).length
      return { driver, lastCheckIn: driverCheckIns[0] ?? null, loadsToday: driverLoads, inspectionStatus: inspectionByDriver[driver.id] ?? null }
    })
    setDriverActivity(activity)
    setLoading(false)
  }

  function setupRealtime() {
    const cid = profile!.company_id
    const channel = supabase
      .channel('dispatcher-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'check_ins', filter: `company_id=eq.${cid}` }, () => loadDashboard())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'load_tickets', filter: `company_id=eq.${cid}` }, () => loadDashboard())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pre_trip_inspections', filter: `company_id=eq.${cid}` }, () => loadDashboard())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fuel_logs', filter: `company_id=eq.${cid}` }, () => loadDashboard())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  async function confirmTicket(ticketId: string) {
    await supabase.from('load_tickets').update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: profile!.id }).eq('id', ticketId)
    setRecentTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'confirmed' as const } : t))
    setPendingConfirmations(p => Math.max(0, p - 1))
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </h1>

      {/* Failed Inspection Alert */}
      {failedInspections.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
          <p className="text-sm font-semibold text-red-800 mb-1">⚠️ Pre-Trip Issues Reported — {failedInspections.length} driver{failedInspections.length > 1 ? 's' : ''}</p>
          <div className="space-y-1">
            {failedInspections.map(i => (
              <p key={i.id} className="text-sm text-red-700">
                <strong>{(i as any).users?.full_name}</strong> — {(i.items as any[]).filter(item => !item.passed).map(item => item.label).join(', ')}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard label="Active Drivers Today" value={activeDrivers} icon={<Users size={18} />} />
        <MetricCard label="Loads Submitted Today" value={loadsToday} icon={<FileText size={18} />} />
        <MetricCard label="Pending Confirmations" value={pendingConfirmations} icon={<Clock size={18} />} />
        <MetricCard label="Open Dispatches" value={openDispatches} icon={<Send size={18} />} />
        <MetricCard label="Fuel Spend Today" value={`$${fuelSpendToday.toFixed(2)}`} icon={<Fuel size={18} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Driver Activity */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-base font-medium text-gray-900 mb-4">Today's Driver Activity</h2>
          {loading ? (
            <>{[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}</>
          ) : driverActivity.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No drivers on record.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {driverActivity.map(({ driver, lastCheckIn, loadsToday: loads, inspectionStatus }) => (
                <div key={driver.id} className="flex items-center gap-3 py-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${lastCheckIn ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{driver.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {driver.truck_number} &middot; {lastCheckIn ? `${lastCheckIn.location_type.replace('_', ' ')} · ${new Date(lastCheckIn.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Not checked in'}
                    </p>
                    {inspectionStatus && (
                      <span className={`text-xs font-medium ${inspectionStatus === 'passed' ? 'text-green-600' : 'text-red-600'}`}>
                        {inspectionStatus === 'passed' ? '✓ Inspection passed' : '⚠ Inspection issues'}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{loads} loads</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Tickets */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-base font-medium text-gray-900 mb-4">Recent Tickets</h2>
          {loading ? (
            <>{[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}</>
          ) : recentTickets.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No tickets submitted today.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentTickets.map(ticket => (
                <div key={ticket.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{(ticket.users as User)?.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(ticket.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <StatusBadge status={ticket.status} />
                  {ticket.status === 'submitted' && (
                    <button
                      onClick={() => confirmTicket(ticket.id)}
                      className="text-xs px-2 py-1 bg-[#1a1a1a] text-white rounded hover:bg-gray-800"
                    >
                      Confirm
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
