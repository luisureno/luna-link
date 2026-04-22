'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import type { FuelLog } from '@/types'
import { MapPin, BarChart3, TrendingDown, Fuel, Download } from 'lucide-react'

const FuelMap = dynamic(() => import('@/components/FuelMap'), { ssr: false, loading: () => <div className="h-72 bg-gray-100 rounded-xl animate-pulse" /> })

type TabId = 'stats' | 'map'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  )
}

export default function SoloFuelPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<TabId>('stats')
  const [logs, setLogs] = useState<FuelLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    load()
  }, [profile?.id])

  async function load() {
    try {
      const { data } = await supabase
        .from('fuel_logs')
        .select('*')
        .eq('driver_id', profile!.id)
        .order('logged_at', { ascending: false })
      setLogs(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  // ── computed stats ──────────────────────────────────────────────────────────
  const totalDieselCost = logs.reduce((s, l) => s + Number(l.total_cost ?? 0), 0)
  const totalDefCost = logs.reduce((s, l) => s + Number(l.def_total_cost ?? 0), 0)
  const totalGallons = logs.reduce((s, l) => s + Number(l.gallons ?? 0), 0)
  const totalDefGallons = logs.reduce((s, l) => s + Number(l.def_gallons ?? 0), 0)
  const avgPpg = totalGallons > 0 ? totalDieselCost / totalGallons : null
  const avgDefPpg = totalDefGallons > 0 ? totalDefCost / totalDefGallons : null

  // monthly breakdown — last 6 months
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {}
    logs.forEach(l => {
      const m = l.logged_at.slice(0, 7)
      map[m] = (map[m] ?? 0) + Number(l.total_cost ?? 0) + Number(l.def_total_cost ?? 0)
    })
    const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
    const max = Math.max(...sorted.map(([, v]) => v), 1)
    return sorted.map(([month, total]) => ({ month, total, pct: (total / max) * 100 }))
  }, [logs])

  // this month stats
  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthLogs = logs.filter(l => l.logged_at.startsWith(thisMonth))
  const thisMonthTotal = thisMonthLogs.reduce((s, l) => s + Number(l.total_cost ?? 0) + Number(l.def_total_cost ?? 0), 0)

  // best/worst price
  const withPpg = logs.filter(l => Number(l.price_per_gallon) > 0)
  const bestPpg = withPpg.length ? Math.min(...withPpg.map(l => Number(l.price_per_gallon))) : null
  const worstPpg = withPpg.length ? Math.max(...withPpg.map(l => Number(l.price_per_gallon))) : null

  function formatMonth(m: string) {
    const [y, mo] = m.split('-')
    return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
  }

  function exportCSV() {
    const header = 'Date,Gallons,Price/gal,Diesel Total,DEF Gallons,DEF Price/gal,DEF Total,Grand Total\n'
    const rows = logs.map(l => {
      const grand = Number(l.total_cost ?? 0) + Number(l.def_total_cost ?? 0)
      return [
        new Date(l.logged_at).toLocaleDateString(),
        l.gallons ?? '',
        l.price_per_gallon ?? '',
        l.total_cost ?? '',
        l.def_gallons ?? '',
        l.def_price_per_gallon ?? '',
        l.def_total_cost ?? '',
        grand.toFixed(2),
      ].join(',')
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fuel-history.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Fuel</h1>
          <p className="text-xs text-gray-500 mt-0.5">{logs.length} fuel stop{logs.length !== 1 ? 's' : ''} logged</p>
        </div>
        {logs.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['stats', 'My Stats', BarChart3], ['map', 'Fuel Map', MapPin]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <Fuel size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No fuel stops logged yet.</p>
              <p className="text-xs text-gray-400 mt-1">Log your first fuel stop from the Today screen.</p>
            </div>
          ) : (
            <>
              {/* Summary grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="This month"
                  value={`$${thisMonthTotal.toFixed(0)}`}
                  sub={`${thisMonthLogs.length} stop${thisMonthLogs.length !== 1 ? 's' : ''}`}
                />
                <StatCard
                  label="All-time fuel spend"
                  value={`$${(totalDieselCost + totalDefCost).toFixed(0)}`}
                  sub={`${logs.length} stops total`}
                />
                <StatCard
                  label="Avg diesel price"
                  value={avgPpg ? `$${avgPpg.toFixed(3)}/gal` : '—'}
                  sub={`${totalGallons.toFixed(0)} gal total`}
                />
                {avgDefPpg ? (
                  <StatCard
                    label="Avg DEF price"
                    value={`$${avgDefPpg.toFixed(3)}/gal`}
                    sub={`${totalDefGallons.toFixed(0)} DEF gal`}
                  />
                ) : (
                  <StatCard label="DEF logged" value="None" sub="No DEF stops yet" />
                )}
              </div>

              {/* Best vs worst price */}
              {bestPpg !== null && worstPpg !== null && bestPpg !== worstPpg && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Price range</p>
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-600">${bestPpg.toFixed(3)}</p>
                      <p className="text-xs text-gray-400">Best price/gal</p>
                    </div>
                    <TrendingDown size={20} className="text-gray-300" />
                    <div className="text-center">
                      <p className="text-lg font-bold text-red-500">${worstPpg.toFixed(3)}</p>
                      <p className="text-xs text-gray-400">Highest price/gal</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Savings potential: ${((worstPpg - bestPpg) * totalGallons).toFixed(0)} if always at best price
                  </p>
                </div>
              )}

              {/* Monthly breakdown */}
              {monthlyData.length > 1 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Monthly fuel spend</p>
                  <div className="space-y-2.5">
                    {monthlyData.map(({ month, total, pct }) => (
                      <div key={month} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-12 flex-shrink-0">{formatMonth(month)}</span>
                        <div className="flex-1">
                          <MiniBar pct={pct} color="bg-[#1a1a1a]" />
                        </div>
                        <span className="text-xs font-medium text-gray-900 w-16 text-right">${total.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent stops */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">Recent fuel stops</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {logs.slice(0, 10).map(l => {
                    const grand = Number(l.total_cost ?? 0) + Number(l.def_total_cost ?? 0)
                    const dt = new Date(l.logged_at)
                    return (
                      <div key={l.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {Number(l.gallons) > 0 ? `${Number(l.gallons).toFixed(1)} gal` : 'Fuel stop'}
                            {Number(l.def_gallons ?? 0) > 0 ? ` + ${Number(l.def_gallons).toFixed(1)} gal DEF` : ''}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                            {Number(l.price_per_gallon) > 0 ? `$${Number(l.price_per_gallon).toFixed(3)}/gal` : 'manual entry'}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-gray-900">${grand.toFixed(2)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'map' && (
        <FuelMap logs={logs} />
      )}
    </div>
  )
}
