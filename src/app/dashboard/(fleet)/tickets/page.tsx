'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { LoadTicket, User, Client } from '@/types'

type TicketRow = LoadTicket & {
  users: User
  clients: Client
  dispatcher_adjusted_pay?: number | null
  dispatcher_adjustment_reason?: string | null
  billing_type?: string | null
  client_charge_total?: number | null
  driver_pay_total?: number | null
  loads_count?: number | null
  weight_tons?: number | null
  tag_number?: string | null
}

interface AdjustState {
  pay: string
  reason: string
  saving: boolean
}

export default function TicketsPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<Record<string, AdjustState>>({})

  useEffect(() => {
    if (!profile?.company_id) return
    loadTickets()
  }, [profile?.company_id, dateFrom, dateTo, statusFilter])

  async function loadTickets() {
    setLoading(true)
    let query = supabase
      .from('load_tickets')
      .select('*, users(*), clients(*)')
      .eq('company_id', profile!.company_id)
      .gte('submitted_at', `${dateFrom}T00:00:00`)
      .lte('submitted_at', `${dateTo}T23:59:59`)
      .order('submitted_at', { ascending: false })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    const { data } = await query
    setTickets((data ?? []) as TicketRow[])
    setLoading(false)
  }

  async function confirmTicket(id: string) {
    await supabase.from('load_tickets').update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: profile!.id }).eq('id', id)
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'confirmed' as const } : t))
  }

  async function bulkConfirm() {
    await supabase.from('load_tickets').update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirmed_by: profile!.id }).in('id', selected)
    setTickets(prev => prev.map(t => selected.includes(t.id) ? { ...t, status: 'confirmed' as const } : t))
    setSelected([])
  }

  function toggleSelect(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleExpand(id: string) {
    setExpanded(prev => prev === id ? null : id)
    if (!adjusting[id]) {
      const ticket = tickets.find(t => t.id === id)
      setAdjusting(prev => ({
        ...prev,
        [id]: {
          pay: ticket?.dispatcher_adjusted_pay?.toString() ?? ticket?.driver_pay_total?.toString() ?? '',
          reason: ticket?.dispatcher_adjustment_reason ?? '',
          saving: false,
        }
      }))
    }
  }

  async function saveAdjustment(id: string) {
    const adj = adjusting[id]
    if (!adj) return
    setAdjusting(prev => ({ ...prev, [id]: { ...prev[id], saving: true } }))
    await supabase.from('load_tickets').update({
      dispatcher_adjusted_pay: adj.pay ? parseFloat(adj.pay) : null,
      dispatcher_adjustment_reason: adj.reason || null,
    }).eq('id', id)
    setTickets(prev => prev.map(t => t.id === id ? {
      ...t,
      dispatcher_adjusted_pay: adj.pay ? parseFloat(adj.pay) : null,
      dispatcher_adjustment_reason: adj.reason || null,
    } : t))
    setAdjusting(prev => ({ ...prev, [id]: { ...prev[id], saving: false } }))
  }

  function DetailPanel({ ticket }: { ticket: TicketRow }) {
    const adj = adjusting[ticket.id] ?? { pay: '', reason: '', saving: false }
    const originalPay = ticket.driver_pay_total
    const adjustedPay = ticket.dispatcher_adjusted_pay

    return (
      <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100 space-y-4">
        {/* Billing summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ticket.billing_type && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Billing type</p>
              <p className="text-sm font-semibold capitalize">{ticket.billing_type.replace('_', ' ')}</p>
            </div>
          )}
          {ticket.loads_count != null && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Loads</p>
              <p className="text-sm font-semibold">{ticket.loads_count}</p>
            </div>
          )}
          {ticket.weight_tons != null && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Weight</p>
              <p className="text-sm font-semibold">{ticket.weight_tons} tons</p>
            </div>
          )}
          {ticket.tag_number && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Tag #</p>
              <p className="text-sm font-semibold">{ticket.tag_number}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs text-blue-600 mb-1">Client charge</p>
            <p className="text-base font-bold text-blue-900">
              {ticket.client_charge_total != null ? `$${Number(ticket.client_charge_total).toFixed(2)}` : '—'}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <p className="text-xs text-green-600 mb-1">Driver pay</p>
            <p className="text-base font-bold text-green-900">
              {adjustedPay != null ? (
                <>
                  <span className="line-through text-gray-400 text-sm mr-1">${Number(originalPay ?? 0).toFixed(2)}</span>
                  ${Number(adjustedPay).toFixed(2)}
                </>
              ) : originalPay != null ? `$${Number(originalPay).toFixed(2)}` : '—'}
            </p>
          </div>
        </div>

        {/* Pay adjustment */}
        <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Dispatcher Pay Adjustment</p>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-500">Adjusted pay ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={adj.pay}
                onChange={e => setAdjusting(prev => ({ ...prev, [ticket.id]: { ...prev[ticket.id], pay: e.target.value } }))}
                placeholder={originalPay?.toString() ?? '0.00'}
                className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Reason (optional)</label>
            <input
              type="text"
              value={adj.reason}
              onChange={e => setAdjusting(prev => ({ ...prev, [ticket.id]: { ...prev[ticket.id], reason: e.target.value } }))}
              placeholder="e.g. short day, wait time deducted"
              className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <button
            onClick={() => saveAdjustment(ticket.id)}
            disabled={adj.saving}
            className="w-full py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {adj.saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Adjustment'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Tickets" subtitle="Review and confirm driver load tickets" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <span className="text-sm text-gray-500">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none">
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="confirmed">Confirmed</option>
            <option value="invoiced">Invoiced</option>
            <option value="disputed">Disputed</option>
          </select>
          {selected.length > 0 && (
            <button onClick={bulkConfirm} className="px-3 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800 whitespace-nowrap">
              Confirm {selected.length}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No tickets found for the selected filters.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {tickets.map(ticket => (
                <div key={ticket.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <input type="checkbox" checked={selected.includes(ticket.id)} onChange={() => toggleSelect(ticket.id)} className="mt-0.5 w-4 h-4 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{(ticket.users as User)?.full_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{(ticket.clients as Client)?.name ?? '—'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(ticket.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(ticket.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <StatusBadge status={ticket.status} />
                        <div className="flex gap-1">
                          {ticket.status === 'submitted' && (
                            <button onClick={() => confirmTicket(ticket.id)} className="text-xs px-2.5 py-1.5 bg-[#1a1a1a] text-white rounded hover:bg-gray-800">
                              Confirm
                            </button>
                          )}
                          <button onClick={() => toggleExpand(ticket.id)} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                            {expanded === ticket.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {expanded === ticket.id && <DetailPanel ticket={ticket} />}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-10 px-4 py-3"><input type="checkbox" onChange={e => setSelected(e.target.checked ? tickets.map(t => t.id) : [])} checked={selected.length === tickets.length && tickets.length > 0} className="w-4 h-4" /></th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date/Time</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Driver</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client $</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Driver Pay</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tickets.map(ticket => (
                    <>
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(ticket.id)} onChange={() => toggleSelect(ticket.id)} className="w-4 h-4" /></td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(ticket.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                          {new Date(ticket.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{(ticket.users as User)?.full_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{(ticket.clients as Client)?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {ticket.client_charge_total != null ? `$${Number(ticket.client_charge_total).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {ticket.dispatcher_adjusted_pay != null ? (
                            <span className="text-amber-700 font-medium">${Number(ticket.dispatcher_adjusted_pay).toFixed(2)} *</span>
                          ) : ticket.driver_pay_total != null ? (
                            `$${Number(ticket.driver_pay_total).toFixed(2)}`
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {ticket.status === 'submitted' && (
                              <button onClick={() => confirmTicket(ticket.id)} className="text-xs px-2 py-1 bg-[#1a1a1a] text-white rounded hover:bg-gray-800">Confirm</button>
                            )}
                            <button onClick={() => toggleExpand(ticket.id)} className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                              {expanded === ticket.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              Pay
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded === ticket.id && (
                        <tr key={`${ticket.id}-detail`}>
                          <td colSpan={8} className="p-0">
                            <DetailPanel ticket={ticket} />
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
