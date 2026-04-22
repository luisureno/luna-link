'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { isDemoEmail } from '@/lib/demo'

export function DemoBanner() {
  const { supabaseUser, loading } = useAuth()

  if (loading) return null
  if (!isDemoEmail(supabaseUser?.email)) return null

  return (
    <div className="bg-blue-600 text-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 flex items-center justify-between gap-3">
        <p className="text-xs md:text-sm font-medium truncate">
          You&apos;re exploring a demo account — data resets periodically.
        </p>
        <Link
          href="/signup"
          className="flex-shrink-0 px-3 py-1 bg-white text-blue-700 rounded text-xs font-semibold hover:bg-blue-50"
        >
          Sign up free
        </Link>
      </div>
    </div>
  )
}
