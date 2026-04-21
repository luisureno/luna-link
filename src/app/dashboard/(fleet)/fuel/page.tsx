'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { ScannedArtifacts } from '@/components/ui/ScannedArtifacts'
import type { User } from '@/types'

interface FuelRow {
  id: string
  driver_id: string
  gallons: number | null
  price_per_gallon: number | null
  total_cost: number | null
  receipt_url: string | null
  latitude: number | null
  longitude: number | null
  logged_at: string
  users: User | null
}

export default function FuelPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const today = new Date().toISOString().split('T')[0]

  const [logs, setLogs] = useState<FuelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.company_id) return
    load()
  }, [profile?.company_id, dateFrom, dateTo])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('fuel_logs')
      .select('*, users(*)')
      .eq('company_id', profile!.company_id)
      .gte('logged_at', `${dateFrom}T00:00:00`)
      .lte('logged_at', `${dateTo}T23:59:59`)
      .order('logged_at', { ascending: false })
    setLogs((data ?? []) as FuelRow[])
    setLoading(false)
  }

  function toggle(id: string) {
    setExpanded(prev => (prev === id ? null : id))
  }

  function fmtMoney(n: number | null) {
    return n != null ? `$${Number(n).toFixed(2)}` : '—'
  }

  function computeTotal(log: FuelRow) {
    if (log.total_cost != null) return log.total_cost
    if (log.gallons != null && log.price_per_gallon != null) {
      return Number((log.gallons * log.price_per_gallon).toFixed(2))
    }
    return null
  }

  const totalSpend = logs.reduce((sum, l) => sum + (computeTotal(l) ?? 0), 0)
  const totalGallons = logs.reduce((sum, l) => sum + (l.gallons ?? 0), 0)

  function DetailPanel({ log }: { log: FuelRow }) {
    return (
      <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Gallons</p>
            <p className="text-sm font-semibold">{log.gallons ?? '—'}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Price / gal</p>
            <p className="text-sm font-semibold">{fmtMoney(log.price_per_gallon)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Total</p>
            <p className="text-sm font-semibold">{fmtMoney(computeTotal(log))}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Location</p>
            <p className="text-sm font-semibold">
              {log.latitude != null && log.longitude != null ? (
                <a
                  href={`https://maps.google.com/?q=${log.latitude},${log.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View
                </a>
              ) : '—'}
            </p>
          </div>
        </div>

        <ScannedArtifacts photos={[{ label: 'Receipt', url: log.receipt_url ?? '' }]} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Fuel" subtitle="Review driver fuel receipts and spend" />

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <span className="text-sm text-gray-500">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
      </div>

      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500">Total spend</p>
            <p className="text-lg font-bold text-gray-900">${totalSpend.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500">Total gallons</p>
            <p className="text-lg font-bold text-gray-900">{totalGallons.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No fuel logs for the selected range.</p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-gray-100">
              {logs.map(log => (
                <div key={log.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{log.users?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(log.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{log.gallons ?? '—'} gal · {fmtMoney(computeTotal(log))}</p>
                      </div>
                      <button onClick={() => toggle(log.id)} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center gap-1 flex-shrink-0">
                        {expanded === log.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  {expanded === log.id && <DetailPanel log={log} />}
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date/Time</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Gallons</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Price/gal</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Total</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Receipt</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <>
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                          {new Date(log.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{log.users?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{log.gallons ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{fmtMoney(log.price_per_gallon)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{fmtMoney(computeTotal(log))}</td>
                        <td className="px-4 py-3 text-sm">
                          {log.receipt_url ? (
                            <span className="text-green-700">📎 Attached</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggle(log.id)} className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                            {expanded === log.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            View
                          </button>
                        </td>
                      </tr>
                      {expanded === log.id && (
                        <tr key={`${log.id}-detail`}>
                          <td colSpan={7} className="p-0">
                            <DetailPanel log={log} />
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
