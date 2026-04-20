import type { PlanId, BillingCycle } from '@/types'

const KEY = 'haulproof_signup'

export interface SignupState {
  plan?: PlanId
  cycle?: BillingCycle
  company_name?: string
  company_address?: string
  company_phone?: string
  fleet_size?: string
  owner_full_name?: string
  owner_email?: string
  owner_phone?: string
}

export function readSignupState(): SignupState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SignupState) : {}
  } catch {
    return {}
  }
}

export function writeSignupState(patch: Partial<SignupState>): SignupState {
  if (typeof window === 'undefined') return patch
  const current = readSignupState()
  const next = { ...current, ...patch }
  sessionStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function clearSignupState(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(KEY)
}
