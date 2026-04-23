'use client'

import { useAuth } from '@/context/AuthContext'
import { AppLoader } from '@/components/AppLoader'

export function FleetAuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, profile } = useAuth()
  if (loading || !profile) return <AppLoader />
  return <>{children}</>
}
