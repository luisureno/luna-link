'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText, Filter, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { LoadTicket, TicketStatus, Client } from '@/types'
import { formatDate } from '@/lib/format'

type DateRange = 'today' | '7d' | '30d' | 'all'

interface TicketWithClient extends LoadTicket {
  client?: { name: string } | null
  job_site?: { name: string } | null
}

const PAGE_SIZE = 25

export default function SoloLoadsPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [clients, setClients] = useState<Client[]>([])
  const [rows, setRows] = useState<TicketWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)

  const [range, setRange] = useState<DateRange>('30d')
  const [status, setStatus] = useState<TicketStatus | 'all'>('all')
  const [clientId, setClientId] = useState<string>('all')

  const rangeStart = useMemo(() => {
    const d = new Date()
    if (range === 'today') d.setHours(0, 0, 0, 0)
    else if (range === '7d') d.setDate(d.getDate() - 7)
    else if (range === '30d') d.setDate(d.getDate() - 30)
    else return null
    return d.toISOString()
  }, [range])

  useEffect(() => {
    if (!profile) return
    loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id])

  useEffect(() => {
    if (!profile) return
    setPage(0)
    loadRows(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, range, status, clientId])

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', profile!.company_id)
      .order('name')
    setClients(data ?? [])
  }

  async function loadRows(pageIdx: number, reset: boolean) {
    setLoading(true)
    try {
      const from = pageIdx * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('load_tickets')
        .select('*, client:clients(name), job_site:job_sites(name)')
        .eq('driver_id', profile!.id)
        .order('submitted_at', { ascending: false })
        .range(from, to)

      if (rangeStart) query = query.gte('submitted_at', rangeStart)
      if (status !== 'all') query = query.eq('status', status)
      if (clientId !== 'all') query = query.eq('client_id', clientId)

      const { data } = await query
      const fetched = (data ?? []) as TicketWithClient[]

      setHasMore(fetched.length === PAGE_SIZE)
      setRows(reset ? fetched : [...rows, ...fetched])
    } finally {
      setLoading(false)
    }
  }

  function loadMore() {
    const next = page + 1
    setPage(next)
    loadRows(next, false)
  }

  const totalLoads = rows.length
  const payType = profile?.pay_type ?? null
  const payRate = profile?.pay_rate ?? null
  const estEarnings =
    payType === 'per_load' && payRate ? totalLoads * Number(payRate) : null

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My loads</h1>
        <p className="text-xs text-gray-500 mt-0.5">Your complete load history.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-2xl font-semibold text-gray-900">{totalLoads}</p>
          <p className="text-[11px] text-gray-500">Loads in view</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-2xl font-semibold text-gray-900">
            {estEarnings !== null ? `$${estEarnings.toFixed(0)}` : '—'}
          </p>
          <p className="text-[11px] text-gray-500">Est. earnings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
          <Filter size={13} />
          <span>Filter</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1">
          {([
            { key: 'today', label: 'Today' },
            { key: '7d', label: '7 days' },
            { key: '30d', label: '30 days' },
            { key: 'all', label: 'All time' },
          ] as { key: DateRange; label: string }[]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full flex-shrink-0 border ${
                range === opt.key
                  ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.key !== 'all' && <Calendar size={11} className="inline mr-1 -mt-px" />}
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={status}
            onChange={e => setStatus(e.target.value as TicketStatus | 'all')}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="confirmed">Confirmed</option>
            <option value="invoiced">Invoiced</option>
            <option value="disputed">Disputed</option>
          </select>
          <select
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="all">All clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Load list */}
      {loading && rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500">No loads match these filters.</p>
          <Link
            href="/driver/ticket"
            className="mt-3 inline-block px-4 py-2 bg-[#1a1a1a] text-white text-xs font-medium rounded hover:bg-gray-800"
          >
            Submit a new ticket
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map(ticket => {
              const date = new Date(ticket.submitted_at)
              return (
                <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {(() => {
                        const fd = (ticket.form_data ?? {}) as Record<string, unknown>
                        const tagNum = ticket.tag_number ?? (fd.tag_number ? String(fd.tag_number) : null)
                        return tagNum ? `Tag #${tagNum}` : 'No tag number'
                      })()}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(date)} · {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {(() => {
                        const fd = (ticket.form_data ?? {}) as Record<string, unknown>
                        const truckNum = fd.truck_number ? String(fd.truck_number) : null
                        return truckNum ? ` · Truck #${truckNum}` : ''
                      })()}
                    </p>
                  </div>
                  <StatusBadge status={ticket.status} />
                </div>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full py-3 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
