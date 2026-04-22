'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { X } from 'lucide-react'
import type { LoadTicket } from '@/types'

type GroupedTickets = { date: string; tickets: LoadTicket[] }[]

const FIELD_LABELS: Record<string, string> = {
  ticket_date: 'Date', tag_number: 'Tag #', client_name: 'Client',
  job_site: 'Job Site', origin: 'Origin', destination: 'Destination',
  material_type: 'Material', weight_tons: 'Weight (tons)',
  gross_weight_lbs: 'Gross (lbs)', tare_weight_lbs: 'Tare (lbs)',
  loads_count: 'Loads', hours_worked: 'Hours', truck_number: 'Truck #',
  trailer_number: 'Trailer #', driver_name: 'Driver', po_number: 'PO #',
  rate_amount: 'Rate', total_amount: 'Total', notes: 'Notes',
}

export default function MyLoadsPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [groups, setGroups] = useState<GroupedTickets>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

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
            {tickets.map(ticket => {
              const fd = (ticket.form_data ?? {}) as Record<string, unknown>
              const tagNum = fd.tag_number || ticket.tag_number
              const dt = new Date(ticket.submitted_at)
              const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              const timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              const photoUrl = ticket.tag_photo_url ?? (ticket as any).scanned_invoice_photo_url ?? null

              return (
                <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {tagNum ? `Tag #${tagNum}` : 'No tag number'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{dateStr} · {timeStr}</p>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </button>

                  {expanded === ticket.id && (
                    <div className="border-t border-gray-100 p-4 space-y-3">
                      {photoUrl && (
                        <button
                          onClick={() => setLightbox(photoUrl)}
                          className="block w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
                        >
                          <img src={photoUrl} alt="Scanned ticket" className="w-full object-contain max-h-48" />
                          <p className="text-xs text-center text-gray-400 py-1">Tap to view full screen</p>
                        </button>
                      )}
                      <div className="space-y-1.5">
                        {Object.entries(fd)
                          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
                          .map(([key, value]) => (
                            <div key={key} className="flex justify-between gap-4 text-sm">
                              <span className="text-gray-500 flex-shrink-0">{FIELD_LABELS[key] ?? key.replace(/_/g, ' ')}</span>
                              <span className="text-gray-900 font-medium text-right">{String(value)}</span>
                            </div>
                          ))}
                        {ticket.material_type && !fd.material_type && (
                          <div className="flex justify-between gap-4 text-sm">
                            <span className="text-gray-500">Material</span>
                            <span className="text-gray-900 font-medium text-right">{ticket.material_type}</span>
                          </div>
                        )}
                        {ticket.weight_tons && !fd.weight_tons && (
                          <div className="flex justify-between gap-4 text-sm">
                            <span className="text-gray-500">Weight (tons)</span>
                            <span className="text-gray-900 font-medium text-right">{ticket.weight_tons}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2">
            <X size={24} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
