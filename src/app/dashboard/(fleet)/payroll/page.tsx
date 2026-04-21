'use client'

import { useEffect, useMemo , useState } from 'react'
import { Download, FileText, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'

interface DriverSummary {
  driver_id: string
  driver_name: string
  ticket_pay: number
  timesheet_pay: number
  total_pay: number
  ticket_count: number
  timesheet_count: number
  paid: boolean
  lines: PayLine[]
  expanded: boolean
}

interface PayLine {
  id: string
  type: 'ticket' | 'timesheet'
  date: string
  description: string
  pay: number
  adjusted_pay: number | null
  adjustment_reason: string | null
}

function dateRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: first.toISOString().split('T')[0], to: last.toISOString().split('T')[0] }
}

export default function PayrollPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const range = dateRange()

  const [dateFrom, setDateFrom] = useState(range.from)
  const [dateTo, setDateTo] = useState(range.to)
  const [drivers, setDrivers] = useState<DriverSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingXls, setExportingXls] = useState(false)

  async function load() {
    setLoading(true)

    const [{ data: tickets }, { data: timesheets }] = await Promise.all([
      supabase
        .from('load_tickets')
        .select('id, submitted_at, driver_pay_total, dispatcher_adjusted_pay, dispatcher_adjustment_reason, billing_type, loads_count, weight_tons, tag_number, users(id, full_name)')
        .eq('company_id', profile!.company_id)
        .in('status', ['confirmed', 'invoiced'])
        .gte('submitted_at', `${dateFrom}T00:00:00`)
        .lte('submitted_at', `${dateTo}T23:59:59`),

      supabase
        .from('daily_timesheets')
        .select('id, work_date, driver_pay_total, hours_paid_driver, dispatcher_adjusted_hours, dispatcher_adjustment_reason, users(id, full_name)')
        .eq('company_id', profile!.company_id)
        .in('status', ['confirmed', 'invoiced'])
        .gte('work_date', dateFrom)
        .lte('work_date', dateTo),
    ])

    const map = new Map<string, DriverSummary>()

    for (const t of tickets ?? []) {
      const r = t as any
      const uid = r.users?.id ?? 'unknown'
      if (!map.has(uid)) {
        map.set(uid, { driver_id: uid, driver_name: r.users?.full_name ?? '—', ticket_pay: 0, timesheet_pay: 0, total_pay: 0, ticket_count: 0, timesheet_count: 0, paid: false, lines: [], expanded: false })
      }
      const d = map.get(uid)!
      const pay = Number(r.dispatcher_adjusted_pay ?? r.driver_pay_total ?? 0)
      d.ticket_pay = new Decimal(d.ticket_pay).plus(pay).toNumber()
      d.ticket_count++
      d.lines.push({
        id: r.id,
        type: 'ticket',
        date: r.submitted_at?.split('T')[0] ?? '',
        description: r.billing_type === 'per_ton' ? `${r.weight_tons ?? '?'} tons${r.tag_number ? ` · Tag #${r.tag_number}` : ''}` : `${r.loads_count ?? 1} load(s)`,
        pay: Number(r.driver_pay_total ?? 0),
        adjusted_pay: r.dispatcher_adjusted_pay != null ? Number(r.dispatcher_adjusted_pay) : null,
        adjustment_reason: r.dispatcher_adjustment_reason ?? null,
      })
    }

    for (const t of timesheets ?? []) {
      const r = t as any
      const uid = r.users?.id ?? 'unknown'
      if (!map.has(uid)) {
        map.set(uid, { driver_id: uid, driver_name: r.users?.full_name ?? '—', ticket_pay: 0, timesheet_pay: 0, total_pay: 0, ticket_count: 0, timesheet_count: 0, paid: false, lines: [], expanded: false })
      }
      const d = map.get(uid)!
      const pay = Number(r.driver_pay_total ?? 0)
      d.timesheet_pay = new Decimal(d.timesheet_pay).plus(pay).toNumber()
      d.timesheet_count++
      d.lines.push({
        id: r.id,
        type: 'timesheet',
        date: r.work_date ?? '',
        description: `${r.dispatcher_adjusted_hours ?? r.hours_paid_driver ?? '?'}h`,
        pay,
        adjusted_pay: null,
        adjustment_reason: r.dispatcher_adjustment_reason ?? null,
      })
    }

    const result = Array.from(map.values()).map(d => ({
      ...d,
      total_pay: new Decimal(d.ticket_pay).plus(d.timesheet_pay).toNumber(),
      lines: d.lines.sort((a, b) => a.date.localeCompare(b.date)),
    }))

    setDrivers(result)
    setLoading(false)
  }

  useEffect(() => {
    if (profile?.company_id) load()
  }, [profile?.company_id])

  function toggleExpand(driverId: string) {
    setDrivers(prev => prev.map(d => d.driver_id === driverId ? { ...d, expanded: !d.expanded } : d))
  }

  function togglePaid(driverId: string) {
    setDrivers(prev => prev.map(d => d.driver_id === driverId ? { ...d, paid: !d.paid } : d))
  }

  const grandTotal = drivers.reduce((s, d) => new Decimal(s).plus(d.total_pay).toNumber(), 0)
  const paidTotal = drivers.filter(d => d.paid).reduce((s, d) => new Decimal(s).plus(d.total_pay).toNumber(), 0)

  async function exportPayrollPdf() {
    setExportingPdf(true)
    try {
      const res = await fetch(`/api/payroll/pdf?from=${dateFrom}&to=${dateTo}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payroll-${dateFrom}-${dateTo}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingPdf(false)
    }
  }

  async function exportPayrollExcel() {
    setExportingXls(true)
    try {
      const res = await fetch(`/api/payroll/excel?from=${dateFrom}&to=${dateTo}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payroll-${dateFrom}-${dateTo}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingXls(false)
    }
  }

  return (
    <div>
      <PageHeader title="Driver Payroll" subtitle="Review and export driver pay by period" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <span className="text-sm text-gray-500">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 disabled:opacity-40 flex items-center gap-2">
            {loading ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Load'}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPayrollPdf} disabled={exportingPdf || drivers.length === 0} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            <FileText className="w-4 h-4" />
            {exportingPdf ? '...' : 'PDF'}
          </button>
          <button onClick={exportPayrollExcel} disabled={exportingXls || drivers.length === 0} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            <Download className="w-4 h-4" />
            {exportingXls ? '...' : 'Excel'}
          </button>
        </div>
      </div>

      {/* Summary totals */}
      {drivers.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Payroll</p>
            <p className="text-xl font-bold text-gray-900">${grandTotal.toFixed(2)}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs text-green-600 mb-1">Marked Paid</p>
            <p className="text-xl font-bold text-green-700">${paidTotal.toFixed(2)}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs text-amber-600 mb-1">Outstanding</p>
            <p className="text-xl font-bold text-amber-700">${new Decimal(grandTotal).minus(paidTotal).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Driver cards */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}</div>
      ) : drivers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-sm">No driver pay records found for the selected period.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drivers.map(driver => (
            <div key={driver.driver_id} className={`bg-white border rounded-xl overflow-hidden transition-all ${driver.paid ? 'border-green-200' : 'border-gray-200'}`}>
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{driver.driver_name}</p>
                      {driver.paid && (
                        <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Paid
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {driver.ticket_count > 0 && `${driver.ticket_count} ticket(s)`}
                      {driver.ticket_count > 0 && driver.timesheet_count > 0 && ' · '}
                      {driver.timesheet_count > 0 && `${driver.timesheet_count} timesheet(s)`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-lg font-bold text-gray-900">${driver.total_pay.toFixed(2)}</p>
                    <button
                      onClick={() => togglePaid(driver.driver_id)}
                      className={`text-xs px-2.5 py-1.5 rounded font-medium ${driver.paid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-[#1a1a1a] text-white hover:bg-gray-800'}`}
                    >
                      {driver.paid ? 'Undo' : 'Mark Paid'}
                    </button>
                    <button onClick={() => toggleExpand(driver.driver_id)} className="p-1.5 border border-gray-200 rounded text-gray-500 hover:bg-gray-50">
                      {driver.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {driver.ticket_pay > 0 && driver.timesheet_pay > 0 && (
                  <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      Load pay: <span className="font-medium text-gray-700">${driver.ticket_pay.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Hourly pay: <span className="font-medium text-gray-700">${driver.timesheet_pay.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {driver.expanded && (
                <div className="border-t border-gray-100 bg-gray-50">
                  <div className="divide-y divide-gray-100">
                    {driver.lines.map(line => (
                      <div key={line.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-700">{line.date} · {line.description}</p>
                          {line.adjusted_pay != null && (
                            <p className="text-xs text-amber-600 mt-0.5">
                              Adjusted from ${line.pay.toFixed(2)} → ${line.adjusted_pay.toFixed(2)}
                              {line.adjustment_reason && ` (${line.adjustment_reason})`}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-900">
                            ${(line.adjusted_pay ?? line.pay).toFixed(2)}
                          </p>
                          <span className={`text-xs ${line.type === 'ticket' ? 'text-blue-500' : 'text-purple-500'}`}>
                            {line.type === 'ticket' ? 'Load' : 'Hourly'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
