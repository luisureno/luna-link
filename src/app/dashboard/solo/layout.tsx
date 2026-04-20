'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Truck, Home, List, FileText, Receipt, Building2, LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { TrialBanner } from '@/components/TrialBanner'
import { TrialEndedGate } from '@/components/TrialEndedGate'

export default function SoloLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, signOut } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const pathname = usePathname()

  const [menuOpen, setMenuOpen] = useState(false)
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

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  if (loading || !profile || !guardChecked) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  const tabs = [
    { href: '/dashboard/solo', label: 'Today', icon: Home, exact: true },
    { href: '/dashboard/solo/loads', label: 'Loads', icon: List },
    { href: '/dashboard/solo/tickets', label: 'Tickets', icon: FileText },
    { href: '/dashboard/solo/invoices', label: 'Invoices', icon: Receipt },
    { href: '/dashboard/solo/clients', label: 'Clients', icon: Building2 },
  ]

  const initials = profile.full_name?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7F5]">
      <header className="bg-[#1a1a1a] text-white">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard/solo" className="flex items-center gap-2">
            <Truck size={18} className="text-white" />
            <span className="font-semibold text-sm">HaulProof</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs text-white/50">
                {profile.truck_number ?? 'Owner operator'}
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold hover:bg-white/30 transition-colors"
              >
                {initials}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-11 z-20 bg-white rounded-lg shadow-lg border border-gray-200 w-44 overflow-hidden">
                    <Link
                      href="/dashboard/solo/settings"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Settings
                    </Link>
                    <div className="border-t border-gray-100" />
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar — horizontal scroll on mobile, evenly spread on desktop */}
        <nav className="flex border-t border-white/10 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 min-w-[84px] flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium whitespace-nowrap transition ${
                  active ? 'text-white border-b-2 border-white' : 'text-white/60 hover:text-white'
                }`}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </Link>
            )
          })}
        </nav>
      </header>

      <TrialBanner billingHref="/dashboard/solo/settings/billing" />

      <main className="flex-1 max-w-3xl w-full mx-auto">
        {children}
      </main>

      <TrialEndedGate billingHref="/dashboard/solo/settings/billing" />
    </div>
  )
}
