'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { LoadTicket, User, Client } from '@/types'

type TicketRow = LoadTicket & { users: User; clients: Client }

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

  return (
    <div>
      <PageHeader title="Tickets" subtitle="Review and confirm driver load tickets" />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <span className="text-sm text-gray-500">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="confirmed">Confirmed</option>
          <option value="invoiced">Invoiced</option>
          <option value="disputed">Disputed</option>
        </select>

        {selected.length > 0 && (
          <button onClick={bulkConfirm} className="px-3 py-2 bg-[#1a1a1a] text-white text-sm rounded hover:bg-gray-800">
            Confirm {selected.length} Selected
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No tickets found for the selected filters.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-4 py-3"><input type="checkbox" onChange={e => setSelected(e.target.checked ? tickets.map(t => t.id) : [])} checked={selected.length === tickets.length && tickets.length > 0} className="w-4 h-4" /></th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date/Time</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Driver</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map(ticket => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(ticket.id)} onChange={() => toggleSelect(ticket.id)} className="w-4 h-4" /></td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(ticket.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                    {new Date(ticket.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{(ticket.users as User)?.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{(ticket.clients as Client)?.name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                  <td className="px-4 py-3">
                    {ticket.status === 'submitted' && (
                      <button onClick={() => confirmTicket(ticket.id)} className="text-xs px-2 py-1 bg-[#1a1a1a] text-white rounded hover:bg-gray-800">
                        Confirm
                      </button>
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
