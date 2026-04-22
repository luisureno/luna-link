'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Lock, ArrowRight, LogOut } from 'lucide-react'
import { usePlan } from '@/lib/usePlan'
import { useAuth } from '@/context/AuthContext'

interface Props {
  billingHref: string
  allowPathnames?: string[]
}

export function TrialEndedGate({ billingHref, allowPathnames = [] }: Props) {
  const { loading, company, daysLeft } = usePlan()
  const { signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

  // Scroll lock + Escape blocking when gate is active
  const expired =
    !loading &&
    company != null &&
    ((company.billing_status === 'trialing' && daysLeft !== null && daysLeft <= 0) ||
      company.billing_status === 'canceled')

  const allowed =
    pathname === billingHref ||
    allowPathnames.some(p => pathname === p || pathname.startsWith(p + '/'))

  const showGate = expired && !allowed

  useEffect(() => {
    if (!showGate) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showGate])

  if (!showGate) return null

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    router.push('/login')
  }

  const canceled = company?.billing_status === 'canceled'

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 md:p-8">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <Lock className="text-red-600" size={26} />
        </div>

        <h2 className="text-xl md:text-2xl font-semibold text-gray-900 text-center">
          {canceled ? 'Your subscription is canceled' : 'Your free trial has ended'}
        </h2>
        <p className="text-sm text-gray-600 text-center mt-2">
          {canceled
            ? 'Reactivate your plan to get back to running loads.'
            : 'Add billing info to keep using FleetWise. Your data is safe — nothing was deleted.'}
        </p>

        <div className="mt-6 space-y-2">
          <Link
            href={billingHref}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#1a1a1a] text-white rounded font-medium hover:bg-gray-800"
          >
            {canceled ? 'Reactivate plan' : 'Add billing info'}
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/#pricing"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            See pricing
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
          <span className="text-gray-500">Need help? <a href="mailto:support@fleetwise.com" className="text-gray-900 font-medium">support@fleetwise.com</a></span>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            <LogOut size={12} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  )
}
