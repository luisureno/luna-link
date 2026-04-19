'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, PlusCircle, List, Fuel } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Dispatch, DispatchAssignment, LoadTicket, CheckIn, PreTripInspection } from '@/types'

type DispatchWithAssignment = Dispatch & { dispatch_assignments: DispatchAssignment[] }

export default function DriverTodayPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [dispatches, setDispatches] = useState<DispatchWithAssignment[]>([])
  const [tickets, setTickets] = useState<LoadTicket[]>([])
  const [lastCheckIn, setLastCheckIn] = useState<CheckIn | null>(null)
  const [inspection, setInspection] = useState<PreTripInspection | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    loadData()
  }, [profile?.id])

  async function loadData() {
    const id = profile!.id

    const [assignmentsRes, ticketsRes, checkInsRes, inspectionRes] = await Promise.all([
      supabase
        .from('dispatch_assignments')
        .select('*, dispatches(*)')
        .eq('driver_id', id),
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
    ])

    const assignments = assignmentsRes.data ?? []
    const todayDispatches = assignments
      .filter(a => (a as any).dispatches?.scheduled_date === today)
      .map(a => ({ ...(a as any).dispatches, dispatch_assignments: [a] }))

    setDispatches(todayDispatches)
    setTickets(ticketsRes.data ?? [])
    setLastCheckIn((checkInsRes.data ?? [])[0] ?? null)
    setInspection((inspectionRes.data ?? [])[0] ?? null)
    setLoading(false)
  }

  async function acknowledge(assignmentId: string, dispatchId: string) {
    await supabase.from('dispatch_assignments').update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
    }).eq('id', assignmentId)

    setDispatches(prev => prev.map(d =>
      d.id === dispatchId
        ? { ...d, dispatch_assignments: d.dispatch_assignments.map(a => a.id === assignmentId ? { ...a, status: 'acknowledged' as const } : a) }
        : d
    ))
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
    <div className="p-4 space-y-4">
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
      {inspection?.overall_status === 'passed' && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-800">✅ Pre-Trip Inspection Passed</p>
            <p className="text-xs text-green-600 mt-0.5">{new Date(inspection.inspected_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
          </div>
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
          <div>
            <p className="text-3xl font-semibold text-gray-900">{hoursOnClock}h</p>
            <p className="text-xs text-gray-500">On the clock</p>
          </div>
          {lastCheckIn && (
            <div>
              <p className="text-sm font-medium text-green-600 capitalize">{lastCheckIn.location_type.replace('_', ' ')}</p>
              <p className="text-xs text-gray-500">Current status</p>
            </div>
          )}
        </div>
      </div>

      {/* Today's Dispatches */}
      <div>
        <h2 className="text-base font-medium text-gray-900 mb-2">My Dispatches</h2>
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse h-20" />
        ) : dispatches.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-sm text-gray-500">No dispatches for today.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dispatches.map(dispatch => {
              const assignment = dispatch.dispatch_assignments[0]
              const isNew = assignment.status === 'assigned'
              return (
                <div key={dispatch.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">{dispatch.title}</p>
                    <StatusBadge status={assignment.status} />
                  </div>
                  {dispatch.notes && <p className="text-xs text-gray-500 mb-2">{dispatch.notes}</p>}
                  {dispatch.scheduled_time && (
                    <p className="text-xs text-gray-500">Scheduled: {dispatch.scheduled_time}</p>
                  )}
                  {isNew && (
                    <button
                      onClick={() => acknowledge(assignment.id, dispatch.id)}
                      className="mt-3 w-full py-2 bg-[#1a1a1a] text-white text-sm rounded font-medium"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/driver/checkin" className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg p-4 min-h-[80px] hover:bg-gray-50">
          <MapPin size={22} className="text-gray-700" />
          <span className="text-xs font-medium text-gray-700">Check In</span>
        </Link>
        <Link href="/driver/ticket" className="flex flex-col items-center justify-center gap-2 bg-[#1a1a1a] text-white rounded-lg p-4 min-h-[80px] hover:bg-gray-800">
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
            {tickets.map(ticket => (
              <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(ticket.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-gray-500">Ticket #{ticket.id.slice(0, 8)}</p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
