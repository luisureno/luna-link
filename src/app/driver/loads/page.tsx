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
  const [editData, setEditData] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  function initEdit(ticket: LoadTicket) {
    if (editData[ticket.id]) return
    const fd = (ticket.form_data ?? {}) as Record<string, unknown>
    const merged: Record<string, string> = {}
    Object.entries(fd).forEach(([k, v]) => {
      if (v !== null && v !== undefined && String(v).trim() !== '') merged[k] = String(v)
    })
    if (ticket.tag_number && !merged.tag_number) merged.tag_number = ticket.tag_number
    if (ticket.weight_tons != null && !merged.weight_tons) merged.weight_tons = String(ticket.weight_tons)
    if (ticket.material_type && !merged.material_type) merged.material_type = ticket.material_type
    if (ticket.loads_count != null && !merged.loads_count) merged.loads_count = String(ticket.loads_count)
    setEditData(prev => ({ ...prev, [ticket.id]: merged }))
  }

  async function saveTicket(ticketId: string) {
    const data = editData[ticketId]
    if (!data) return
    setSaving(prev => ({ ...prev, [ticketId]: true }))
    const update: Record<string, unknown> = { form_data: data }
    if (data.tag_number !== undefined) update.tag_number = data.tag_number || null
    if (data.weight_tons !== undefined) update.weight_tons = data.weight_tons ? parseFloat(data.weight_tons) : null
    if (data.material_type !== undefined) update.material_type = data.material_type || null
    if (data.loads_count !== undefined) update.loads_count = data.loads_count ? parseInt(data.loads_count) : null
    await supabase.from('load_tickets').update(update).eq('id', ticketId)
    setSaving(prev => ({ ...prev, [ticketId]: false }))
    loadTickets()
  }

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
    <div className="p-4 pb-28 space-y-4">
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
              const photoUrl = ticket.tag_photo_url ?? ticket.scanned_invoice_photo_url ?? (ticket.photo_urls ?? [])[0] ?? null
              const isOpen = expanded === ticket.id
              const fields = editData[ticket.id] ?? {}

              return (
                <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => {
                      if (!isOpen) initEdit(ticket)
                      setExpanded(isOpen ? null : ticket.id)
                    }}
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

                  {isOpen && (
                    <div className="border-t border-gray-100 p-4 space-y-3">
                      {photoUrl && (
                        <button
                          onClick={() => setLightbox(photoUrl)}
                          className="block w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                        >
                          <img src={photoUrl} alt="Scanned ticket" className="w-full object-contain max-h-48" />
                          <p className="text-xs text-center text-gray-400 py-1">Tap to view full screen</p>
                        </button>
                      )}
                      {Object.entries(fields).map(([key, value]) => (
                        <div key={key} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                          <p className="text-xs text-gray-500 mb-1">{FIELD_LABELS[key] ?? key.replace(/_/g, ' ')}</p>
                          <input
                            value={value}
                            onChange={e => setEditData(prev => ({ ...prev, [ticket.id]: { ...prev[ticket.id], [key]: e.target.value } }))}
                            className="w-full text-base text-gray-900 outline-none bg-transparent"
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => saveTicket(ticket.id)}
                        disabled={saving[ticket.id]}
                        className="w-full py-3 bg-[#1a1a1a] text-white rounded-xl text-sm font-semibold disabled:opacity-60"
                      >
                        {saving[ticket.id] ? 'Saving…' : 'Save Changes'}
                      </button>
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
