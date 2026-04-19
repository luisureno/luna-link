'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Invoice, Client } from '@/types'

export default function InvoicesPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [invoices, setInvoices] = useState<(Invoice & { clients: Client })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.company_id) return
    loadInvoices()
  }, [profile?.company_id])

  async function loadInvoices() {
    const { data } = await supabase
      .from('invoices')
      .select('*, clients(*)')
      .eq('company_id', profile!.company_id)
      .order('created_at', { ascending: false })
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
        subtitle="Generate and track client invoices"
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 opacity-60 cursor-not-allowed" title="Create invoices from confirmed tickets in the Tickets page">
            <Plus size={16} /> New Invoice
          </button>
        }
      />

      <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
        To create an invoice, go to <strong>Tickets</strong>, select confirmed tickets, and click &quot;Add to Invoice&quot;.
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No invoices yet.</p>
          </div>
        ) : (
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Invoice #</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Loads</th>
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
                  <td className="px-4 py-3 text-sm text-gray-700">{inv.total_loads ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.total_amount ? `$${Number(inv.total_amount).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3">
                    {inv.status === 'sent' && (
                      <button onClick={() => markPaid(inv.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">Mark Paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
