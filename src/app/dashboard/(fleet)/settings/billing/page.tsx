'use client'

import { Suspense } from 'react'
import { BillingPanel } from '@/components/BillingPanel'

export default function FleetBillingPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
      <BillingPanel backHref="/dashboard/settings" />
    </Suspense>
  )
}
