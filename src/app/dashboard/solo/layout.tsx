'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/dispatcher/Sidebar'
import { BottomNav } from '@/components/driver/BottomNav'
import { TrialBanner } from '@/components/TrialBanner'
import { TrialEndedGate } from '@/components/TrialEndedGate'

export default function SoloLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [guardChecked, setGuardChecked] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) {
      router.replace('/login')
      return
    }
    if (profile.role === 'driver') {
      router.replace('/driver')
      return
    }

    async function verifyAccountType() {
      const { data } = await supabase
        .from('companies')
        .select('account_type')
        .eq('id', profile!.company_id)
        .single()
      if (!data) return
      if (data.account_type !== 'solo') {
        router.replace('/dashboard')
        return
      }
      setGuardChecked(true)
    }
    verifyAccountType()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile?.id])

  if (loading || !profile || !guardChecked) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-60 min-h-screen bg-[#F8F7F5] pt-[72px] md:pt-0 pb-28 md:pb-6">
        <TrialBanner billingHref="/dashboard/solo/settings/billing" />
        <div className="max-w-3xl w-full mx-auto p-4 md:p-6">{children}</div>
      </main>
      <BottomNav />
      <TrialEndedGate billingHref="/dashboard/solo/settings/billing" />
    </div>
  )
}
