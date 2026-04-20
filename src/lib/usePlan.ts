'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthContext'
import {
  checkLimit,
  daysLeftInTrial,
  hasActiveAccess,
  isTrialExpired,
  nextPlanUp,
  type LimitResource,
  type PlanContext,
} from '@/lib/plan-limits'
import type { Plan, Subscription, Company } from '@/types'

interface UsePlanReturn extends PlanContext {
  company: Company | null
  loading: boolean
  daysLeft: number | null
  trialExpired: boolean
  hasAccess: boolean
  nextPlan: ReturnType<typeof nextPlanUp>
  checkLimit: (resource: LimitResource, current: number) => ReturnType<typeof checkLimit>
  refresh: () => Promise<void>
}

export function usePlan(): UsePlanReturn {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [company, setCompany] = useState<Company | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!profile?.company_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: companyRow }, { data: subRow }] = await Promise.all([
      supabase.from('companies').select('*').eq('id', profile.company_id).single(),
      supabase
        .from('subscriptions')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    setCompany(companyRow ?? null)
    setSubscription(subRow ?? null)

    const planId = subRow?.plan_id ?? companyRow?.plan_id ?? null
    if (planId) {
      const { data: planRow } = await supabase.from('plans').select('*').eq('id', planId).single()
      setPlan(planRow ?? null)
    } else {
      setPlan(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id])

  const trialEndsAt = subscription?.trial_ends_at ?? company?.trial_ends_at ?? null
  const billingStatus = company?.billing_status ?? 'none'
  const ctx: PlanContext = { plan, subscription, trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null, billingStatus }

  return {
    ...ctx,
    company,
    loading,
    daysLeft: daysLeftInTrial(trialEndsAt),
    trialExpired: isTrialExpired(trialEndsAt),
    hasAccess: hasActiveAccess(ctx),
    nextPlan: plan ? nextPlanUp(plan.id) : null,
    checkLimit: (resource, current) => checkLimit(ctx, resource, current),
    refresh: load,
  }
}
