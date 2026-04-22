export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { email, fleet_size, company_id, user_id, source, notes } = await request.json()

  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 })
  }

  const { error } = await adminClient.from('quickbooks_waitlist').insert({
    email,
    fleet_size: fleet_size || null,
    company_id: company_id || null,
    user_id: user_id || null,
    source: source || 'invoices_page',
    notes: notes || null,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 400 })
  }

  return Response.json({ ok: true })
}
