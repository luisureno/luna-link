'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Navigation, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import type { Dispatch } from '@/types'
import { formatDate, mapsUrl } from '@/lib/format'
import { AppLoader } from '@/components/AppLoader'

type DispatchWithClient = Dispatch & { clients: { name: string } | null }

export default function DriverDispatchesPage() {
  const { profile, loading: authLoading } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [dispatches, setDispatches] = useState<DispatchWithClient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    loadData()
  }, [profile?.id])

  async function loadData() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('dispatch_assignments')
      .select('dispatches!inner(*, clients(name))')
      .eq('driver_id', profile!.id)
      .gte('dispatches.scheduled_date', today)
      .in('dispatches.status', ['pending', 'active'])

    const rows = (data ?? [])
      .map((r: any) => r.dispatches)
      .filter(Boolean)
      .sort((a: DispatchWithClient, b: DispatchWithClient) =>
        a.scheduled_date.localeCompare(b.scheduled_date)
      )
    setDispatches(rows)
    setLoading(false)
  }

  if (authLoading || loading) return <AppLoader />

  const grouped = dispatches.reduce<Record<string, DispatchWithClient[]>>((acc, d) => {
    (acc[d.scheduled_date] ??= []).push(d)
    return acc
  }, {})

  return (
    <div className="p-4 pb-28 space-y-5">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Assigned to you</p>
        <h1 className="text-2xl font-bold text-gray-900">Dispatches</h1>
      </div>

      {dispatches.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <Send size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No dispatches assigned right now.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{formatDate(date)}</h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
              {items.map(d => (
                <div key={d.id} className="px-4 py-3 space-y-2">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{d.clients?.name ?? d.client_name ?? 'Client'}</p>
                    {d.scheduled_time && (
                      <p className="text-xs text-gray-500 mt-0.5">Arrival {d.scheduled_time.slice(0, 5)}</p>
                    )}
                  </div>

                  {d.job_site_address && (
                    <a
                      href={mapsUrl(d.job_site_address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 active:bg-gray-100"
                    >
                      <Navigation size={14} className="text-gray-700 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-900 flex-1">{d.job_site_address}</span>
                      <span className="text-xs text-gray-500 font-medium flex-shrink-0">Open</span>
                    </a>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {d.material_type && (
                      <div><span className="text-gray-400">Hauling </span><span className="text-gray-900 font-medium">{d.material_type}</span></div>
                    )}
                    {d.billing_type && (
                      <div>
                        <span className="text-gray-400">Billing </span>
                        <span className="text-gray-900 font-medium">
                          {d.billing_type === 'per_load'
                            ? `Per load${d.hours_per_load ? ` · ${d.hours_per_load} hrs guaranteed` : ''}`
                            : 'Per hour'}
                        </span>
                      </div>
                    )}
                    {d.po_number && (
                      <div><span className="text-gray-400">PO# </span><span className="text-gray-900 font-medium">{d.po_number}</span></div>
                    )}
                  </div>

                  {d.notes && (
                    <p className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                      <span className="font-medium text-amber-900">Note: </span>{d.notes}
                    </p>
                  )}

                  <Link
                    href={`/driver/ticket?dispatch=${d.id}`}
                    className="block text-center py-2.5 bg-[#1a1a1a] text-white rounded-lg text-sm font-semibold hover:opacity-90"
                  >
                    Start Load
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
