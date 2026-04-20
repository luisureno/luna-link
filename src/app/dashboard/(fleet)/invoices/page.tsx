'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Invoice, Client } from '@/types'

type TabId = 'client' | 'payroll' | 'all'

const tabs: { id: TabId; label: string }[] = [
  { id: 'client', label: 'Client Invoices' },
  { id: 'payroll', label: 'Driver Payroll' },
  { id: 'all', label: 'All Exports' },
]

export default function InvoicesPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [tab, setTab] = useState<TabId>('client')
  const [invoices, setInvoices] = useState<(Invoice & { clients: Client })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.company_id) return
    loadInvoices()
  }, [profile?.company_id, tab])

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
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Generate and track client invoices and payroll"
        action={
          <Link
            href="/dashboard/invoices/generate"
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800"
          >
            <Plus size={16} /> Generate Invoice
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map(t => (
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

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
                      <p className="text-xs text-gray-400 mt-0.5">{inv.created_at.split('T')[0]}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{inv.total_amount ? `$${Number(inv.total_amount).toLocaleString()}` : '—'}</p>
                      <StatusBadge status={inv.status} />
                      <div className="flex gap-1.5">
                        <Link href={`/api/invoice/pdf?id=${inv.id}`} target="_blank" className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">PDF</Link>
                        <Link href={`/api/invoice/excel?id=${inv.id}`} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">XLS</Link>
                        {inv.status === 'sent' && (
                          <button onClick={() => markPaid(inv.id)} className="text-xs px-2.5 py-1.5 bg-green-600 text-white rounded hover:bg-green-700">Paid</button>
                        )}
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
                      <td className="px-4 py-3 text-sm text-gray-700">{inv.created_at.split('T')[0]}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{(inv as any).lines_total ?? (inv as any).total_loads ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.total_amount ? `$${Number(inv.total_amount).toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/api/invoice/pdf?id=${inv.id}`} target="_blank" className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">PDF</Link>
                          <Link href={`/api/invoice/excel?id=${inv.id}`} className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">XLS</Link>
                          {inv.status === 'sent' && (
                            <button onClick={() => markPaid(inv.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">Mark Paid</button>
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
    </div>
  )
}
