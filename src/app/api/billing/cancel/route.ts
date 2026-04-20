import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const adminClient = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
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
    return Response.json({ error: 'Only the owner can manage billing' }, { status: 403 })
  }

  const now = new Date()

  await adminClient
    .from('companies')
    .update({ billing_status: 'canceled' })
    .eq('id', profile.company_id)

  const { data: sub } = await adminClient
    .from('subscriptions')
    .select('id')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sub) {
    await adminClient
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: now.toISOString(),
        cancel_at_period_end: true,
        updated_at: now.toISOString(),
      })
      .eq('id', sub.id)
  }

  return Response.json({ ok: true })
}
