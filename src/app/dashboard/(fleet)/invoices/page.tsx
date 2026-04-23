'use client'

import { useEffect, useMemo , useState } from 'react'
import { Plus, FileSpreadsheet, AlertTriangle, CheckCircle2, Clock, Copy, Check, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { QuickBooksWaitlistButton } from '@/components/QuickBooksWaitlistButton'
import type { Invoice, Client } from '@/types'
import { formatDate } from '@/lib/format'
import { AppLoader } from '@/components/AppLoader'

type TabId = 'client' | 'payroll' | 'all'

const tabs: { id: TabId; label: string }[] = [
  { id: 'client', label: 'Client Invoices' },
  { id: 'payroll', label: 'Driver Payroll' },
  { id: 'all', label: 'All Exports' },
]

export default function InvoicesPage() {
  const { profile, accountType } = useAuth()
  const generateHref = accountType === 'solo' ? '/dashboard/solo/invoices/generate' : '/dashboard/invoices/generate'
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<TabId>('client')
  const [invoices, setInvoices] = useState<(Invoice & { clients: Client })[]>([])
  const [loading, setLoading] = useState(true)
  const [unpaid, setUnpaid] = useState<(Invoice & { clients: Client })[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.company_id) return
    loadInvoices()
    loadUnpaid()
  }, [profile?.company_id, tab])

  async function loadUnpaid() {
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(*)')
      .eq('company_id', profile!.company_id)
      .eq('invoice_type', 'client_invoice')
      .in('status', ['draft', 'sent'])
      .order('created_at', { ascending: true })
    setUnpaid((data ?? []) as any)
  }

  async function loadInvoices() {
    setLoading(true)
    let query = supabase
      .from('invoices')
      .select('*, clients(*)')
      .eq('company_id', profile!.company_id)
      .order('created_at', { ascending: false })

    if (tab === 'client') query = query.eq('invoice_type', 'client_invoice')
    else if (tab === 'payroll') query = query.eq('invoice_type', 'driver_payroll')

    const { data } = await query
    setInvoices((data ?? []) as any)
    setLoading(false)
  }

  async function markPaid(id: string) {
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', id)
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'paid' as const } : inv))
    setUnpaid(prev => prev.filter(inv => inv.id !== id))
  }

  function daysSince(dateStr: string) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  }

  async function deleteInvoice(id: string) {
    setDeletingId(id)
    await fetch(`/api/invoice/delete?id=${id}`, { method: 'DELETE' })
    setInvoices(prev => prev.filter(i => i.id !== id))
    setUnpaid(prev => prev.filter(i => i.id !== id))
    setDeletingId(null)
    setConfirmDelete(null)
  }

  async function copyInvoiceLines(inv: Invoice & { clients: Client }) {
    setCopyingId(inv.id)
    const from = (inv as any).date_from
    const to = (inv as any).date_to
    const clientName = (inv.clients as Client)?.name ?? '—'

    const { data: tickets } = await supabase
      .from('load_tickets')
      .select('submitted_at, tag_number, form_data, billing_type, loads_count, client_charge_total')
      .eq('company_id', profile!.company_id)
      .eq('client_id', inv.client_id!)
      .eq('invoice_line_confirmed', true)
      .gte('submitted_at', from ? `${from}T00:00:00` : '')
      .lte('submitted_at', to ? `${to}T23:59:59` : '')
      .order('submitted_at')

    const { data: timesheets } = await supabase
      .from('daily_timesheets')
      .select('work_date, hours_billed_client, client_charge_total')
      .eq('company_id', profile!.company_id)
      .eq('client_id', inv.client_id!)
      .eq('status', 'invoiced')
      .gte('work_date', from ?? '')
      .lte('work_date', to ?? '')
      .order('work_date')

    const rows: string[] = []
    for (const t of tickets ?? []) {
      const r = t as any
      const fd = (r.form_data ?? {}) as Record<string, unknown>
      const tag = r.tag_number ?? (fd.tag_number ? String(fd.tag_number) : '—')
      const loads = r.loads_count ?? (fd.loads_count ? String(fd.loads_count) : '1')
      const desc = `${loads} load(s)`
      const amt = Number(r.client_charge_total ?? 0).toFixed(2)
      rows.push(`${formatDate(r.submitted_at)}\t#${tag}\t${desc}\t$${amt}`)
    }
    for (const t of timesheets ?? []) {
      const r = t as any
      const hrs = r.hours_billed_client ?? '?'
      const amt = Number(r.client_charge_total ?? 0).toFixed(2)
      rows.push(`${formatDate(r.work_date)}\t—\t${hrs}h on site\t$${amt}`)
    }

    const header = `Invoice ${inv.invoice_number} — ${clientName}\nPeriod: ${formatDate(from)} – ${formatDate(to)}\n\nDate\tTag #\tDescription\tAmount\n`
    const total = `\n\nTOTAL\t\t\t$${Number(inv.total_amount ?? 0).toFixed(2)}`
    const text = header + rows.join('\n') + total

    await navigator.clipboard.writeText(text)
    setCopyingId(null)
    setCopiedId(inv.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  if (loading) return <AppLoader />

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={accountType === 'solo' ? 'Generate and track client invoices' : 'Generate and track client invoices and payroll'}
        action={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <QuickBooksWaitlistButton source="invoices_page" />
            <Link
              href={generateHref}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 w-full sm:w-auto"
            >
              <Plus size={16} /> Generate Invoice
            </Link>
          </div>
        }
      />

      {/* Payment Tracker */}
      {unpaid.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">What clients owe you</p>
              <p className="text-xs text-gray-500">{unpaid.length} unpaid invoice{unpaid.length !== 1 ? 's' : ''} · ${unpaid.reduce((s, i) => s + Number(i.total_amount ?? 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total outstanding</p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {unpaid.map(inv => {
              const days = daysSince(inv.created_at)
              const isOverdue = days >= 30
              const isWarning = days >= 14 && days < 30

              return (
                <div key={inv.id} className={`flex items-center gap-3 px-4 py-3 ${isOverdue ? 'bg-red-50' : isWarning ? 'bg-amber-50' : ''}`}>
                  <div className="shrink-0">
                    {isOverdue
                      ? <AlertTriangle size={16} className="text-red-500" />
                      : isWarning
                      ? <Clock size={16} className="text-amber-500" />
                      : <CheckCircle2 size={16} className="text-gray-300" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {(inv.clients as Client)?.name ?? '—'}
                    </p>
                    <p className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : isWarning ? 'text-amber-600' : 'text-gray-400'}`}>
                      Invoiced {days === 0 ? 'today' : `${days} day${days !== 1 ? 's' : ''} ago`}
                      {isOverdue ? ' · OVERDUE' : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">${Number(inv.total_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-400">{inv.invoice_number}</p>
                  </div>
                  <button
                    onClick={() => markPaid(inv.id)}
                    className="shrink-0 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-gray-800 font-medium"
                  >
                    Paid ✓
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.filter(t => accountType === 'solo' ? t.id !== 'payroll' : true).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm mb-3">No invoices yet.</p>
            <Link href="/dashboard/invoices/generate" className="text-sm text-blue-600 hover:underline">Generate your first invoice →</Link>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {invoices.map(inv => (
                <div key={inv.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{(inv.clients as Client)?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(inv.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{inv.total_amount ? `$${Number(inv.total_amount).toLocaleString()}` : '—'}</p>
                      <StatusBadge status={inv.status} />
                      <div className="flex gap-1.5 flex-wrap">
                        <Link href={`/api/invoice/pdf?id=${inv.id}`} target="_blank" className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">PDF</Link>
                        <Link
                          href={`/api/invoice/excel?id=${inv.id}`}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-green-600 text-green-700 rounded hover:bg-green-50"
                        >
                          <FileSpreadsheet size={12} /> Excel
                        </Link>
                        <button
                          onClick={() => copyInvoiceLines(inv)}
                          disabled={copyingId === inv.id}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-purple-400 text-purple-700 rounded hover:bg-purple-50 disabled:opacity-50"
                        >
                          {copiedId === inv.id ? <><Check size={12} /> Copied</> : copyingId === inv.id ? '…' : <><Copy size={12} /> Copy</>}
                        </button>
                        {inv.status === 'sent' && (
                          <button onClick={() => markPaid(inv.id)} className="text-xs px-2.5 py-1.5 bg-green-600 text-white rounded hover:bg-gray-800">Paid</button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(inv.id)}
                          className="inline-flex items-center justify-center text-xs px-2.5 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Invoice #</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Lines</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Amount</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{(inv.clients as Client)?.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(inv.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{(inv as any).lines_total ?? (inv as any).total_loads ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.total_amount ? `$${Number(inv.total_amount).toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/api/invoice/pdf?id=${inv.id}`} target="_blank" className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">PDF</Link>
                          <Link
                            href={`/api/invoice/excel?id=${inv.id}`}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-green-600 text-green-700 rounded hover:bg-green-50"
                          >
                            <FileSpreadsheet size={11} /> Excel
                          </Link>
                          <button
                            onClick={() => copyInvoiceLines(inv)}
                            disabled={copyingId === inv.id}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-purple-400 text-purple-700 rounded hover:bg-purple-50 disabled:opacity-50"
                          >
                            {copiedId === inv.id ? <><Check size={11} /> Copied</> : copyingId === inv.id ? '…' : <><Copy size={11} /> Copy</>}
                          </button>
                          {inv.status === 'sent' && (
                            <button onClick={() => markPaid(inv.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-gray-800">Mark Paid</button>
                          )}
                          {inv.status === 'draft' && (
                            <button
                              onClick={async () => {
                                await supabase.from('invoices').update({ status: 'sent' }).eq('id', inv.id)
                                setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'sent' as any } : i))
                              }}
                              className="text-xs px-2 py-1 bg-[#1a1a1a] text-white rounded hover:bg-gray-800"
                            >
                              Send
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmDelete(inv.id)}
                            className="inline-flex items-center justify-center text-xs px-2 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Delete this invoice?</h3>
            <p className="text-sm text-gray-500 mb-5">
              All tickets and timesheets tied to this invoice will be unlocked and can be re-invoiced. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteInvoice(confirmDelete)}
                disabled={deletingId === confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === confirmDelete ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
