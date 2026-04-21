'use client'

import { useEffect, useMemo , useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { User, LoadTicket, FuelLog, PreTripInspection } from '@/types'

interface DriverDetail {
  tickets: LoadTicket[]
  fuelLogs: FuelLog[]
  inspection: PreTripInspection | null
  loading: boolean
}

export default function DriversPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [drivers, setDrivers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]
  const [activeToday, setActiveToday] = useState<Set<string>>(new Set())
  const [loadCounts, setLoadCounts] = useState<Record<string, number>>({})
  const [fuelCounts, setFuelCounts] = useState<Record<string, number>>({})
  const [inspectionStatus, setInspectionStatus] = useState<Record<string, 'passed' | 'failed'>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<DriverDetail | null>(null)

  useEffect(() => {
    if (!profile?.company_id) return
    loadDrivers()
  }, [profile?.company_id])

  async function loadDrivers() {
    const cid = profile!.company_id
    const [driversRes, checkInsRes, ticketsRes, fuelRes, inspectionsRes] = await Promise.all([
      supabase.from('users').select('*').eq('company_id', cid).eq('role', 'driver').order('full_name'),
      supabase.from('check_ins').select('driver_id').eq('company_id', cid).gte('checked_in_at', `${today}T00:00:00`),
      supabase.from('load_tickets').select('driver_id').eq('company_id', cid).gte('submitted_at', `${today}T00:00:00`),
      supabase.from('fuel_logs').select('driver_id').eq('company_id', cid).gte('logged_at', `${today}T00:00:00`),
      supabase.from('pre_trip_inspections').select('driver_id, overall_status').eq('company_id', cid).gte('inspected_at', `${today}T00:00:00`),
    ])
    setDrivers(driversRes.data ?? [])
    setActiveToday(new Set((checkInsRes.data ?? []).map(c => c.driver_id)))
    const counts: Record<string, number> = {}
    ;(ticketsRes.data ?? []).forEach(t => { counts[t.driver_id] = (counts[t.driver_id] ?? 0) + 1 })
    setLoadCounts(counts)
    const fCounts: Record<string, number> = {}
    ;(fuelRes.data ?? []).forEach(f => { fCounts[f.driver_id] = (fCounts[f.driver_id] ?? 0) + 1 })
    setFuelCounts(fCounts)
    const iStatus: Record<string, 'passed' | 'failed'> = {}
    ;(inspectionsRes.data ?? []).forEach(i => { iStatus[i.driver_id] = i.overall_status })
    setInspectionStatus(iStatus)
    setLoading(false)
  }

  async function expandDriver(driverId: string) {
    if (expanded === driverId) { setExpanded(null); setDetail(null); return }
    setExpanded(driverId)
    setDetail({ tickets: [], fuelLogs: [], inspection: null, loading: true })
    const [ticketsRes, fuelRes, inspectionRes] = await Promise.all([
      supabase.from('load_tickets').select('*').eq('driver_id', driverId).gte('submitted_at', `${today}T00:00:00`).order('submitted_at'),
      supabase.from('fuel_logs').select('*').eq('driver_id', driverId).gte('logged_at', `${today}T00:00:00`).order('logged_at'),
      supabase.from('pre_trip_inspections').select('*').eq('driver_id', driverId).gte('inspected_at', `${today}T00:00:00`).order('inspected_at', { ascending: false }).limit(1),
    ])
    setDetail({ tickets: ticketsRes.data ?? [], fuelLogs: fuelRes.data ?? [], inspection: (inspectionRes.data ?? [])[0] ?? null, loading: false })
  }

  const DetailPanel = ({ d }: { d: DriverDetail }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Today's Loads ({d.tickets.length})</h3>
        {d.tickets.length === 0 ? <p className="text-sm text-gray-400">No loads submitted today.</p> : (
          <div className="space-y-1.5">
            {d.tickets.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-gray-900">#{t.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-gray-500">{new Date(t.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pre-Trip Inspection</h3>
        {!d.inspection ? <p className="text-sm text-gray-400">Not completed today.</p> : (
          <div>
            <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full mb-3 ${d.inspection.overall_status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {d.inspection.overall_status === 'passed' ? '✓ All Clear' : '⚠ Issues Found'}
            </div>
            <div className="space-y-1.5">
              {(d.inspection.items as any[]).map((item: any) => (
                <div key={item.id} className={`flex items-start gap-2 bg-white border rounded px-3 py-2 ${!item.passed ? 'border-red-200' : 'border-gray-200'}`}>
                  <span className={`text-xs font-bold mt-0.5 ${item.passed ? 'text-green-600' : 'text-red-600'}`}>{item.passed ? '✓' : '✗'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900">{item.label}</p>
                    {item.note && <p className="text-xs text-red-600 mt-0.5">{item.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Fuel Stops ({d.fuelLogs.length})
          {d.fuelLogs.length > 0 && <span className="ml-2 text-gray-400 normal-case font-normal">— ${d.fuelLogs.reduce((s, f) => s + Number(f.total_cost), 0).toFixed(2)} total</span>}
        </h3>
        {d.fuelLogs.length === 0 ? <p className="text-sm text-gray-400">No fuel stops today.</p> : (
          <div className="space-y-1.5">
            {d.fuelLogs.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-gray-900">{Number(f.gallons).toFixed(3)} gal @ ${Number(f.price_per_gallon).toFixed(3)}</p>
                  <p className="text-xs text-gray-500">{new Date(f.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">${Number(f.total_cost).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const skeletonCards = [...Array(4)].map((_, i) => (
    <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
      <div className="w-9 h-9 bg-gray-200 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-200 rounded w-1/4" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  ))

  return (
    <div>
      <PageHeader title="Drivers" subtitle="All active drivers in your company" />

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">{skeletonCards}</div>
        ) : drivers.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No drivers found. Add drivers in Settings → Users.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {drivers.map(driver => (
                <div key={driver.id}>
                  <button
                    onClick={() => expandDriver(driver.id)}
                    className="w-full text-left p-4 hover:bg-gray-50 active:bg-gray-100"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 flex-shrink-0">
                          {driver.full_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{driver.full_name}</p>
                          <p className="text-xs text-gray-500">Truck {driver.truck_number ?? '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {inspectionStatus[driver.id] === 'passed' && <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓</span>}
                        {inspectionStatus[driver.id] === 'failed' && <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">⚠</span>}
                        <span className={`w-2 h-2 rounded-full ${activeToday.has(driver.id) ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 ml-12 text-xs text-gray-500">
                      <span>{loadCounts[driver.id] ?? 0} loads</span>
                      <span>{fuelCounts[driver.id] ?? 0} fuel</span>
                      <span className={activeToday.has(driver.id) ? 'text-green-700' : ''}>{activeToday.has(driver.id) ? 'Active' : 'Not checked in'}</span>
                    </div>
                  </button>
                  {expanded === driver.id && detail && (
                    <div className="bg-gray-50 px-4 py-4 border-t border-gray-100">
                      {detail.loading ? (
                        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />)}</div>
                      ) : <DetailPanel d={detail} />}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Truck</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Inspection</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Loads Today</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Fuel Stops</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drivers.map(driver => (
                    <>
                      <tr key={driver.id} onClick={() => expandDriver(driver.id)} className="hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">{driver.full_name.charAt(0)}</div>
                            <span className="text-sm font-medium text-gray-900">{driver.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{driver.truck_number ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${activeToday.has(driver.id) ? 'text-green-700' : 'text-gray-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${activeToday.has(driver.id) ? 'bg-green-500' : 'bg-gray-300'}`} />
                            {activeToday.has(driver.id) ? 'Active' : 'Not checked in'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {inspectionStatus[driver.id] === 'passed' && <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">✓ Passed</span>}
                          {inspectionStatus[driver.id] === 'failed' && <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">⚠ Issues</span>}
                          {!inspectionStatus[driver.id] && <span className="text-xs text-gray-400">Not done</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{loadCounts[driver.id] ?? 0}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{fuelCounts[driver.id] ?? 0}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{driver.phone ?? '—'}</td>
                      </tr>
                      {expanded === driver.id && detail && (
                        <tr key={`${driver.id}-detail`}>
                          <td colSpan={7} className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                            {detail.loading ? (
                              <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />)}</div>
                            ) : <DetailPanel d={detail} />}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
