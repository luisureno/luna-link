'use client'

import { useEffect, useMemo , useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ScannedArtifacts } from '@/components/ui/ScannedArtifacts'
import type { User, Client } from '@/types'
import { formatDate } from '@/lib/format'

interface TimesheetRow {
  id: string
  work_date: string
  arrived_at: string | null
  departed_at: string | null
  hours_worked: number | null
  hours_billed_client: number | null
  client_rate_per_hour: number | null
  client_charge_total: number | null
  driver_hourly_rate: number | null
  driver_pay_total: number | null
  dispatcher_adjusted_hours: number | null
  dispatcher_adjustment_reason: string | null
  status: string
  submission_method: string | null
  notes: string | null
  scanned_invoice_photo_url: string | null
  client_signature_url: string | null
  ai_extracted_data: Record<string, unknown> | null
  users: User | null
  clients: Client | null
}

interface AdjustState {
  hours: string
  reason: string
  saving: boolean
}

export default function TimesheetsPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const today = new Date().toISOString().split('T')[0]

  const [sheets, setSheets] = useState<TimesheetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<Record<string, AdjustState>>({})

  useEffect(() => {
    if (!profile?.company_id) return
    load()
  }, [profile?.company_id, dateFrom, dateTo, statusFilter])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('daily_timesheets')
      .select('*, users(*), clients(*)')
      .eq('company_id', profile!.company_id)
      .gte('work_date', dateFrom)
      .lte('work_date', dateTo)
      .order('work_date', { ascending: false })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    const { data } = await query
    setSheets((data ?? []) as TimesheetRow[])
    setLoading(false)
  }

  async function confirmSheet(id: string) {
    await supabase.from('daily_timesheets').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: profile!.id,
    }).eq('id', id)
    setSheets(prev => prev.map(s => s.id === id ? { ...s, status: 'confirmed' } : s))
  }

  function toggleExpand(id: string) {
    setExpanded(prev => prev === id ? null : id)
    if (!adjusting[id]) {
      const sheet = sheets.find(s => s.id === id)
      setAdjusting(prev => ({
        ...prev,
        [id]: {
          hours: sheet?.dispatcher_adjusted_hours?.toString() ?? sheet?.hours_worked?.toString() ?? '',
          reason: sheet?.dispatcher_adjustment_reason ?? '',
          saving: false,
        }
      }))
    }
  }

  async function saveAdjustment(id: string) {
    const adj = adjusting[id]
    if (!adj) return
    setAdjusting(prev => ({ ...prev, [id]: { ...prev[id], saving: true } }))

    const adjHours = adj.hours ? parseFloat(adj.hours) : null
    const sheet = sheets.find(s => s.id === id)
    const newClientCharge = adjHours != null && sheet?.client_rate_per_hour != null
      ? parseFloat((adjHours * sheet.client_rate_per_hour).toFixed(2))
      : null
    const newDriverPay = adjHours != null && sheet?.driver_hourly_rate != null
      ? parseFloat((adjHours * sheet.driver_hourly_rate).toFixed(2))
      : null

    await supabase.from('daily_timesheets').update({
      dispatcher_adjusted_hours: adjHours,
      dispatcher_adjustment_reason: adj.reason || null,
      ...(newClientCharge != null ? { hours_billed_client: adjHours, client_charge_total: newClientCharge } : {}),
      ...(newDriverPay != null ? { hours_paid_driver: adjHours, driver_pay_total: newDriverPay } : {}),
    }).eq('id', id)

    setSheets(prev => prev.map(s => s.id === id ? {
      ...s,
      dispatcher_adjusted_hours: adjHours,
      dispatcher_adjustment_reason: adj.reason || null,
      ...(newClientCharge != null ? { hours_billed_client: adjHours, client_charge_total: newClientCharge } : {}),
      ...(newDriverPay != null ? { hours_paid_driver: adjHours, driver_pay_total: newDriverPay } : {}),
    } : s))

    setAdjusting(prev => ({ ...prev, [id]: { ...prev[id], saving: false } }))
  }

  function fmt(h: number | null) {
    return h != null ? `${h}h` : '—'
  }
  function fmtMoney(n: number | null) {
    return n != null ? `$${Number(n).toFixed(2)}` : '—'
  }
  function fmtTime(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  function DetailPanel({ sheet }: { sheet: TimesheetRow }) {
    const adj = adjusting[sheet.id] ?? { hours: '', reason: '', saving: false }
    const isAdjusted = sheet.dispatcher_adjusted_hours != null

    return (
      <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Arrived</p>
            <p className="text-sm font-semibold">{fmtTime(sheet.arrived_at)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Departed</p>
            <p className="text-sm font-semibold">{fmtTime(sheet.departed_at)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Hours worked</p>
            <p className="text-sm font-semibold">{fmt(sheet.hours_worked)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs text-blue-600 mb-1">Client charge</p>
            <p className="text-base font-bold text-blue-900">{fmtMoney(sheet.client_charge_total)}</p>
            {sheet.client_rate_per_hour && <p className="text-xs text-blue-500">${sheet.client_rate_per_hour}/hr</p>}
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <p className="text-xs text-green-600 mb-1">Driver pay</p>
            <p className="text-base font-bold text-green-900">{fmtMoney(sheet.driver_pay_total)}</p>
            {sheet.driver_hourly_rate && <p className="text-xs text-green-500">${sheet.driver_hourly_rate}/hr</p>}
          </div>
        </div>

        {isAdjusted && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            Hours adjusted to {sheet.dispatcher_adjusted_hours}h — {sheet.dispatcher_adjustment_reason || 'no reason given'}
          </div>
        )}

        <ScannedArtifacts
          photos={[
            { label: 'Scanned timesheet', url: sheet.scanned_invoice_photo_url ?? '' },
            { label: 'Client signature', url: sheet.client_signature_url ?? '' },
          ]}
          extracted={sheet.ai_extracted_data}
        />

        {/* Adjust hours */}
        <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Dispatcher Hour Adjustment</p>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-500">Adjusted hours</label>
              <input
                type="number"
                min="0"
                step="0.25"
                value={adj.hours}
                onChange={e => setAdjusting(prev => ({ ...prev, [sheet.id]: { ...prev[sheet.id], hours: e.target.value } }))}
                placeholder={sheet.hours_worked?.toString() ?? '0'}
                className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Reason (optional)</label>
            <input
              type="text"
              value={adj.reason}
              onChange={e => setAdjusting(prev => ({ ...prev, [sheet.id]: { ...prev[sheet.id], reason: e.target.value } }))}
              placeholder="e.g. confirmed early departure with client"
              className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <button
            onClick={() => saveAdjustment(sheet.id)}
            disabled={adj.saving}
            className="w-full py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {adj.saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Adjustment'}
          </button>
        </div>

        {sheet.notes && (
          <p className="text-xs text-gray-500 italic">Driver note: {sheet.notes}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Timesheets" subtitle="Review and adjust driver hour timesheets" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <span className="text-sm text-gray-500">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="confirmed">Confirmed</option>
          <option value="invoiced">Invoiced</option>
          <option value="disputed">Disputed</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : sheets.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No timesheets found for the selected filters.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {sheets.map(sheet => (
                <div key={sheet.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{sheet.users?.full_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{sheet.clients?.name ?? '—'} · {formatDate(sheet.work_date)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {fmt(sheet.dispatcher_adjusted_hours ?? sheet.hours_worked)} · {fmtMoney(sheet.client_charge_total)}
                        </p>
                        {sheet.dispatcher_adjusted_hours != null && (
                          <span className="inline-block mt-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">Adjusted</span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <StatusBadge status={sheet.status} />
                        <div className="flex gap-1">
                          {sheet.status === 'submitted' && (
                            <button onClick={() => confirmSheet(sheet.id)} className="text-xs px-2.5 py-1.5 bg-[#1a1a1a] text-white rounded hover:bg-gray-800">
                              Confirm
                            </button>
                          )}
                          <button onClick={() => toggleExpand(sheet.id)} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                            {expanded === sheet.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {expanded === sheet.id && <DetailPanel sheet={sheet} />}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Hours</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client $</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Driver Pay</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sheets.map(sheet => (
                    <>
                      <tr key={sheet.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(sheet.work_date)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{sheet.users?.full_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{sheet.clients?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {sheet.dispatcher_adjusted_hours != null ? (
                            <span className="text-amber-700 font-medium">{sheet.dispatcher_adjusted_hours}h *</span>
                          ) : fmt(sheet.hours_worked)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{fmtMoney(sheet.client_charge_total)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{fmtMoney(sheet.driver_pay_total)}</td>
                        <td className="px-4 py-3"><StatusBadge status={sheet.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {sheet.status === 'submitted' && (
                              <button onClick={() => confirmSheet(sheet.id)} className="text-xs px-2 py-1 bg-[#1a1a1a] text-white rounded hover:bg-gray-800">Confirm</button>
                            )}
                            <button onClick={() => toggleExpand(sheet.id)} className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                              {expanded === sheet.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              Hours
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded === sheet.id && (
                        <tr key={`${sheet.id}-detail`}>
                          <td colSpan={8} className="p-0">
                            <DetailPanel sheet={sheet} />
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
