'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { usePlan } from '@/lib/usePlan'

export function TrialBanner({ billingHref }: { billingHref: string }) {
  const { loading, company, daysLeft } = usePlan()

  if (loading || !company) return null
  if (company.billing_status !== 'trialing') return null
  if (daysLeft === null) return null

  if (daysLeft <= 0) {
    return (
      <div className="bg-red-600 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <p className="text-sm font-medium truncate">Your free trial has ended.</p>
          </div>
          <Link
            href={billingHref}
            className="flex-shrink-0 px-3 py-1 bg-white text-red-700 rounded text-xs font-semibold hover:bg-red-50"
          >
            Add billing
          </Link>
        </div>
      </div>
    )
  }

  if (daysLeft > 2) return null

  return (
    <div className="bg-red-600 text-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={14} className="flex-shrink-0" />
          <p className="text-xs md:text-sm font-medium truncate">
            Only {daysLeft} day{daysLeft === 1 ? '' : 's'} left — add billing to keep running
          </p>
        </div>
        <Link
          href={billingHref}
          className="flex-shrink-0 px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold"
        >
          Add billing
        </Link>
      </div>
    </div>
  )
}
