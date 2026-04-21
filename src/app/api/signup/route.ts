export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import type { PlanId, BillingCycle, AccountType } from '@/types'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function accountTypeForPlan(plan: PlanId): AccountType {
  if (plan === 'solo') return 'solo'
  if (plan === 'enterprise') return 'enterprise'
  return 'fleet'
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    plan,
    cycle,
    company_name,
    company_address,
    company_phone,
    owner_full_name,
    owner_email,
    owner_phone,
    password,
  } = body as {
    plan: PlanId
    cycle: BillingCycle
    company_name: string
    company_address?: string
    company_phone?: string
    owner_full_name: string
    owner_email: string
    owner_phone?: string
    password: string
  }

  if (!plan || !['solo', 'starter', 'fleet'].includes(plan)) {
    return Response.json({ error: 'Invalid plan' }, { status: 400 })
  }
  if (!company_name?.trim() || !owner_full_name?.trim() || !owner_email?.trim() || !password) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const now = new Date()
  const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  // 1. Create company
  const { data: company, error: companyError } = await adminClient
    .from('companies')
    .insert({
      name: company_name.trim(),
      address: company_address?.trim() || null,
      phone: company_phone?.trim() || null,
      account_type: accountTypeForPlan(plan),
      plan_id: plan,
      trial_ends_at: trialEnd.toISOString(),
      billing_status: 'trialing',
    })
    .select('id, invite_token')
    .single()

  if (companyError || !company) {
    console.error('[signup] company insert failed:', companyError)
    return Response.json({ error: `Company: ${companyError?.message ?? 'unknown'}` }, { status: 400 })
  }

  // 2. Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: owner_email.trim(),
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    console.error('[signup] auth create failed:', authError)
    await adminClient.from('companies').delete().eq('id', company.id)
    return Response.json({ error: `Auth: ${authError?.message ?? 'unknown'}` }, { status: 400 })
  }

  // 3. Create owner profile
  const { error: profileError } = await adminClient.from('users').insert({
    id: authData.user.id,
    company_id: company.id,
    full_name: owner_full_name.trim(),
    phone: owner_phone?.trim() || null,
    role: 'owner',
    is_active: true,
  })

  if (profileError) {
    console.error('[signup] profile insert failed:', profileError)
    await adminClient.auth.admin.deleteUser(authData.user.id)
    await adminClient.from('companies').delete().eq('id', company.id)
    return Response.json({ error: `Profile: ${profileError.message}` }, { status: 400 })
  }

  // 4. Create subscription (trialing)
  const { error: subError } = await adminClient.from('subscriptions').insert({
    company_id: company.id,
    plan_id: plan,
    status: 'trialing',
    billing_cycle: cycle ?? 'monthly',
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
  })

  if (subError) {
    console.error('[signup] subscription insert failed:', subError)
    await adminClient.from('users').delete().eq('id', authData.user.id)
    await adminClient.auth.admin.deleteUser(authData.user.id)
    await adminClient.from('companies').delete().eq('id', company.id)
    return Response.json({ error: `Subscription: ${subError.message}` }, { status: 400 })
  }

  // 5. Create onboarding progress row (current_step=4 — moving into post-auth steps)
  await adminClient.from('onboarding_progress').insert({
    company_id: company.id,
    current_step: 4,
    completed: false,
    data: {},
  })

  return Response.json({
    ok: true,
    company_id: company.id,
    user_id: authData.user.id,
    invite_token: company.invite_token,
    trial_ends_at: trialEnd.toISOString(),
  })
}
