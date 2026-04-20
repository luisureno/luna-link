import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PlanId, BillingCycle, AccountType } from '@/types'

const adminClient = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function accountTypeForPlan(plan: PlanId): AccountType {
  if (plan === 'solo') return 'solo'
  if (plan === 'enterprise') return 'enterprise'
  return 'fleet'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'owner') {
    return Response.json({ error: 'Only the owner can change the plan' }, { status: 403 })
  }

  const body = await request.json()
  const { plan_id, billing_cycle } = body as { plan_id: PlanId; billing_cycle: BillingCycle }

  if (!plan_id || !['solo', 'starter', 'fleet'].includes(plan_id)) {
    return Response.json({ error: 'Invalid plan' }, { status: 400 })
  }
  if (!billing_cycle || !['monthly', 'annual'].includes(billing_cycle)) {
    return Response.json({ error: 'Invalid billing cycle' }, { status: 400 })
  }

  const { data: company, error: companyErr } = await adminClient
    .from('companies')
    .select('plan_id, account_type')
    .eq('id', profile.company_id)
    .single()

  if (companyErr || !company) {
    return Response.json({ error: companyErr?.message ?? 'Company not found' }, { status: 400 })
  }

  const { data: currentSub } = await adminClient
    .from('subscriptions')
    .select('id, plan_id, billing_cycle')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const changed = company.plan_id !== plan_id || (currentSub && currentSub.billing_cycle !== billing_cycle)

  if (!changed) {
    return Response.json({ ok: true, changed: false })
  }

  const { error: coErr } = await adminClient
    .from('companies')
    .update({
      plan_id,
      account_type: accountTypeForPlan(plan_id),
    })
    .eq('id', profile.company_id)

  if (coErr) return Response.json({ error: `Company: ${coErr.message}` }, { status: 400 })

  if (currentSub) {
    const { error: subErr } = await adminClient
      .from('subscriptions')
      .update({
        plan_id,
        billing_cycle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentSub.id)
    if (subErr) return Response.json({ error: `Subscription: ${subErr.message}` }, { status: 400 })
  } else {
    const { error: insErr } = await adminClient.from('subscriptions').insert({
      company_id: profile.company_id,
      plan_id,
      billing_cycle,
      status: 'trialing',
    })
    if (insErr) return Response.json({ error: `Subscription: ${insErr.message}` }, { status: 400 })
  }

  return Response.json({ ok: true, changed: true })
}
