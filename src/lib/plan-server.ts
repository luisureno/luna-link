import { createClient } from '@/lib/supabase/server'
import {
  checkLimit,
  hasActiveAccess,
  type LimitResource,
  type PlanContext,
} from '@/lib/plan-limits'
import type { Plan, Subscription, Company } from '@/types'

interface ServerPlanContext extends PlanContext {
  company: Company | null
}

export async function getCompanyPlan(companyId: string): Promise<ServerPlanContext> {
  const supabase = await createClient()

  const [{ data: company }, { data: subscription }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', companyId).single(),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const planId = (subscription as Subscription | null)?.plan_id ?? (company as Company | null)?.plan_id ?? null
  let plan: Plan | null = null
  if (planId) {
    const { data } = await supabase.from('plans').select('*').eq('id', planId).single()
    plan = (data as Plan) ?? null
  }

  const trialEndsAt =
    (subscription as Subscription | null)?.trial_ends_at ??
    (company as Company | null)?.trial_ends_at ??
    null

  return {
    company: (company as Company) ?? null,
    plan,
    subscription: (subscription as Subscription) ?? null,
    trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
    billingStatus: (company as Company | null)?.billing_status ?? 'none',
  }
}

export async function enforceLimit(
  companyId: string,
  resource: LimitResource,
  current: number
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const ctx = await getCompanyPlan(companyId)

  if (!hasActiveAccess(ctx)) {
    const reason = ctx.billingStatus === 'canceled' ? 'Subscription canceled' : 'Trial ended — upgrade to continue'
    return { ok: false, status: 402, error: reason }
  }

  const result = checkLimit(ctx, resource, current)
  if (!result.allowed) {
    return {
      ok: false,
      status: 402,
      error: `${resource} limit reached (${result.current}/${result.limit}). Upgrade your plan to add more.`,
    }
  }
  return { ok: true }
}
