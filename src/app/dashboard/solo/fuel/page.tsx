'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import type { FuelLog } from '@/types'

const FuelMap = dynamic(() => import('@/components/FuelMap'), {
  ssr: false,
  loading: () => <div style={{ height: 'calc(100dvh - 190px)', minHeight: 420 }} className="bg-gray-100 animate-pulse" />,
})

export default function SoloFuelPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [logs, setLogs] = useState<FuelLog[]>([])

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('fuel_logs').select('*').eq('driver_id', profile.id)
      .order('logged_at', { ascending: false })
      .then(({ data }) => setLogs(data ?? []))
  }, [profile?.id])

  // Break out of the layout's p-4 md:p-6 padding so map goes edge-to-edge
  return (
    <div className="-mx-4 md:-mx-6 -mt-4 md:-mt-6 -mb-4 md:-mb-6">
      <FuelMap logs={logs} />
    </div>
  )
}
