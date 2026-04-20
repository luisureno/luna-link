'use client'

import { Suspense } from 'react'
import { BillingPanel } from '@/components/BillingPanel'

export default function SoloBillingPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
      <div className="p-4">
        <BillingPanel backHref="/dashboard/solo/settings" />
      </div>
    </Suspense>
  )
}
