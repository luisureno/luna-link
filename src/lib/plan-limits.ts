import type { Plan, PlanId, Subscription, BillingStatus } from '@/types'

export const PLAN_LIMITS: Record<PlanId, { drivers: number | null; trucks: number | null }> = {
  solo:       { drivers: 1,    trucks: 1 },
  starter:    { drivers: 5,    trucks: 5 },
  fleet:      { drivers: 20,   trucks: 20 },
  enterprise: { drivers: null, trucks: null },
}

export type LimitResource = 'drivers' | 'trucks'

export interface PlanContext {
  plan: Plan | null
  subscription: Subscription | null
  trialEndsAt: Date | null
  billingStatus: BillingStatus
}

export interface LimitCheck {
  allowed: boolean
  limit: number | null
  current: number
  remaining: number | null
  reason?: 'limit_reached' | 'no_plan' | 'trial_ended' | 'canceled'
}

export function daysLeftInTrial(trialEndsAt: string | Date | null): number | null {
  if (!trialEndsAt) return null
  const end = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt
  const diff = end.getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function isTrialExpired(trialEndsAt: string | Date | null): boolean {
  if (!trialEndsAt) return false
  const end = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt
  return end.getTime() < Date.now()
}

export function hasActiveAccess(ctx: PlanContext): boolean {
  if (ctx.billingStatus === 'active') return true
  if (ctx.billingStatus === 'trialing') return !isTrialExpired(ctx.trialEndsAt)
  return false
}

export function checkLimit(
  ctx: PlanContext,
  resource: LimitResource,
  current: number
): LimitCheck {
  if (!ctx.plan) {
    return { allowed: false, limit: 0, current, remaining: 0, reason: 'no_plan' }
  }
  if (ctx.billingStatus === 'canceled') {
    return { allowed: false, limit: 0, current, remaining: 0, reason: 'canceled' }
  }
  if (ctx.billingStatus === 'trialing' && isTrialExpired(ctx.trialEndsAt)) {
    return { allowed: false, limit: 0, current, remaining: 0, reason: 'trial_ended' }
  }

  const limit = PLAN_LIMITS[ctx.plan.id][resource]
  if (limit === null) {
    return { allowed: true, limit: null, current, remaining: null }
  }
  const remaining = Math.max(0, limit - current)
  return {
    allowed: current < limit,
    limit,
    current,
    remaining,
    reason: current >= limit ? 'limit_reached' : undefined,
  }
}

export function nextPlanUp(planId: PlanId): PlanId | null {
  const order: PlanId[] = ['solo', 'starter', 'fleet', 'enterprise']
  const idx = order.indexOf(planId)
  if (idx < 0 || idx >= order.length - 1) return null
  return order[idx + 1]
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`
}
