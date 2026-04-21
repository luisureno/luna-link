'use client'

import { useEffect, useMemo , useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { LoadTicket } from '@/types'

type GroupedTickets = { date: string; tickets: LoadTicket[] }[]

export default function MyLoadsPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [groups, setGroups] = useState<GroupedTickets>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    loadTickets()
  }, [profile?.id])

  async function loadTickets() {
    const { data } = await supabase
      .from('load_tickets')
      .select('*')
      .eq('driver_id', profile!.id)
      .order('submitted_at', { ascending: false })

    const tickets = data ?? []
    const byDate: Record<string, LoadTicket[]> = {}
    tickets.forEach(t => {
      const date = t.submitted_at.split('T')[0]
      if (!byDate[date]) byDate[date] = []
      byDate[date].push(t)
    })

    setGroups(Object.entries(byDate).map(([date, tickets]) => ({ date, tickets })))
    setLoading(false)
  }

  if (loading) {
    return <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />)}</div>
  }

  if (groups.length === 0) {
    return (
      <div className="p-4 text-center mt-12">
        <p className="text-gray-500 text-sm">No tickets submitted yet.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">My Loads</h1>
      {groups.map(({ date, tickets }) => (
        <div key={date}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700">
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <span className="text-xs text-gray-500">{tickets.length} loads</span>
          </div>
          <div className="space-y-2">
            {tickets.map(ticket => (
              <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(ticket.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-gray-500">#{ticket.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <StatusBadge status={ticket.status} />
                </button>

                {expanded === ticket.id && (
                  <div className="border-t border-gray-100 p-4 space-y-2">
                    {Object.entries(ticket.form_data as Record<string, unknown>).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-gray-900 font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
